// src/hooks/useCallSocket.ts
import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { v4 as uuidv4 } from 'uuid';

interface CallState {
  callId: string;
  type: "voice" | "video";
  status: "idle" | "ringing" | "active" | "ended";
  caller?: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
  };
  callee?: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
  };
  participants: string[];
  startTime?: Date;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  screenStream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
  error?: string;
}

interface UseCallSocketProps {
  userId: string;
  onIncomingCall?: (caller: CallState["caller"], type: "voice" | "video") => void;
  onCallEnded?: (reason: string) => void;
}

const configuration: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const initialCallState: CallState = {
  callId: "",
  type: "voice",
  status: "idle",
  participants: [],
  localStream: null,
  remoteStream: null,
  screenStream: null,
  audioEnabled: true,
  videoEnabled: true,
  screenSharing: false,
};

export const useCallSocket = ({ userId, onIncomingCall, onCallEnded }: UseCallSocketProps) => {
  const [callState, setCallState] = useState<CallState>(initialCallState);
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Memoized callbacks to prevent re-renders
  const stableOnIncomingCall = useCallback(onIncomingCall || (() => {}), [onIncomingCall]);
  const stableOnCallEnded = useCallback(onCallEnded || (() => {}), [onCallEnded]);

  const handleCallEnd = useCallback((reason: string) => {
    console.log("Handling call end with reason:", reason);
    
    // Stop all tracks
    localStreamRef.current?.getTracks().forEach(track => {
      track.stop();
      console.log("Stopped local track:", track.kind);
    });
    remoteStreamRef.current?.getTracks().forEach(track => {
      track.stop();
      console.log("Stopped remote track:", track.kind);
    });
    screenStreamRef.current?.getTracks().forEach(track => {
      track.stop();
      console.log("Stopped screen track:", track.kind);
    });

    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Clear refs
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    screenStreamRef.current = null;

    // Close peer connection
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
        console.log("Closed peer connection");
      } catch (e) {
        console.error("Error closing peer connection:", e);
      }
    }
    peerConnectionRef.current = null;

    // Reset state
    setCallState(initialCallState);
  }, []);

  const createPeerConnection = useCallback(async () => {
    if (!socketRef.current || callState.status !== "active") {
      console.warn("Cannot create peer connection: not connected or call not active");
      return;
    }

    console.log("Creating peer connection");
    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate && callState.callId) {
        console.log("Sending ICE candidate");
        socketRef.current?.emit("webrtc_ice_candidate", {
          callId: callState.callId,
          targetUserId: callState.participants.find(id => id !== userId) || "",
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event: RTCTrackEvent) => {
      console.log("Received remote track");
      const [remoteStream] = event.streams;
      
      if (remoteStream) {
        remoteStreamRef.current = remoteStream;
        setCallState(prev => ({
          ...prev,
          remoteStream: remoteStream,
        }));
        
        // Set remote video element
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      }
    };

    // Add local tracks
    if (localStreamRef.current) {
      console.log("Adding local tracks to peer connection");
      localStreamRef.current.getTracks().forEach(track => {
        if (pc.signalingState !== "closed") {
          pc.addTrack(track, localStreamRef.current!);
        }
      });
    }

    // Add screen share tracks if available
    if (screenStreamRef.current) {
      console.log("Adding screen share tracks to peer connection");
      screenStreamRef.current.getTracks().forEach(track => {
        if (pc.signalingState !== "closed") {
          pc.addTrack(track, screenStreamRef.current!);
        }
      });
    }

    // If we are the caller, create and send offer
    if (callState.caller?.id === userId) {
      console.log("Creating WebRTC offer");
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const targetUserId = callState.participants.find(id => id !== userId);
        if (targetUserId && callState.callId) {
          socketRef.current?.emit("webrtc_offer", {
            callId: callState.callId,
            targetUserId,
            offer,
          });
        }
      } catch (error) {
        console.error("Error creating offer:", error);
      }
    }
  }, [callState.status, callState.callId, callState.participants, callState.caller?.id, userId]);

  const getMediaStream = useCallback(async (type: "voice" | "video" | "screen"): Promise<MediaStream> => {
    try {
      if (type === "screen") {
        // @ts-ignore - getDisplayMedia might not be recognized in all environments
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        return stream;
      } else {
        const constraints: MediaStreamConstraints = {
          audio: true,
          video: type === "video" ? { facingMode: "user" } : false,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        return stream;
      }
    } catch (error) {
      console.error(`Error getting ${type} stream:`, error);
      throw error;
    }
  }, []);

  const initLocalStream = useCallback(async (type: "voice" | "video") => {
    try {
      const stream = await getMediaStream(type);
      localStreamRef.current = stream;
      
      // Set local video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setCallState(prev => ({
        ...prev,
        localStream: stream,
        audioEnabled: true,
        videoEnabled: type === "video",
      }));
      console.log(`Initialized local ${type} stream`);
      return stream;
    } catch (error) {
      console.error("Error initializing local stream:", error);
      throw error;
    }
  }, [getMediaStream]);

  // Socket setup with proper cleanup
  useEffect(() => {
    const socketUrl = "http://localhost:3000";
    socketRef.current = io(socketUrl, {
      transports: ["websocket"],
      auth: { userId },
    });

    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log("Connected to socket server with ID:", socket.id);
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from socket server");
      setIsConnected(false);
    });

    socket.on("call_incoming", (data: { callId: string; caller: CallState["caller"]; type: "voice" | "video"; timestamp: string }) => {
      console.log("Received incoming call:", data);
      setCallState(prev => ({
        ...prev,
        callId: data.callId,
        type: data.type,
        status: "ringing",
        caller: data.caller,
      }));
      stableOnIncomingCall(data.caller, data.type);
    });

    socket.on("call_accepted", (data: { callId: string; type: "voice" | "video"; participants: string[] }) => {
      console.log("Call accepted:", data);
      setCallState(prev => ({
        ...prev,
        status: "active",
        participants: data.participants,
        startTime: new Date(),
      }));
    });

    socket.on("call_ended", (data: { callId: string; reason: string; endedBy?: string }) => {
      console.log("Call ended:", data);
      handleCallEnd(data.reason);
      stableOnCallEnded(data.reason);
    });

    socket.on("webrtc_offer", async (data: { callId: string; senderId: string; offer: RTCSessionDescriptionInit }) => {
      console.log("Received WebRTC offer");
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);

          socket.emit("webrtc_answer", {
            callId: data.callId,
            targetUserId: data.senderId,
            answer,
          });
        } catch (error) {
          console.error("Error handling WebRTC offer:", error);
        }
      }
    });

    socket.on("webrtc_answer", async (data: { callId: string; senderId: string; answer: RTCSessionDescriptionInit }) => {
      console.log("Received WebRTC answer");
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (error) {
          console.error("Error handling WebRTC answer:", error);
        }
      }
    });

    socket.on("webrtc_ice_candidate", (data: { callId: string; senderId: string; candidate: RTCIceCandidateInit }) => {
      console.log("Received ICE candidate");
      if (peerConnectionRef.current) {
        try {
          peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    });

    socket.on("screen_share_started", (data: { userId: string }) => {
      console.log("Screen share started by:", data.userId);
      setCallState(prev => ({ ...prev, screenSharing: true }));
    });

    socket.on("screen_share_stopped", (data: { userId: string }) => {
      console.log("Screen share stopped by:", data.userId);
      setCallState(prev => ({ ...prev, screenSharing: false }));
    });

    socket.on("participant_state_update", (data: { userId: string; audioEnabled: boolean; videoEnabled: boolean }) => {
      console.log("Participant state update:", data);
    });

    socket.on("call_error", (data: { message: string }) => {
      console.error("Call error:", data.message);
      setCallState(prev => ({ ...prev, error: data.message }));
    });

    socket.on("call_type_changed", (data: { callId: string; newType: "voice" | "video" }) => {
      console.log("Call type changed to:", data.newType);
      setCallState(prev => ({ ...prev, type: data.newType }));
    });

    return () => {
      console.log("Disconnecting socket");
      socket.disconnect();
      handleCallEnd("disconnected");
    };
  }, [userId, stableOnIncomingCall, stableOnCallEnded, handleCallEnd]);

  // Create peer connection when call becomes active
  useEffect(() => {
    if (callState.status === "active" && !peerConnectionRef.current) {
      const timer = setTimeout(() => {
        createPeerConnection();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [callState.status, createPeerConnection]);

  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTracks = localStreamRef.current.getAudioTracks();
    if (audioTracks.length > 0) {
      const enabled = !audioTracks[0].enabled;
      audioTracks[0].enabled = enabled;
      setCallState(prev => ({ ...prev, audioEnabled: enabled }));

      socketRef.current?.emit("call_state_update", {
        callId: callState.callId,
        audioEnabled: enabled,
        videoEnabled: callState.videoEnabled,
      });
    }
  }, [callState.callId, callState.videoEnabled]);

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    const videoTracks = localStreamRef.current.getVideoTracks();
    if (videoTracks.length > 0) {
      const enabled = !videoTracks[0].enabled;
      videoTracks[0].enabled = enabled;
      setCallState(prev => ({ ...prev, videoEnabled: enabled }));

      socketRef.current?.emit("call_state_update", {
        callId: callState.callId,
        audioEnabled: callState.audioEnabled,
        videoEnabled: enabled,
      });
    }
  }, [callState.callId, callState.audioEnabled]);

  const initiateCall = useCallback(async (targetUserId: string, type: "voice" | "video") => {
    try {
      await initLocalStream(type);
      const newCallId = uuidv4();
      socketRef.current?.emit("call_initiate", { targetUserId, type, isDM: true });
    } catch (error) {
      console.error("Error initiating call:", error);
    }
  }, [initLocalStream]);

  const acceptCall = useCallback(async () => {
    try {
      await initLocalStream(callState.type);
      socketRef.current?.emit("call_accept", { callId: callState.callId });
    } catch (error) {
      console.error("Error accepting call:", error);
    }
  }, [callState.type, callState.callId, initLocalStream]);

  const declineCall = useCallback(() => {
    socketRef.current?.emit("call_decline", { callId: callState.callId });
    handleCallEnd("declined");
  }, [callState.callId, handleCallEnd]);

  const endCall = useCallback(() => {
    socketRef.current?.emit("call_end", { callId: callState.callId });
    handleCallEnd("ended");
  }, [callState.callId, handleCallEnd]);

  const initScreenShare = useCallback(async () => {
    try {
      if (!peerConnectionRef.current || callState.status !== "active") {
        console.warn("Cannot start screen share: call not active");
        return;
      }

      const stream = await getMediaStream("screen");
      screenStreamRef.current = stream;
      setCallState(prev => ({ ...prev, screenStream: stream, screenSharing: true }));

      const videoSender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
      if (videoSender && stream.getVideoTracks().length > 0) {
        await videoSender.replaceTrack(stream.getVideoTracks()[0]);
      }

      socketRef.current?.emit("screen_share_start", { callId: callState.callId });

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (error) {
      console.error("Error starting screen share:", error);
    }
  }, [callState.status, callState.callId, getMediaStream]);

  const stopScreenShare = useCallback(async () => {
    if (!peerConnectionRef.current || !screenStreamRef.current) return;

    try {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      setCallState(prev => ({ ...prev, screenStream: null, screenSharing: false }));

      const videoSender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
      if (videoSender && localStreamRef.current) {
        const cameraVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (cameraVideoTrack) {
          await videoSender.replaceTrack(cameraVideoTrack);
        }
      }

      socketRef.current?.emit("screen_share_stop", { callId: callState.callId });
    } catch (error) {
      console.error("Error stopping screen share:", error);
    }
  }, [callState.callId]);

  const setVideoElements = useCallback((localVideo: HTMLVideoElement, remoteVideo: HTMLVideoElement) => {
    localVideoRef.current = localVideo;
    remoteVideoRef.current = remoteVideo;

    // Set existing streams if available
    if (localStreamRef.current && localVideo) {
      localVideo.srcObject = localStreamRef.current;
    }
    if (remoteStreamRef.current && remoteVideo) {
      remoteVideo.srcObject = remoteStreamRef.current;
    }
  }, []);

  // Return interface that matches what CallInterface expects
  return {
    isConnected,
    activeCall: callState.status === "active" ? {
      callId: callState.callId,
      callerId: callState.caller?.id || "",
      targetUserId: callState.callee?.id || "",
      type: callState.type,
      timestamp: callState.startTime?.getTime() || Date.now()
    } : null,
    incomingCall: callState.status === "ringing" ? {
      callId: callState.callId,
      callerId: callState.caller?.id || "",
      targetUserId: userId,
      type: callState.type,
      timestamp: Date.now(),
      caller: callState.caller
    } : null,
    audioEnabled: callState.audioEnabled,
    videoEnabled: callState.videoEnabled,
    isScreenSharing: callState.screenSharing,
    remoteParticipantState: {
      audioEnabled: true, // This should come from participant state updates
      videoEnabled: true
    },
    callState,
    acceptCall,
    declineCall,
    endCall,
    toggleAudio,
    toggleVideo,
    startScreenShare: initScreenShare,
    stopScreenShare,
    setVideoElements,
    initiateCall,
  };
};