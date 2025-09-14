// src/components/DirectMessages.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { 
  MessageCircle, 
  Send, 
  MoreVertical,
  Phone,
  Video,
  Pin,
  Bell
} from "lucide-react";
import useSocket from '../hooks/useSocket';
import axios from 'axios';

interface User {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  status?: 'ONLINE' | 'IDLE' | 'DO_NOT_DISTURB' | 'OFFLINE';
  bio?: string
}

interface DirectMessage {
  id: string;
  content: string;
  authorId: string;
  targetId: string;
  createdAt: string;
  author: User;
}

// Define the prop interface correctly
interface DirectMessagesProps {
  onSelectUser: (user: User) => void; // This might be used if DirectMessages internally manages user selection, but likely not needed if DiscordClone handles it
  currentUser: User | null;
  selectedUser: User | null; // Receive the selected user from DiscordClone
  socket: any; // Consider typing this properly if possible
}

export default function DirectMessages({ currentUser, selectedUser }: DirectMessagesProps) {
  const { socket, isConnected } = useSocket(); // Get socket from hook
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load conversation messages when selectedUser changes
  useEffect(() => {
    const loadConversation = async () => {
      if (!selectedUser) {
        setMessages([]);
        return;
      }

      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setMessages([]);
          return;
        }

        // Assuming your API endpoint is like this. Adjust if needed.
        const res = await axios.get<DirectMessage[]>(`http://localhost:3000/api/dms/${selectedUser.id}/messages`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        setMessages(res.data);
      } catch (error) {
        console.error('Failed to load conversation:', error);
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadConversation();
  }, [selectedUser]); // Dependency array includes selectedUser

  // Socket event listeners
  useEffect(() => {
    if (!socket || !selectedUser || !currentUser) return;

    const handleDirectMessageReceived = (message: DirectMessage) => {
      // Ensure the message is relevant to the current conversation
      // Check if the message is between the current user and the selected user
      const isRelevant =
        (message.authorId === currentUser.id && message.targetId === selectedUser.id) ||
        (message.authorId === selectedUser.id && message.targetId === currentUser.id);

      if (isRelevant) {
        setMessages(prev => [...prev, message]);
      }
    };

    // Listen for new messages
    socket.on('direct_message_received', handleDirectMessageReceived);
    // Optionally listen for sent confirmations if your backend emits them
    // socket.on('direct_message_sent', handleDirectMessageReceived); 

    // Cleanup listener on unmount or when dependencies change
    return () => {
      socket.off('direct_message_received', handleDirectMessageReceived);
      // socket.off('direct_message_sent', handleDirectMessageReceived);
    };
  }, [socket, selectedUser, currentUser]); // Dependencies include socket, selectedUser, currentUser

  // Send direct message
const handleSendMessage = () => {
  if (!newMessage.trim() || !selectedUser || !socket || !isConnected || !currentUser) return;

  const messageData: DirectMessage = {
    id: crypto.randomUUID(), // temp id
    content: newMessage.trim(),
    authorId: currentUser.id,
    targetId: selectedUser.id,
    createdAt: new Date().toISOString(),
    author: currentUser
  };

  // Show message immediately
  setMessages(prev => [...prev, messageData]);

  // Send to backend
  socket.emit('send_direct_message', {
    targetId: selectedUser.id,
    content: newMessage.trim(),
  });

  setNewMessage('');
};


  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'ONLINE': return 'bg-green-400';
      case 'IDLE': return 'bg-yellow-400';
      case 'DO_NOT_DISTURB': return 'bg-red-400';
      default: return 'bg-gray-400';
    }
  };

  // If no user is selected, show a placeholder
  if (!selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#36393f]">
        <div className="text-center">
          <MessageCircle className="h-16 w-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Select a friend to start messaging</h3>
          <p className="text-gray-400">Choose a friend from your list to begin a conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#36393f]">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="h-12 bg-[#36393f] border-b border-[#202225] flex items-center justify-between px-4">
          <div className="flex items-center">
            <div className="relative">
              <Avatar className="h-8 w-8">
                <AvatarImage src={selectedUser.avatar || `https://api.dicebear.com/6.x/bottts/svg?seed=${selectedUser.username}`} />
                <AvatarFallback>{selectedUser.username[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#36393f] ${getStatusColor(selectedUser.status)}`} />
            </div>
            <span className="ml-2 text-white font-medium">{selectedUser.displayName || selectedUser.username}</span>
            <span className="ml-2 text-gray-400 text-sm capitalize">
              {selectedUser.status?.toLowerCase().replace('_', ' ')}
            </span>
          </div>
          <div className="flex space-x-2">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <Video className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <Pin className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#36393f]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-400">Loading messages...</div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map(message => (
                <div key={message.id} className="flex items-start">
                  <Avatar className="h-10 w-10 mr-3 flex-shrink-0">
                    <AvatarImage src={message.author.avatar || `https://api.dicebear.com/6.x/bottts/svg?seed=${message.author.username}`} />
                    <AvatarFallback>{message.author.username[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0"> {/* Added min-w-0 for content truncation */}
                    <div className="flex items-baseline">
                      <span className="font-semibold text-white mr-2">{message.author.displayName || message.author.username}</span>
                      <span className="text-xs text-gray-400 whitespace-nowrap"> {/* Prevent timestamp wrapping */}
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-gray-300 break-words"> {/* Allow content to break words */}
                      {message.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="p-4 bg-[#36393f]">
          <div className="flex items-center bg-[#40444b] rounded-lg">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={`Message ${selectedUser.displayName || selectedUser.username}`}
              className="flex-1 bg-transparent border-0 text-white placeholder-gray-400 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={!isConnected}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || !isConnected}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {!isConnected && (
             <div className="text-xs text-red-400 mt-1">
               Disconnected - messages cannot be sent
             </div>
           )}
        </div>
      </div>

      {/* User Profile Card - Only shown when a user is selected */}
      {selectedUser && (
        <div className="w-60 bg-[#2f3136] flex flex-col border-l border-[#202225]"> {/* Added border for separation */}
          {/* Banner */}
          <div className="h-24 bg-[#b54782] relative"> {/* You might want to make this dynamic or use a default color */}
            <div className="absolute -bottom-8 left-4">
              <Avatar className="h-16 w-16 border-4 border-[#2f3136] rounded-full">
                <AvatarImage src={selectedUser.avatar || `https://api.dicebear.com/6.x/bottts/svg?seed=${selectedUser.username}`} />
                <AvatarFallback>{selectedUser.username[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
            </div>
          </div>

          {/* User Info */}
          <div className="p-4 mt-10"> {/* Adjusted margin-top to account for avatar overlap */}
            <h2 className="text-lg font-bold text-white">{selectedUser.username}</h2>
            <p className="text-sm text-gray-400">{selectedUser.displayName}</p>

            {/* Status */}
            <div className="mt-4 text-sm">
              <p className="font-semibold text-gray-300">Status</p>
              <div className="flex items-center mt-1">
                <div className={`w-3 h-3 rounded-full mr-2 ${getStatusColor(selectedUser.status)}`}></div>
                <span className="text-gray-300 capitalize">
                  {selectedUser.status?.toLowerCase().replace('_', ' ') || 'Unknown'}
                </span>
              </div>
            </div>

            {/* About Me (Placeholder - you'd fetch this from your backend) */}
            <div className="mt-4 text-sm">
              <p className="font-semibold text-gray-300">About Me</p>
              <p className="text-gray-300">{selectedUser.bio}</p>
            </div>

            {/* Member Since (Placeholder) */}
            <div className="mt-4 text-sm">
              <p className="font-semibold text-gray-300">Member Since</p>
              <p className="text-gray-300">12 Jul 2018</p> {/* Replace with actual data */}
            </div>

            
          </div>

         
        </div>
      )}
    </div>
  );
}