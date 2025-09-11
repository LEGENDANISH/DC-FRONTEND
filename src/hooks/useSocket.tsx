import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000'; // Fixed port to match backend

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  error: string | null;
  joinChannel: (channelId: string) => void;
  leaveChannel: (channelId: string) => void;
  sendMessage: (data: { channelId: string; content: string; replyToId?: string }) => void;
  joinServer: (serverId: string) => void;
  leaveServer: (serverId: string) => void;
}

export const useSocket = (): UseSocketReturn => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

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
        auth: { token }, // Send token for authentication
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        forceNew: true
      });

      const socket = socketRef.current;

      socket.on('connect', () => {
        console.log('Connected to WebSocket server');
        setIsConnected(true);
        setError(null);
        
        // Clear any pending reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('Disconnected from WebSocket server:', reason);
        setIsConnected(false);
        
        // If disconnect was unexpected, try to reconnect
        if (reason === 'io server disconnect') {
          // Server disconnected us, try to reconnect after a delay
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
        
        // If authentication failed, don't retry automatically
        if (err.message.includes('Authentication error')) {
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
    };

    // Initial connection
    connectSocket();

    // Listen for token changes (e.g., user logs out and logs back in)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        if (e.newValue) {
          // New token, reconnect
          connectSocket();
        } else {
          // Token removed, disconnect
          if (socketRef.current) {
            socketRef.current.disconnect();
            setIsConnected(false);
            setError('Logged out');
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
      
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current.removeAllListeners();
      }
      socketRef.current = null;
      setIsConnected(false);
    };
  }, []); // Empty dependency array - only run on mount/unmount

  // Memoized helper functions
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

  const sendMessage = useCallback((data: { channelId: string; content: string; replyToId?: string }) => {
    if (socketRef.current?.connected) {
      console.log('Sending message via socket:', data);
      socketRef.current.emit('message', data);
    } else {
      console.warn('Cannot send message - socket not connected');
    }
  }, []);

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

  return {
    socket: socketRef.current,
    isConnected,
    error,
    joinChannel,
    leaveChannel,
    sendMessage,
    joinServer,
    leaveServer
  };
};

export default useSocket;