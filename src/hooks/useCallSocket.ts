// src/hooks/useCallSocket.ts
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// Type definitions matching backend
interface CallData {
  callId: string;
  caller?: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
  callee?: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
  type: 'voice' | 'video';
  timestamp: Date;
  status?: string;
}

interface CallError {
  message: string;
  code?: string;
}

interface ParticipantState {
  userId: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

interface CallState {
  isConnected: boolean;
  activeCall: CallData | null;
  incomingCall: CallData | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing: boolean;
  remoteParticipantState: ParticipantState | null;
  callStatus: 'idle' | 'ringing' | 'connecting' | 'active' | 'ended';
}

class CallSocket {
  private socket: Socket | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localVideo: HTMLVideoElement | null = null;
  private remoteVideo: HTMLVideoElement | null = null;
  private isInitiator: boolean = false;
  private callId: string | null = null;
  private targetUserId: string | null = null;
  
  // WebRTC configuration
  private pcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Event listeners
  public onConnectionStateChange: ((connected: boolean) => void) | null = null;
  public onIncomingCall: ((data: CallData) => void) | null = null;
  public onCallInitiated: ((data: CallData) => void) | null = null;
  public onCallAccepted: ((data: CallData) => void) | null = null;
  public onCallEnded: ((data: { callId: string; reason: string; endedBy?: string }) => void) | null = null;
  public onCallError: ((data: CallError) => void) | null = null;
  public onRemoteStreamReceived: ((stream: MediaStream) => void) | null = null;
  public onParticipantStateUpdate: ((data: ParticipantState) => void) | null = null;
  public onScreenShareStarted: ((data: { userId: string; username?: string }) => void) | null = null;
  public onScreenShareStopped: ((data: { userId: string }) => void) | null = null;

  // Initialize socket connection
  connect(token: string): void {
    if (this.socket?.connected) return;

    this.socket = io('http://localhost:3000', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    this.setupSocketListeners();
  }

  // Get connection status
  get isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Setup socket event listeners
  private setupSocketListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('Call socket connected');
      this.onConnectionStateChange?.(true);
    });

    this.socket.on('disconnect', () => {
      console.log('Call socket disconnected');
      this.onConnectionStateChange?.(false);
    });

    // Call events - matching backend exactly
    this.socket.on('call_incoming', (data: {
      callId: string;
      caller: {
        id: string;
        username: string;
        displayName?: string;
        avatar?: string;
      };
      type: 'voice' | 'video';
      timestamp: string;
    }) => {
      console.log('Incoming call:', data);
      const callData: CallData = {
        callId: data.callId,
        caller: data.caller,
        type: data.type,
        timestamp: new Date(data.timestamp)
      };
      this.onIncomingCall?.(callData);
    });

    this.socket.on('call_initiated', (data: {
      callId: string;
      callee: {
        id: string;
        username: string;
        displayName?: string;
        avatar?: string;
      };
      type: 'voice' | 'video';
      status: string;
    }) => {
      console.log('Call initiated:', data);
      this.callId = data.callId;
      const callData: CallData = {
        callId: data.callId,
        callee: data.callee,
        type: data.type,
        timestamp: new Date(),
        status: data.status
      };
      this.onCallInitiated?.(callData);
    });

    this.socket.on('call_accepted', (data: {
      callId: string;
      type: 'voice' | 'video';
      participants: string[];
    }) => {
      console.log('Call accepted:', data);
      this.callId = data.callId;
      
      if (this.isInitiator) {
        this.createOffer();
      }
      
      const callData: CallData = {
        callId: data.callId,
        type: data.type,
        timestamp: new Date()
      };
      this.onCallAccepted?.(callData);
    });

    this.socket.on('call_ended', (data: {
      callId: string;
      reason: string;
      endedBy?: string;
    }) => {
      console.log('Call ended:', data);
      this.cleanup();
      this.onCallEnded?.(data);
    });

    this.socket.on('call_error', (data: CallError) => {
      console.error('Call error:', data);
      this.cleanup();
      this.onCallError?.(data);
    });

    // WebRTC signaling - matching backend parameter names
    this.socket.on('webrtc_offer', async (data: {
      callId: string;
      senderId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      console.log('Received WebRTC offer from:', data.senderId);
      await this.handleOffer(data.offer);
    });

    this.socket.on('webrtc_answer', async (data: {
      callId: string;
      senderId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      console.log('Received WebRTC answer from:', data.senderId);
      await this.handleAnswer(data.answer);
    });

    this.socket.on('webrtc_ice_candidate', async (data: {
      callId: string;
      senderId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      console.log('Received ICE candidate from:', data.senderId);
      await this.handleIceCandidate(data.candidate);
    });

    // Call state updates
    this.socket.on('participant_state_update', (data: {
      userId: string;
      audioEnabled: boolean;
      videoEnabled: boolean;
    }) => {
      console.log('Participant state update:', data);
      this.onParticipantStateUpdate?.(data);
    });

    // Screen sharing
    this.socket.on('screen_share_started', (data: {
      userId: string;
      username?: string;
    }) => {
      console.log('Screen share started:', data);
      this.onScreenShareStarted?.(data);
    });

    this.socket.on('screen_share_stopped', (data: {
      userId: string;
    }) => {
      console.log('Screen share stopped:', data);
      this.onScreenShareStopped?.(data);
    });

    this.socket.on('screen_share_start_confirmed', (data: {
      callId: string;
    }) => {
      console.log('Screen share confirmed:', data);
    });
  }

  // Initialize media devices
  async initializeMedia(videoEnabled: boolean = false): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        },
        video: videoEnabled ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        } : false
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (this.localVideo) {
        this.localVideo.srcObject = this.localStream;
      }

