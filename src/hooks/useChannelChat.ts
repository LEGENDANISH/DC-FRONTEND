// src/hooks/useChannelChat.ts
import { useState, useEffect, useCallback } from 'react';
import useSocket from './useSocket'; // Assuming this is your existing socket hook

// Define the Message interface directly in the hook
interface Message {
  id: string;
  content: string;
  channelId: string;
  author: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
  edited?: boolean;
  isSending?: boolean;
  attachments?: Array<{
    id: string;
    filename: string;
    url: string;
    size: number;
    contentType: string;
  }>;
  replyTo?: Message | null;
}

interface UseChannelChatProps {
  channelId: string | null;
}

interface UseChannelChatReturn {
  messages: Message[];
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  sendMessage: (content: string) => void;
  updateMessage: (messageId: string, content: string) => void;
  deleteMessage: (messageId: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export const useChannelChat = ({ channelId }: UseChannelChatProps): UseChannelChatReturn => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { socket, isConnected, sendMessage: socketSendMessage } = useSocket();

  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      if (!channelId) {
        setMessages([]);
        return;
      }

      setIsLoading(true);
      setError(null);
      
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No authentication token');

        const response = await fetch(
          `http://localhost:3000/api/channels/${channelId}/messages?limit=50`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        if (!response.ok) throw new Error('Failed to fetch messages');
        
        const data: Message[] = await response.json();
        setMessages(data);
      } catch (err: any) {
        console.error('Error fetching messages:', err);
        setError(err.message || 'Failed to load messages');
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [channelId]);

  // Handle real-time socket events
  useEffect(() => {
    if (!socket || !channelId) return;

const handleNewMessage = (message: Message) => {
  if (message.channelId === channelId) {
    setMessages(prev => {
      // If message already exists, replace it instead of appending
      const exists = prev.find(m => m.id === message.id);
      if (exists) {
        return prev.map(m => (m.id === message.id ? message : m));
      }
      return [...prev, message];
    });
  }
};


   const handleMessageUpdate = (message: Message) => {
  if (message.channelId === channelId) {
    setMessages(prev =>
      prev.map(m =>
        m.id === message.id
          ? { ...m, ...message, edited: true } // Force edited flag
          : m
      )
    );
  }
};


    const handleMessageDelete = (data: { messageId: string }) => {
      setMessages(prev =>
        prev.filter(m => m.id !== data.messageId)
      );
    };

    const handleError = (error: { message: string }) => {
      setError(error.message);
    };

    // Register event listeners
    socket.on('message', handleNewMessage);
    socket.on('message_update', handleMessageUpdate);
    socket.on('message_delete', handleMessageDelete);
    socket.on('error', handleError);

    // Cleanup listeners
    return () => {
      socket.off('message', handleNewMessage);
      socket.off('message_update', handleMessageUpdate);
      socket.off('message_delete', handleMessageDelete);
      socket.off('error', handleError);
    };
  }, [socket, channelId]);

  // Join/leave channel rooms
  useEffect(() => {
    if (!socket || !channelId || !isConnected) return;

    // Join channel room
    socket.emit('join_channel', channelId);

    return () => {
      // Leave channel room
      socket.emit('leave_channel', channelId);
    };
  }, [socket, channelId, isConnected]);

  // Send a new message
  const sendMessage = useCallback((content: string) => {
    if (!channelId || !content.trim()) return;
    
    socketSendMessage({ channelId, content });
  }, [channelId, socketSendMessage]);

  // Update an existing message
  const updateMessage = useCallback(async (messageId: string, content: string) => {
    if (!channelId || !messageId || !content.trim()) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token');

      const response = await fetch(
        `http://localhost:3000/api/channels/${channelId}/messages/${messageId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ content })
        }
      );

      if (!response.ok) throw new Error('Failed to update message');
      
      // The update will be reflected via the socket event
    } catch (err: any) {
      console.error('Error updating message:', err);
      setError(err.message || 'Failed to update message');
    }
  }, [channelId]);

  // Delete a message
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!channelId || !messageId) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token');

      const response = await fetch(
        `http://localhost:3000/api/channels/${channelId}/messages/${messageId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to delete message');
      
      // The deletion will be reflected via the socket event
    } catch (err: any) {
      console.error('Error deleting message:', err);
      setError(err.message || 'Failed to delete message');
    }
  }, [channelId]);

  return {
    messages,
    isLoading,
    isConnected,
    error,
    sendMessage,
    updateMessage,
    deleteMessage,
    setMessages // Expose for parent components to reset if needed
  };
};

export default useChannelChat;