import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000';

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

    // Initialize Socket.IO connection
    socketRef.current = io(SOCKET_URL, {
      auth: { token }, // 👈 send token without 'Bearer'
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Connected to WebSocket');
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err);
      setError(err.message);
      setIsConnected(false);
    });

    socket.on('error', (data) => {
      console.error('Socket error:', data);
      setError(data.message || 'Socket error');
    });

    return () => {
      if (socket) {
        socket.disconnect();
        socket.removeAllListeners();
      }
      socketRef.current = null;
      setIsConnected(false);
    };
  }, []);

  const joinChannel = (channelId: string) => {
    if (socketRef.current?.connected) socketRef.current.emit('join_channel', channelId);
  };

  const leaveChannel = (channelId: string) => {
    if (socketRef.current?.connected) socketRef.current.emit('leave_channel', channelId);
  };

  const sendMessage = (data: { channelId: string; content: string; replyToId?: string }) => {
    if (socketRef.current?.connected) socketRef.current.emit('message', data);
  };

  return {
    socket: socketRef.current,
    isConnected,
    error,
    joinChannel,
    leaveChannel,
    sendMessage
  };
};

export default useSocket;
