// hooks/useSocket.ts
import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001'; // Match your backend URL

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No token found for socket connection');
      setError('Authentication required for real-time features');
      return;
    }

    // Initialize Socket.IO connection with auth token
    socketRef.current = io(SOCKET_URL, {
      auth: {
        token: `Bearer ${token}`,
      },
      transports: ['websocket', 'polling'], // Match backend transports if specified
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Connected to WebSocket');
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected from WebSocket:', reason);
      setIsConnected(false);
      // Reconnect manually if needed based on reason, or let Socket.IO handle it
    });

    socket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err);
      setError(`Connection failed: ${err.message}`);
      setIsConnected(false);
    });

    // Listen for general errors
    socket.on('error', (data) => {
      console.error('WebSocket error received:', data);
      setError(data.message || 'An error occurred with the real-time connection.');
    });

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.disconnect();
        socket.removeAllListeners(); // Clean up listeners
      }
      socketRef.current = null;
      setIsConnected(false);
    };
  }, []); // Run only once on mount

  const joinChannel = (channelId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join_channel', channelId);
      console.log(`Emitted join_channel for ${channelId}`);
    } else {
      console.warn('Cannot join channel: Socket not connected');
    }
  };

  const leaveChannel = (channelId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave_channel', channelId);
      console.log(`Emitted leave_channel for ${channelId}`);
    } else {
      console.warn('Cannot leave channel: Socket not connected');
    }
  };

  const sendMessage = (data: { channelId: string; content: string; replyToId?: string }) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('message', data);
      console.log(`Emitted message to ${data.channelId}`);
    } else {
      console.warn('Cannot send message: Socket not connected');
    }
  };

  // Expose the socket instance directly if needed for other events
  const getSocket = () => socketRef.current;

  return {
    socket: socketRef.current,
    isConnected,
    error,
    joinChannel,
    leaveChannel,
    sendMessage,
    getSocket,
  };
};

export default useSocket;