      return this.localStream;
    } catch (error) {
      console.error('Failed to get media devices:', error);
      throw error;
    }
  }

  // Set video elements
  setVideoElements(localVideo: HTMLVideoElement, remoteVideo: HTMLVideoElement): void {
    this.localVideo = localVideo;
    this.remoteVideo = remoteVideo;

    if (this.localStream && this.localVideo) {
      this.localVideo.srcObject = this.localStream;
    }
  }

  // Create peer connection
  createPeerConnection(): RTCPeerConnection {
    this.peerConnection = new RTCPeerConnection(this.pcConfig);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });
    }

    // Handle remote stream
    this.peerConnection.ontrack = (event: RTCTrackEvent) => {
      console.log('Received remote stream');
      this.remoteStream = event.streams[0];
      
      if (this.remoteVideo) {
        this.remoteVideo.srcObject = this.remoteStream;
      }
      
      this.onRemoteStreamReceived?.(this.remoteStream!);
    };

    // Handle ICE candidates - updated to match backend expectations
    this.peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate && this.socket && this.callId && this.targetUserId) {
        console.log('Sending ICE candidate');
        this.socket.emit('webrtc_ice_candidate', {
          callId: this.callId,
          targetUserId: this.targetUserId,
          candidate: event.candidate
        });
      }
    };

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection?.connectionState);
      
      if (this.peerConnection?.connectionState === 'failed') {
        console.error('Connection failed, attempting to restart ICE');
        this.peerConnection?.restartIce();
      }
    };

    return this.peerConnection;
  }

  // Initiate a call - matching backend expectations
  async initiateCall(targetUserId: string, type: 'voice' | 'video' = 'voice'): Promise<void> {
    try {
      this.isInitiator = true;
      this.targetUserId = targetUserId;
      
      console.log(`Initiating ${type} call to:`, targetUserId);
      
      // Initialize media
      await this.initializeMedia(type === 'video');
      
      // Create peer connection
      this.createPeerConnection();
      
      // Send call initiate - matching backend expected format
      this.socket?.emit('call_initiate', {
        targetUserId,
        type,
        isDM: true
      });
      
    } catch (error) {
      console.error('Failed to initiate call:', error);
      this.onCallError?.({ message: 'Failed to start call' });
    }
  }

  // Accept incoming call - matching backend expectations
  async acceptCall(callId: string, type: 'voice' | 'video' = 'voice'): Promise<void> {
    try {
      this.callId = callId;
      this.isInitiator = false;
      
      console.log('Accepting call:', callId);
      
      // Initialize media
      await this.initializeMedia(type === 'video');
      
      // Create peer connection
      this.createPeerConnection();
      
      // Accept call - matching backend expected format
      this.socket?.emit('call_accept', { callId });
      
    } catch (error) {
      console.error('Failed to accept call:', error);
      this.onCallError?.({ message: 'Failed to accept call' });
    }
  }

  // Decline incoming call - matching backend expectations
  declineCall(callId: string): void {
    console.log('Declining call:', callId);
    this.socket?.emit('call_decline', { callId });
    this.cleanup();
  }

  // End active call - matching backend expectations
  endCall(): void {
    if (this.callId) {
      console.log('Ending call:', this.callId);
      this.socket?.emit('call_end', { callId: this.callId });
    }
    this.cleanup();
  }

  // Create WebRTC offer
  private async createOffer(): Promise<void> {
    try {
      if (!this.peerConnection) return;
      
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await this.peerConnection.setLocalDescription(offer);
      
      console.log('Sending offer');
      this.socket?.emit('webrtc_offer', {
        callId: this.callId,
        targetUserId: this.targetUserId,
        offer
      });
    } catch (error) {
      console.error('Failed to create offer:', error);
    }
  }

  // Handle WebRTC offer
  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      if (!this.peerConnection) return;
      
      await this.peerConnection.setRemoteDescription(offer);
      
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      console.log('Sending answer');
      this.socket?.emit('webrtc_answer', {
        callId: this.callId,
        targetUserId: this.targetUserId,
        answer
      });
    } catch (error) {
      console.error('Failed to handle offer:', error);
    }
  }

  // Handle WebRTC answer
  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      if (!this.peerConnection) return;
      await this.peerConnection.setRemoteDescription(answer);
    } catch (error) {
      console.error('Failed to handle answer:', error);
    }
  }

  // Handle ICE candidate
  private async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      if (!this.peerConnection) return;
      await this.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }

  // Toggle audio
  toggleAudio(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        
        if (this.callId) {
          this.socket?.emit('call_state_update', {
            callId: this.callId,
            audioEnabled: audioTrack.enabled,
            videoEnabled: this.getVideoEnabled()
          });
        }
        
        return audioTrack.enabled;
      }
    }
    return false;
  }

  // Toggle video
  toggleVideo(): boolean {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        
        if (this.callId) {
          this.socket?.emit('call_state_update', {
            callId: this.callId,
            audioEnabled: this.getAudioEnabled(),
            videoEnabled: videoTrack.enabled
          });
        }
        
        return videoTrack.enabled;
      }
    }
    return false;
  }

  // Get audio state
  getAudioEnabled(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      return audioTrack ? audioTrack.enabled : false;
    }
    return false;
  }

  // Get video state
  getVideoEnabled(): boolean {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      return videoTrack ? videoTrack.enabled : false;
    }
    return false;
  }

  // Start screen sharing
  async startScreenShare(): Promise<boolean> {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      // Replace video track
      const videoTrack = screenStream.getVideoTracks()[0];
      const sender = this.peerConnection?.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      );

      if (sender) {
        await sender.replaceTrack(videoTrack);
      }

      // Update local video
      if (this.localVideo) {
        this.localVideo.srcObject = screenStream;
      }

      // Notify other participant
      if (this.callId) {
        this.socket?.emit('screen_share_start', { callId: this.callId });
      }

      // Handle screen share end
      videoTrack.onended = () => {
        this.stopScreenShare();
      };

      return true;
    } catch (error) {
      console.error('Failed to start screen share:', error);
      return false;
    }
  }

  // Stop screen sharing
  async stopScreenShare(): Promise<void> {
    try {
      if (this.localStream) {
        const videoTrack = this.localStream.getVideoTracks()[0];
        const sender = this.peerConnection?.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );

        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
        }

        // Restore local video
        if (this.localVideo) {
          this.localVideo.srcObject = this.localStream;
        }
      }

      // Notify other participant
      if (this.callId) {
        this.socket?.emit('screen_share_stop', { callId: this.callId });
      }
    } catch (error) {
      console.error('Failed to stop screen share:', error);
    }
  }

  // Cleanup resources
  private cleanup(): void {
    console.log('Cleaning up call resources');

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Clear video elements
    if (this.localVideo) {
      this.localVideo.srcObject = null;
    }
    if (this.remoteVideo) {
      this.remoteVideo.srcObject = null;
    }

    // Reset state
    this.remoteStream = null;
    this.callId = null;
    this.targetUserId = null;
    this.isInitiator = false;
  }

  // Disconnect socket
  disconnect(): void {
    this.cleanup();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

// React hook for using CallSocket
export const useCallSocket = () => {
  const callSocketRef = useRef<CallSocket | null>(null);
  const [callState, setCallState] = useState<CallState>({
    isConnected: false,
    activeCall: null,
    incomingCall: null,
    audioEnabled: true,
    videoEnabled: false,
    isScreenSharing: false,
    remoteParticipantState: null,
    callStatus: 'idle'
  });

  useEffect(() => {
    // Get token from localStorage or your auth system
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (!token) {
      console.warn('No auth token found for call socket connection');
      return;
    }

    // Create CallSocket instance
    if (!callSocketRef.current) {
      callSocketRef.current = new CallSocket();
    }

    const callSocket = callSocketRef.current;

    // Setup event handlers
    callSocket.onConnectionStateChange = (connected: boolean) => {
      setCallState(prev => ({ ...prev, isConnected: connected }));
    };

    callSocket.onIncomingCall = (data: CallData) => {
      setCallState(prev => ({ 
        ...prev, 
        incomingCall: data,
        callStatus: 'ringing'
      }));
    };

    callSocket.onCallInitiated = (data: CallData) => {
      setCallState(prev => ({ 
        ...prev, 
        activeCall: data,
        callStatus: 'ringing'
      }));
    };

    callSocket.onCallAccepted = (data: CallData) => {
      setCallState(prev => ({ 
        ...prev, 
        activeCall: data,
        incomingCall: null,
        audioEnabled: callSocket.getAudioEnabled(),
        videoEnabled: callSocket.getVideoEnabled(),
        callStatus: 'active'
      }));
    };

    callSocket.onCallEnded = (data: { callId: string; reason: string; endedBy?: string }) => {
      setCallState(prev => ({ 
        ...prev, 
        activeCall: null,
        incomingCall: null,
        isScreenSharing: false,
        audioEnabled: true,
        videoEnabled: false,
        remoteParticipantState: null,
        callStatus: 'ended'
      }));
      
      // Reset to idle after a brief moment
      setTimeout(() => {
        setCallState(prev => ({ ...prev, callStatus: 'idle' }));
      }, 2000);
    };

    callSocket.onCallError = (error: CallError) => {
      console.error('Call error:', error);
      setCallState(prev => ({ 
        ...prev, 
        activeCall: null,
        incomingCall: null,
        callStatus: 'idle'
      }));
    };

    callSocket.onParticipantStateUpdate = (data: ParticipantState) => {
      setCallState(prev => ({ 
        ...prev, 
        remoteParticipantState: data
      }));
    };

    callSocket.onScreenShareStarted = (data: { userId: string; username?: string }) => {
      console.log('Remote screen share started:', data);
      // You might want to update UI to show screen share indicator
    };

    callSocket.onScreenShareStopped = (data: { userId: string }) => {
      console.log('Remote screen share stopped:', data);
      // Update UI to remove screen share indicator
    };

    // Connect socket
    try {
      callSocket.connect(token);
    } catch (error) {
      console.error('Failed to connect call socket:', error);
    }

    // Cleanup on unmount
    return () => {
      if (callSocketRef.current) {
        callSocketRef.current.disconnect();
        callSocketRef.current = null;
      }
    };
  }, []);

  // Exposed methods
  const initiateCall = async (targetUserId: string, type: 'voice' | 'video' = 'voice') => {
    if (callSocketRef.current) {
      setCallState(prev => ({ ...prev, callStatus: 'connecting' }));
      await callSocketRef.current.initiateCall(targetUserId, type);
    }
  };

  const acceptCall = async (callId: string, type: 'voice' | 'video' = 'voice') => {
    if (callSocketRef.current) {
      setCallState(prev => ({ ...prev, callStatus: 'connecting' }));
      await callSocketRef.current.acceptCall(callId, type);
    }
  };

  const declineCall = (callId: string) => {
    if (callSocketRef.current) {
      callSocketRef.current.declineCall(callId);
    }
    setCallState(prev => ({ 
      ...prev, 
      incomingCall: null,
      callStatus: 'idle'
    }));
  };

  const endCall = () => {
    if (callSocketRef.current) {
      callSocketRef.current.endCall();
    }
  };

  const toggleAudio = (): boolean => {
    if (callSocketRef.current) {
      const enabled = callSocketRef.current.toggleAudio();
      setCallState(prev => ({ ...prev, audioEnabled: enabled }));
      return enabled;
    }
    return false;
  };

  const toggleVideo = (): boolean => {
    if (callSocketRef.current) {
      const enabled = callSocketRef.current.toggleVideo();
      setCallState(prev => ({ ...prev, videoEnabled: enabled }));
      return enabled;
    }
    return false;
  };

  const startScreenShare = async (): Promise<boolean> => {
    if (callSocketRef.current) {
      const success = await callSocketRef.current.startScreenShare();
      setCallState(prev => ({ ...prev, isScreenSharing: success }));
      return success;
    }
    return false;
  };

  const stopScreenShare = async (): Promise<void> => {
    if (callSocketRef.current) {
      await callSocketRef.current.stopScreenShare();
      setCallState(prev => ({ ...prev, isScreenSharing: false }));
    }
  };

  const setVideoElements = (localVideo: HTMLVideoElement, remoteVideo: HTMLVideoElement) => {
    if (callSocketRef.current) {
      callSocketRef.current.setVideoElements(localVideo, remoteVideo);
    }
  };

  return {
    ...callState,
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    setVideoElements
  };
};

export default CallSocket;