import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000';

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  error: string | null;
  joinChannel: (channelId: string) => void;
  leaveChannel: (channelId: string) => void;
  sendMessage: (data: { channelId: string; content: string; replyToId?: string }) => void;
  joinServer: (serverId: string) => void;
  leaveServer: (serverId: string) => void;
  sendDirectMessage: (data: { targetId: string; content: string }) => void;
  sendFriendRequest: (username: string) => void;
  respondToFriendRequest: (requestId: string, accept: boolean) => void;
  removeFriend: (friendId: string) => void;
}

export const useSocket = (): UseSocketReturn => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No token found for socket connection');
      setError('Authentication required for real-time features');
      return;
    }

    const connectSocket = () => {
      // Clean up existing connection
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current.removeAllListeners();
      }

      console.log('Connecting to WebSocket server...');
      
      // Initialize Socket.IO connection
      socketRef.current = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        forceNew: true,
        transports: ['websocket', 'polling']
      });

      const socket = socketRef.current;

      socket.on('connect', () => {
        console.log('Connected to WebSocket server with ID:', socket.id);
        setIsConnected(true);
        setError(null);
        
        // Clear any pending reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        // Start heartbeat to keep connection alive
        heartbeatIntervalRef.current = setInterval(() => {
          if (socket.connected) {
            socket.emit('ping');
          }
        }, 25000);
      });

      socket.on('disconnect', (reason) => {
        console.log('Disconnected from WebSocket server:', reason);
        setIsConnected(false);
        
        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        
        // If disconnect was unexpected, try to reconnect
        if (reason === 'io server disconnect') {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (localStorage.getItem('token')) {
              connectSocket();
            }
          }, 2000);
        }
      });

      socket.on('connect_error', (err) => {
        console.error('WebSocket connection error:', err);
        setError(err.message || 'Connection error');
        setIsConnected(false);
        
        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        
        // If authentication failed, don't retry automatically
        if (err.message.includes('Authentication error') || err.message.includes('Unauthorized')) {
          setError('Authentication failed. Please try logging in again.');
          return;
        }
        
        // Retry connection after a delay for other errors
        reconnectTimeoutRef.current = setTimeout(() => {
          if (localStorage.getItem('token')) {
            connectSocket();
          }
        }, 3000);
      });

      socket.on('error', (data) => {
        console.error('Socket error:', data);
        setError(data.message || 'Socket error occurred');
      });

      socket.on('ready', (data) => {
        console.log('Socket ready event received:', data);
        setError(null);
      });

      // Handle reconnection
      socket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected to WebSocket server after', attemptNumber, 'attempts');
        setIsConnected(true);
        setError(null);
      });

      socket.on('reconnect_error', (err) => {
        console.error('Reconnection error:', err);
        setError('Failed to reconnect to server');
      });

      socket.on('reconnect_failed', () => {
        console.error('Failed to reconnect to WebSocket server');
        setError('Unable to connect to server. Please refresh the page.');
        setIsConnected(false);
      });

      // Friend-related events
      socket.on('friends_initial_data', (data) => {
        console.log('Friends initial data received:', data);
      });

      socket.on('friend_request_received', (request) => {
        console.log('Friend request received:', request);
      });

      socket.on('friend_request_accepted', (data) => {
        console.log('Friend request accepted:', data);
      });

      socket.on('friend_added', (data) => {
        console.log('Friend added:', data);
      });

      socket.on('friend_removed', (data) => {
        console.log('Friend removed:', data);
      });

      socket.on('friend_request_rejected', (data) => {
        console.log('Friend request rejected:', data);
      });

      socket.on('friend_status_update', (data) => {
        console.log('Friend status update:', data);
      });

      // Direct message events
      socket.on('direct_message_received', (message) => {
        console.log('Direct message received:', message);
      });

      socket.on('direct_message_sent', (message) => {
        console.log('Direct message sent:', message);
      });

      socket.on('dm_typing_start', (data) => {
        console.log('DM typing start:', data);
      });

      socket.on('dm_typing_stop', (data) => {
        console.log('DM typing stop:', data);
      });
    };

    // Initial connection
    connectSocket();

    // Listen for token changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        if (e.newValue) {
          connectSocket();
        } else {
          if (socketRef.current) {
            socketRef.current.disconnect();
            setIsConnected(false);
            setError('Logged out');
          }
          
          // Clear intervals
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
          }
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current.removeAllListeners();
      }
      socketRef.current = null;
      setIsConnected(false);
    };
  }, []);

  // Channel operations
  const joinChannel = useCallback((channelId: string) => {
    if (socketRef.current?.connected) {
      console.log('Joining channel:', channelId);
      socketRef.current.emit('join_channel', channelId);
    } else {
      console.warn('Cannot join channel - socket not connected');
    }
  }, []);

  const leaveChannel = useCallback((channelId: string) => {
    if (socketRef.current?.connected) {
      console.log('Leaving channel:', channelId);
      socketRef.current.emit('leave_channel', channelId);
    }
  }, []);

  // Message operations
  const sendMessage = useCallback((data: { channelId: string; content: string; replyToId?: string }) => {
    if (socketRef.current?.connected) {
      console.log('Sending message via socket:', data);
      socketRef.current.emit('message', data);
    } else {
      console.warn('Cannot send message - socket not connected');
    }
  }, []);

  // Server operations
  const joinServer = useCallback((serverId: string) => {
    if (socketRef.current?.connected) {
      console.log('Joining server:', serverId);
      socketRef.current.emit('join_server', serverId);
    } else {
      console.warn('Cannot join server - socket not connected');
    }
  }, []);

  const leaveServer = useCallback((serverId: string) => {
    if (socketRef.current?.connected) {
      console.log('Leaving server:', serverId);
      socketRef.current.emit('leave_server', serverId);
    }
  }, []);

  // Direct message operations
  const sendDirectMessage = useCallback((data: { targetId: string; content: string }) => {
    if (socketRef.current?.connected) {
      console.log('Sending direct message via socket:', data);
      socketRef.current.emit('send_direct_message', data);
    } else {
      console.warn('Cannot send direct message - socket not connected');
    }
  }, []);

  // Friend operations
  const sendFriendRequest = useCallback((username: string) => {
    if (socketRef.current?.connected) {
      console.log('Sending friend request via socket:', username);
      socketRef.current.emit('send_friend_request', { username });
    } else {
      console.warn('Cannot send friend request - socket not connected');
    }
  }, []);

  const respondToFriendRequest = useCallback((requestId: string, accept: boolean) => {
    if (socketRef.current?.connected) {
      console.log('Responding to friend request via socket:', requestId, accept);
      socketRef.current.emit('respond_friend_request', { requestId, accept });
    } else {
      console.warn('Cannot respond to friend request - socket not connected');
    }
  }, []);

  const removeFriend = useCallback((friendId: string) => {
    if (socketRef.current?.connected) {
      console.log('Removing friend via socket:', friendId);
      socketRef.current.emit('remove_friend', { friendId });
    } else {
      console.warn('Cannot remove friend - socket not connected');
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    error,
    joinChannel,
    leaveChannel,
    sendMessage,
    joinServer,
    leaveServer,
    sendDirectMessage,
    sendFriendRequest,
    respondToFriendRequest,
    removeFriend
  };
};

export default useSocket;