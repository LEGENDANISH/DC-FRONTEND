import React, { useEffect, useRef, useState } from 'react';
import { useCallSocket } from '../hooks/useCallSocket';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Monitor, MonitorOff, PhoneCall, Users, X } from 'lucide-react';

// Types for the component props
interface CallInterfaceProps {
  targetUserId?: string | null;
  targetUsername?: string;
  targetDisplayName?: string;
  targetAvatar?: string;
  callType?: 'voice' | 'video';
  isOpen: boolean;
  onClose: () => void;
  onCallTypeChange?: (type: 'voice' | 'video') => void;
  // Alternative prop structure for current user
  currentUser?: {
    id: string;
    username?: string;
    displayName?: string;
    avatar?: string;
  };
}

// Notification component for incoming calls
interface IncomingCallNotificationProps {
  caller: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
  callType: 'voice' | 'video';
  onAccept: () => void;
  onDecline: () => void;
}

const IncomingCallNotification: React.FC<IncomingCallNotificationProps> = ({
  caller,
  callType,
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center">
          {/* Avatar */}
          <div className="mb-4">
            {caller.avatar ? (
              <img
                src={caller.avatar}
                alt={caller.displayName || caller.username}
                className="w-20 h-20 rounded-full mx-auto object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full mx-auto bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                {(caller.displayName || caller.username).charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Caller Info */}
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {caller.displayName || caller.username}
          </h3>
          
          {/* Call Type */}
          <div className="flex items-center justify-center mb-4">
            {callType === 'video' ? (
              <Video className="w-5 h-5 text-green-500 mr-2" />
            ) : (
              <Phone className="w-5 h-5 text-green-500 mr-2" />
            )}
            <span className="text-gray-600">
              Incoming {callType} call
            </span>
          </div>

          {/* Timer */}
          <div className="text-sm text-gray-500 mb-6">
            Ringing for {Math.floor(timeElapsed / 60)}:{(timeElapsed % 60).toString().padStart(2, '0')}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={onDecline}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full flex items-center justify-center transition-colors"
            >
              <PhoneOff className="w-5 h-5 mr-2" />
              Decline
            </button>
            <button
              onClick={onAccept}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full flex items-center justify-center transition-colors"
            >
              <Phone className="w-5 h-5 mr-2" />
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CallInterface: React.FC<CallInterfaceProps> = ({
  targetUserId,
  targetUsername,
  targetDisplayName,
  targetAvatar,
  callType: initialCallType = 'voice',
  isOpen,
  onClose,
  onCallTypeChange,
  currentUser
}) => {
  // Use currentUser props if targetUser props are not provided
  const actualTargetUserId = targetUserId || currentUser?.id;
  const actualTargetUsername = targetUsername || currentUser?.username;
  const actualTargetDisplayName = targetDisplayName || currentUser?.displayName;
  const actualTargetAvatar = targetAvatar || currentUser?.avatar;
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const {
    isConnected,
    activeCall,
    incomingCall,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    remoteParticipantState,
    callStatus,
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    setVideoElements
  } = useCallSocket();

  const [currentCallType, setCurrentCallType] = useState<'voice' | 'video'>(initialCallType);
  const [callDuration, setCallDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Set video elements when refs are available
  useEffect(() => {
    if (localVideoRef.current && remoteVideoRef.current) {
      setVideoElements(localVideoRef.current, remoteVideoRef.current);
    }
  }, [setVideoElements, activeCall]);

  // Handle call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (callStatus === 'active') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStatus]);

  // Auto-hide controls during active call
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    if (callStatus === 'active' && showControls) {
      timeout = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [callStatus, showControls]);

  // Handle call type changes
  useEffect(() => {
    setCurrentCallType(initialCallType);
  }, [initialCallType]);

  // Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle incoming call accept
  const handleAcceptIncomingCall = async () => {
    if (incomingCall) {
      try {
        setError(null);
        await acceptCall(incomingCall.callId, incomingCall.type);
        setCurrentCallType(incomingCall.type);
      } catch (err) {
        setError('Failed to accept call');
        console.error('Accept call error:', err);
      }
    }
  };

  // Handle incoming call decline
  const handleDeclineIncomingCall = () => {
    if (incomingCall) {
      declineCall(incomingCall.callId);
    }
  };

  // Handle outgoing call initiation
  const handleInitiateCall = async () => {
    if (!actualTargetUserId) return;
    
    try {
      setError(null);
      await initiateCall(actualTargetUserId, currentCallType);
    } catch (err) {
      setError('Failed to start call');
      console.error('Initiate call error:', err);
    }
  };

  // Handle call type switch during active call
  const handleCallTypeSwitch = async (newType: 'voice' | 'video') => {
    if (newType === currentCallType) return;
    
    setCurrentCallType(newType);
    onCallTypeChange?.(newType);
    
    if (newType === 'video') {
      await toggleVideo();
    } else {
      // Turn off video for voice call
      if (videoEnabled) {
        await toggleVideo();
      }
    }
  };

  // Handle end call
  const handleEndCall = () => {
    endCall();
    onClose();
  };

  // Handle screen sharing toggle
  const handleScreenShareToggle = async () => {
    try {
      if (isScreenSharing) {
        await stopScreenShare();
      } else {
        const success = await startScreenShare();
        if (!success) {
          setError('Failed to start screen sharing');
        }
      }
    } catch (err) {
      setError('Screen sharing error');
      console.error('Screen share error:', err);
    }
  };

  // Show mouse cursor on mouse move
  const handleMouseMove = () => {
    setShowControls(true);
  };

  if (!isOpen) return null;

  // Render incoming call notification
  if (incomingCall) {
    return (
      <IncomingCallNotification
        caller={incomingCall.caller!}
        callType={incomingCall.type}
        onAccept={handleAcceptIncomingCall}
        onDecline={handleDeclineIncomingCall}
      />
    );
  }

  return (
    <div 
      className={`fixed inset-0 bg-gray-900 z-40 flex flex-col ${
        callStatus === 'active' ? 'cursor-none' : ''
      }`}
      onMouseMove={handleMouseMove}
    >
      {/* Header */}
      <div className={`bg-gray-800 text-white p-4 flex items-center justify-between transition-opacity duration-300 ${
        callStatus === 'active' && !showControls ? 'opacity-0' : 'opacity-100'
      }`}>
        <div className="flex items-center space-x-3">
          {/* Target User Info */}
          {actualTargetAvatar ? (
            <img
              src={actualTargetAvatar}
              alt={actualTargetDisplayName || actualTargetUsername}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
              {(actualTargetDisplayName || actualTargetUsername || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="font-semibold">
              {actualTargetDisplayName || actualTargetUsername || 'Unknown User'}
            </h3>
            <div className="flex items-center space-x-2 text-sm text-gray-300">
              <div className={`w-2 h-2 rounded-full ${
                callStatus === 'active' ? 'bg-green-500' : 
                callStatus === 'ringing' ? 'bg-yellow-500' : 
                callStatus === 'connecting' ? 'bg-blue-500' : 'bg-gray-500'
              }`} />
              <span>
                {callStatus === 'active' ? formatDuration(callDuration) :
                 callStatus === 'ringing' ? 'Ringing...' :
                 callStatus === 'connecting' ? 'Connecting...' :
                 callStatus === 'ended' ? 'Call ended' : 'Ready to call'}
              </span>
            </div>
          </div>
        </div>

        {/* Call Type Switcher (only when not in active call) */}
        {callStatus === 'idle' && (
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => handleCallTypeSwitch('voice')}
              className={`px-3 py-1 rounded-md flex items-center space-x-2 transition-colors ${
                currentCallType === 'voice' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'
              }`}
            >
              <Phone className="w-4 h-4" />
              <span>Voice</span>
            </button>
            <button
              onClick={() => handleCallTypeSwitch('video')}
              className={`px-3 py-1 rounded-md flex items-center space-x-2 transition-colors ${
                currentCallType === 'video' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Video</span>
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-600 text-white px-4 py-2 text-center">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-200 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {/* Video Area */}
      <div className="flex-1 relative bg-black">
        {(currentCallType === 'video' || isScreenSharing) && callStatus !== 'idle' ? (
          <>
            {/* Remote Video (Main) */}
            <video
              ref={remoteVideoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted={false}
            />
            
            {/* Local Video (Picture-in-Picture) */}
            <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden shadow-lg">
              <video
                ref={localVideoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
            </div>
          </>
        ) : (
          /* Voice Call or Idle State */
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-white">
              {callStatus === 'idle' ? (
                <div>
                  <PhoneCall className="w-24 h-24 mx-auto mb-6 text-gray-400" />
                  <h2 className="text-2xl font-semibold mb-4">
                    Ready to call {actualTargetDisplayName || actualTargetUsername}
                  </h2>
                  <p className="text-gray-400 mb-6">
                    Choose voice or video call and press the call button
                  </p>
                </div>
              ) : (
                <div>
                  {actualTargetAvatar ? (
                    <img
                      src={actualTargetAvatar}
                      alt={actualTargetDisplayName || actualTargetUsername}
                      className="w-32 h-32 rounded-full mx-auto mb-6 object-cover"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full mx-auto mb-6 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold">
                      {(actualTargetDisplayName || actualTargetUsername || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <h2 className="text-2xl font-semibold mb-2">
                    {actualTargetDisplayName || actualTargetUsername}
                  </h2>
                  <p className="text-gray-400">
                    {callStatus === 'active' ? `${currentCallType} call - ${formatDuration(callDuration)}` :
                     callStatus === 'ringing' ? `${currentCallType} call - Ringing...` :
                     callStatus === 'connecting' ? 'Connecting...' : ''}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Participant State Indicator */}
        {remoteParticipantState && callStatus === 'active' && (
          <div className="absolute bottom-20 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded-lg">
            <div className="flex items-center space-x-2 text-sm">
              {remoteParticipantState.audioEnabled ? (
                <Mic className="w-4 h-4 text-green-500" />
              ) : (
                <MicOff className="w-4 h-4 text-red-500" />
              )}
              {remoteParticipantState.videoEnabled ? (
                <Video className="w-4 h-4 text-green-500" />
              ) : (
                <VideoOff className="w-4 h-4 text-gray-500" />
              )}
              <span>{actualTargetDisplayName || actualTargetUsername}</span>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className={`bg-gray-800 p-6 transition-opacity duration-300 ${
        callStatus === 'active' && !showControls ? 'opacity-0' : 'opacity-100'
      }`}>
        <div className="flex items-center justify-center space-x-4">
          {callStatus === 'idle' ? (
            /* Initial Call Button */
            <button
              onClick={handleInitiateCall}
              disabled={!actualTargetUserId || !isConnected}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-8 py-3 rounded-full flex items-center space-x-2 transition-colors"
            >
              {currentCallType === 'video' ? (
                <Video className="w-5 h-5" />
              ) : (
                <Phone className="w-5 h-5" />
              )}
              <span>Start {currentCallType} call</span>
            </button>
          ) : (
            /* Active Call Controls */
            <>
              {/* Audio Toggle */}
              <button
                onClick={toggleAudio}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                  audioEnabled 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                {audioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              </button>

              {/* Video Toggle */}
              <button
                onClick={toggleVideo}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                  videoEnabled 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                {videoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              </button>

              {/* Screen Share Toggle */}
              {callStatus === 'active' && (
                <button
                  onClick={handleScreenShareToggle}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                    isScreenSharing 
                      ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  }`}
                >
                  {isScreenSharing ? <MonitorOff className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
                </button>
              )}

              {/* End Call */}
              <button
                onClick={handleEndCall}
                className="bg-red-500 hover:bg-red-600 text-white w-14 h-14 rounded-full flex items-center justify-center transition-colors"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </>
          )}
        </div>

        {/* Connection Status */}
        {!isConnected && (
          <div className="text-center mt-4">
            <span className="text-yellow-500 text-sm">Connecting to call service...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallInterface;