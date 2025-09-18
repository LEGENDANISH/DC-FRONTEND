// src/components/CallInterface.tsx
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Volume2,
  Settings,
  Minimize2,
  Maximize2,
  X
} from "lucide-react";
import { useCallSocket } from './UseCallSocket';

interface User {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
}

interface CallInterfaceProps {
  currentUser: User | null;
  isOpen: boolean;
  onClose: () => void;
}

interface IncomingCallProps {
  call: {
    callId: string;
    callerId: string;
    targetUserId: string;
    type: 'voice' | 'video';
    timestamp: number;
    caller?: User;
  };
  onAccept: () => void;
  onDecline: () => void;
}

// Incoming Call Notification Component
const IncomingCallNotification: React.FC<IncomingCallProps> = React.memo(({ 
  call, 
  onAccept, 
  onDecline 
}) => {
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = useCallback((seconds: number) => {
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  }, []);

  const caller = useMemo(() => call.caller || {
    id: call.callerId,
    username: call.callerId,
    displayName: call.callerId
  }, [call.caller, call.callerId]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-[#36393f] rounded-lg p-8 shadow-xl max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <div className="relative mx-auto mb-4 animate-pulse">
            <Avatar className="h-24 w-24 mx-auto">
              <AvatarImage 
                src={caller.avatar || `https://api.dicebear.com/6.x/bottts/svg?seed=${caller.username}`} 
              />
              <AvatarFallback className="text-2xl">
                {caller.username[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 border-4 border-green-400 rounded-full animate-ping"></div>
          </div>
          
          <h2 className="text-xl font-semibold text-white mb-2">
            {caller.displayName || caller.username}
          </h2>
          
          <p className="text-gray-400 mb-1">
            Incoming {call.type} call
          </p>
          
          <p className="text-sm text-gray-500">
            {formatTime(timeElapsed)}
          </p>
        </div>

        <div className="flex justify-center space-x-8">
          <Button
            onClick={onDecline}
            className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 p-0"
          >
            <PhoneOff className="h-8 w-8 text-white" />
          </Button>
          
          <Button
            onClick={onAccept}
            className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600 p-0"
          >
            <Phone className="h-8 w-8 text-white" />
          </Button>
        </div>
      </div>
    </div>
  );
});

IncomingCallNotification.displayName = 'IncomingCallNotification';

// Main Call Interface Component
export default function CallInterface({ currentUser, isOpen, onClose }: CallInterfaceProps) {
  const {
    isConnected,
    activeCall,
    incomingCall,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    remoteParticipantState,
    acceptCall,
    declineCall,
    endCall,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    setVideoElements
  } = useCallSocket({
    userId: currentUser?.id || '',
    onIncomingCall: useCallback((caller, type) => {
      console.log('Incoming call from:', caller, 'type:', type);
    }, []),
    onCallEnded: useCallback((reason) => {
      console.log('Call ended:', reason);
    }, [])
  });

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const [callDuration, setCallDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(100);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);

  // Stable callbacks to prevent re-renders
  const handleAcceptCall = useCallback(async () => {
    if (incomingCall) {
      await acceptCall();
    }
  }, [acceptCall, incomingCall]);

  const handleDeclineCall = useCallback(() => {
    if (incomingCall) {
      declineCall();
    }
  }, [declineCall, incomingCall]);

  const handleEndCall = useCallback(() => {
    endCall();
    onClose();
  }, [endCall, onClose]);

  const handleToggleAudio = useCallback(() => {
    toggleAudio();
  }, [toggleAudio]);

  const handleToggleVideo = useCallback(() => {
    toggleVideo();
  }, [toggleVideo]);

  const handleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [isScreenSharing, stopScreenShare, startScreenShare]);

  // Set video elements when refs are ready
  useEffect(() => {
    if (localVideoRef.current && remoteVideoRef.current) {
      const localVideo = localVideoRef.current;
      const remoteVideo = remoteVideoRef.current;
      
      localVideo.playsInline = true;
      localVideo.muted = true;
      remoteVideo.playsInline = true;
      
      setVideoElements(localVideo, remoteVideo);
      
      const handleLocalMetadata = () => console.log('Local video metadata loaded');
      const handleRemoteMetadata = () => console.log('Remote video metadata loaded');
      
      localVideo.addEventListener('loadedmetadata', handleLocalMetadata);
      remoteVideo.addEventListener('loadedmetadata', handleRemoteMetadata);
      
      return () => {
        localVideo.removeEventListener('loadedmetadata', handleLocalMetadata);
        remoteVideo.removeEventListener('loadedmetadata', handleRemoteMetadata);
      };
    }
  }, [setVideoElements, activeCall?.callId]); // Use callId to detect call changes

  // Track call start time and duration
  useEffect(() => {
    if (activeCall && !callStartTime) {
      setCallStartTime(Date.now());
    } else if (!activeCall) {
      setCallStartTime(null);
      setCallDuration(0);
    }
  }, [activeCall, callStartTime]);

  // Call duration timer
  useEffect(() => {
    if (!activeCall || !callStartTime) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
      setCallDuration(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCall, callStartTime]);

  // Auto-hide controls with stable timeout
  useEffect(() => {
    if (!activeCall || !showControls) return;

    const timeout = setTimeout(() => {
      setShowControls(false);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [showControls, activeCall?.callId]); // Use callId instead of activeCall object

  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const getOtherParticipant = useCallback((): User | null => {
    if (!activeCall || !currentUser) return null;
    
    const otherUserId = activeCall.callerId === currentUser.id 
      ? activeCall.targetUserId 
      : activeCall.callerId;
    
    return {
      id: otherUserId,
      username: otherUserId,
      displayName: otherUserId,
      avatar: undefined
    };
  }, [activeCall, currentUser]);

  const otherParticipant = useMemo(() => getOtherParticipant(), [getOtherParticipant]);

  const handleShowControls = useCallback(() => {
    setShowControls(true);
  }, []);

  const handleControlsMouseEnter = useCallback(() => {
    setShowControls(true);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseInt(e.target.value));
  }, []);

  // Don't render if not connected
  if (!isConnected) return null;

  // Render incoming call notification
  if (incomingCall) {
    return (
      <IncomingCallNotification
        call={incomingCall}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
      />
    );
  }

  // Don't render if no active call and not requested to be open
  if (!activeCall && !isOpen) return null;

  const isVideoCall = activeCall?.type === 'video' || videoEnabled;

  return (
    <div className={`fixed inset-0 bg-black z-50 flex flex-col ${isMinimized ? 'bottom-4 right-4 top-auto left-auto w-80 h-60 rounded-lg' : ''}`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 bg-[#36393f] ${isMinimized ? 'rounded-t-lg' : ''}`}>
        <div className="flex items-center space-x-3">
          {otherParticipant && (
            <>
              <Avatar className="h-8 w-8">
                <AvatarImage 
                  src={otherParticipant.avatar || `https://api.dicebear.com/6.x/bottts/svg?seed=${otherParticipant.username}`} 
                />
                <AvatarFallback>
                  {otherParticipant.username?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-white font-medium">
                  {otherParticipant.displayName || otherParticipant.username}
                </p>
                <p className="text-sm text-gray-400">
                  {activeCall ? formatDuration(callDuration) : 'Connecting...'}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-gray-400 hover:text-white"
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEndCall}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Video Area */}
          <div className="flex-1 relative bg-black">
            {isVideoCall ? (
              <div className="h-full w-full relative">
                {/* Remote Video */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="h-full w-full object-cover"
                />

                {/* Local Video (Picture-in-Picture) */}
                <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Remote participant video status */}
                {!remoteParticipantState.videoEnabled && otherParticipant && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <div className="text-center">
                      <Avatar className="h-32 w-32 mx-auto mb-4">
                        <AvatarImage 
                          src={otherParticipant.avatar || `https://api.dicebear.com/6.x/bottts/svg?seed=${otherParticipant.username}`} 
                        />
                        <AvatarFallback className="text-4xl">
                          {otherParticipant.username?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-white text-lg">
                        {otherParticipant.displayName || otherParticipant.username}
                      </p>
                      <p className="text-gray-400">Camera is off</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Audio Call Interface */
              <div className="h-full flex items-center justify-center bg-gradient-to-br from-indigo-900 to-purple-900">
                {otherParticipant && (
                  <div className="text-center">
                    <div className="relative mb-8">
                      <Avatar className="h-48 w-48 mx-auto">
                        <AvatarImage 
                          src={otherParticipant.avatar || `https://api.dicebear.com/6.x/bottts/svg?seed=${otherParticipant.username}`} 
                        />
                        <AvatarFallback className="text-6xl">
                          {otherParticipant.username?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      {/* Audio indicator */}
                      {remoteParticipantState.audioEnabled && (
                        <div className="absolute inset-0 border-4 border-green-400 rounded-full animate-pulse"></div>
                      )}
                    </div>
                    
                    <h2 className="text-3xl font-bold text-white mb-2">
                      {otherParticipant.displayName || otherParticipant.username}
                    </h2>
                    
                    <p className="text-xl text-gray-300">
                      {activeCall ? formatDuration(callDuration) : 'Connecting...'}
                    </p>

                    {!remoteParticipantState.audioEnabled && (
                      <p className="text-red-400 mt-2">Microphone is off</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Controls Overlay */}
            {(showControls || !activeCall) && (
              <div 
                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-6"
                onMouseEnter={handleControlsMouseEnter}
              >
                <div className="flex items-center justify-center space-x-4">
                  {/* Mute/Unmute */}
                  <Button
                    onClick={handleToggleAudio}
                    className={`h-14 w-14 rounded-full ${
                      audioEnabled 
                        ? 'bg-gray-600 hover:bg-gray-700' 
                        : 'bg-red-500 hover:bg-red-600'
                    }`}
                  >
                    {audioEnabled ? (
                      <Mic className="h-6 w-6 text-white" />
                    ) : (
                      <MicOff className="h-6 w-6 text-white" />
                    )}
                  </Button>

                  {/* Video Toggle */}
                  <Button
                    onClick={handleToggleVideo}
                    className={`h-14 w-14 rounded-full ${
                      videoEnabled 
                        ? 'bg-gray-600 hover:bg-gray-700' 
                        : 'bg-red-500 hover:bg-red-600'
                    }`}
                  >
                    {videoEnabled ? (
                      <Video className="h-6 w-6 text-white" />
                    ) : (
                      <VideoOff className="h-6 w-6 text-white" />
                    )}
                  </Button>

                  {/* Screen Share */}
                  <Button
                    onClick={handleScreenShare}
                    className={`h-14 w-14 rounded-full ${
                      isScreenSharing 
                        ? 'bg-blue-500 hover:bg-blue-600' 
                        : 'bg-gray-600 hover:bg-gray-700'
                    }`}
                  >
                    {isScreenSharing ? (
                      <MonitorOff className="h-6 w-6 text-white" />
                    ) : (
                      <Monitor className="h-6 w-6 text-white" />
                    )}
                  </Button>

                  {/* Settings */}
                  <Button
                    variant="ghost"
                    className="h-14 w-14 rounded-full bg-gray-600 hover:bg-gray-700"
                  >
                    <Settings className="h-6 w-6 text-white" />
                  </Button>

                  {/* End Call */}
                  <Button
                    onClick={handleEndCall}
                    className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600"
                  >
                    <PhoneOff className="h-6 w-6 text-white" />
                  </Button>
                </div>

                {/* Volume Control */}
                <div className="flex items-center justify-center mt-4 space-x-2">
                  <Volume2 className="h-4 w-4 text-gray-400" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-24 accent-blue-500"
                  />
                  <span className="text-sm text-gray-400">{volume}%</span>
                </div>
              </div>
            )}

            {/* Call Status Indicators */}
            <div className="absolute top-4 left-4 space-y-2">
              {!audioEnabled && (
                <div className="bg-red-500 text-white px-2 py-1 rounded text-xs">
                  Muted
                </div>
              )}
              {isScreenSharing && (
                <div className="bg-blue-500 text-white px-2 py-1 rounded text-xs">
                  Sharing Screen
                </div>
              )}
              {!isConnected && (
                <div className="bg-yellow-500 text-black px-2 py-1 rounded text-xs">
                  Reconnecting...
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Minimized View */}
      {isMinimized && (
        <div className="flex-1 bg-[#2f3136] rounded-b-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              <Button
                onClick={handleToggleAudio}
                size="sm"
                className={`${
                  audioEnabled 
                    ? 'bg-gray-600 hover:bg-gray-700' 
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {audioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
              
              <Button
                onClick={handleEndCall}
                size="sm"
                className="bg-red-500 hover:bg-red-600"
              >
                <PhoneOff className="h-4 w-4" />
              </Button>
            </div>
            
            {isVideoCall && (
              <div className="w-20 h-12 bg-gray-800 rounded overflow-hidden">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click handler to show controls */}
      {!showControls && activeCall && !isMinimized && (
        <div 
          className="absolute inset-0 cursor-pointer"
          onClick={handleShowControls}
        />
      )}
    </div>
  );
}