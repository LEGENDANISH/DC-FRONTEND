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
// Improve ICE configuration
private pcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' }
  ],
  iceCandidatePoolSize: 10
};

// Improve peer connection setup


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
 // In CallSocket class, improve initializeMedia method
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

    // Request permissions explicitly
// ✅ Reuse local stream if already initialized
if (this.localStream) {
  return this.localStream;
}

this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Immediately attach to video element if available
    if (this.localVideo && this.localStream) {
      this.localVideo.srcObject = this.localStream;
      // Ensure video plays
      try {
        await this.localVideo.play();
      } catch (playError) {
        console.warn('Auto-play failed:', playError);
      }
    }

    return this.localStream;
  } catch (error) {
    console.error('Media access error:', error);
    // Handle specific error types
    if (error.name === 'NotAllowedError') {
      throw new Error('Media permissions denied. Please allow camera/microphone access.');
    }
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

// Add permission checking
async checkMediaPermissions(): Promise<{ audio: boolean, video: boolean }> {
  try {
    const permissions = await Promise.all([
      navigator.permissions.query({ name: 'microphone' as PermissionName }),
      navigator.permissions.query({ name: 'camera' as PermissionName })
    ]);
    
    return {
      audio: permissions[0].state === 'granted',
      video: permissions[1].state === 'granted'
    };
  } catch (error) {
    console.warn('Permission check not supported:', error);
    return { audio: false, video: false };
  }
}


toggleAudio(): boolean {
  try {
    if (!this.localStream) {
      console.warn('No local stream available for audio toggle');
      return false;
    }

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (!audioTrack) {
      console.warn('No audio track found');
      return false;
    }

    audioTrack.enabled = !audioTrack.enabled;
    console.log('Audio toggled to:', audioTrack.enabled);
    
    // Notify other participant
    if (this.callId) {
      this.socket?.emit('call_state_update', {
        callId: this.callId,
        audioEnabled: audioTrack.enabled,
        videoEnabled: this.getVideoEnabled()
      });
    }
    
    return audioTrack.enabled;
  } catch (error) {
    console.error('Failed to toggle audio:', error);
    return false;
  }
}

async toggleVideo(): Promise<boolean> {
  if (!this.localStream) return false;
  
  const videoTrack = this.localStream.getVideoTracks()[0];
  
  if (videoTrack && videoTrack.enabled) {
    // Stop and remove track
    videoTrack.stop();
    this.localStream.removeTrack(videoTrack);
    
    // Remove from peer connection
    const sender = this.peerConnection?.getSenders().find(s => s.track === videoTrack);
    if (sender) {
      await sender.replaceTrack(null);
    }
    
    return false;
  } else {
    // Add new video track
    const videoStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 }
    });
    
    const newVideoTrack = videoStream.getVideoTracks()[0];
    this.localStream.addTrack(newVideoTrack);
    
    // Add to peer connection
    const sender = this.peerConnection?.getSenders().find(s => !s.track && s.track?.kind === 'video');
    if (sender) {
      await sender.replaceTrack(newVideoTrack);
    } else {
      this.peerConnection?.addTrack(newVideoTrack, this.localStream);
    }
    
    return true;
  }
}
// Add to CallSocket class
debugMediaState(): void {
  console.log('=== Media Debug Info ===');
  console.log('Local stream:', this.localStream);
  console.log('Remote stream:', this.remoteStream);
  console.log('Peer connection:', this.peerConnection?.connectionState);
  
  if (this.localStream) {
    console.log('Local audio tracks:', this.localStream.getAudioTracks().length);
    console.log('Local video tracks:', this.localStream.getVideoTracks().length);
    this.localStream.getAudioTracks().forEach((track, i) => {
      console.log(`Audio track ${i}:`, track.enabled, track.readyState);
    });
    this.localStream.getVideoTracks().forEach((track, i) => {
      console.log(`Video track ${i}:`, track.enabled, track.readyState);
    });
  }
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
    // Check if screen sharing is supported
    if (!navigator.mediaDevices.getDisplayMedia) {
      throw new Error('Screen sharing not supported in this browser');
    }

    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 }
      },
      audio: true
    });

    // Store original video track for restoration
    const originalVideoTrack = this.localStream?.getVideoTracks()[0];
    
    // Replace video track in peer connection
    const videoTrack = screenStream.getVideoTracks()[0];
    const videoSender = this.peerConnection?.getSenders().find(s => 
      s.track && s.track.kind === 'video'
    );

    if (videoSender && videoTrack) {
      await videoSender.replaceTrack(videoTrack);
      console.log('Screen share track replaced successfully');
    } else {
      // If no video sender exists, add the track
      if (this.peerConnection && this.localStream) {
        this.peerConnection.addTrack(videoTrack, this.localStream);
      }
    }

    // Update local video element
    if (this.localVideo) {
      this.localVideo.srcObject = screenStream;
    }

    // Handle screen share ending
    videoTrack.onended = async () => {
      console.log('Screen share ended by user');
      await this.stopScreenShare();
    };

    // Store original track for restoration
    this.originalVideoTrack = originalVideoTrack;

    // Notify other participant
    if (this.callId) {
      this.socket?.emit('screen_share_start', { callId: this.callId });
    }

    return true;
  } catch (error) {
    console.error('Failed to start screen share:', error);
    if (error.name === 'NotAllowedError') {
      throw new Error('Screen sharing permission denied');
    }
    return false;
  }
}

// Add property to store original video track
private originalVideoTrack: MediaStreamTrack | null = null;

async stopScreenShare(): Promise<void> {
  try {
    // Restore original video track
    if (this.originalVideoTrack) {
      const videoSender = this.peerConnection?.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      );

      if (videoSender) {
        await videoSender.replaceTrack(this.originalVideoTrack);
      }

      // Restore local video
      if (this.localVideo && this.localStream) {
        this.localVideo.srcObject = this.localStream;
      }
    }

    // Notify other participant
    if (this.callId) {
      this.socket?.emit('screen_share_stop', { callId: this.callId });
    }

    this.originalVideoTrack = null;
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