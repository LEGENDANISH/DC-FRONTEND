// src/components/DirectMessages.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { useCallSocket } from '../hooks/useCallSocket.js';
import CallInterface from './callUI';
import {
  MessageCircle,
  Send,
  MoreVertical,
  Phone,
  Video,
  Pin,
  Bell,
  Check,
  X,
  Copy,
  Trash2
} from "lucide-react";
import useSocket from '../hooks/useSocket';
import axios from 'axios';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

interface User {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  status?: 'ONLINE' | 'IDLE' | 'DO_NOT_DISTURB' | 'OFFLINE';
  bio?: string;
  createdAt?: string;
}

interface DirectMessage {
  id: string;
  content: string;
  authorId: string;
  targetId: string;
  createdAt: string;
  updatedAt?: string;
  edited?: boolean;
  author: User;
}

interface DirectMessagesProps {
  currentUser: User | null;
  selectedUser: User | null;
}

export default function DirectMessages({ currentUser, selectedUser }: DirectMessagesProps) {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const editInputRef = useRef<HTMLInputElement>(null);


  const [isCallInterfaceOpen, setIsCallInterfaceOpen] = useState(false);
const { initiateCall } = useCallSocket();

  // --- Group messages by date ---
  const groupMessagesByDate = (msgs: DirectMessage[]) => {
    return msgs.reduce((groups: Record<string, DirectMessage[]>, msg) => {
      // Use a consistent date format for grouping (e.g., "Month Day, Year")
      const dateKey = new Date(msg.createdAt).toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(msg);
      return groups;
    }, {});
  };

  // Load conversation
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
  }, [selectedUser]);

  // Focus edit input
  useEffect(() => {
    if (editingMessageId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingMessageId]);

  // Socket listeners
  useEffect(() => {
    if (!socket || !selectedUser || !currentUser) return;

    const handleDirectMessageReceived = (message: DirectMessage) => {
      const isRelevant =
        (message.authorId === currentUser.id && message.targetId === selectedUser.id) ||
        (message.authorId === selectedUser.id && message.targetId === currentUser.id);

      if (isRelevant) {
        setMessages(prev => [...prev, message]);
      }
    };

    const handleDirectMessageUpdated = (updatedMessage: DirectMessage) => {
      const isRelevant =
        (updatedMessage.authorId === currentUser.id && updatedMessage.targetId === selectedUser.id) ||
        (updatedMessage.authorId === selectedUser.id && updatedMessage.targetId === currentUser.id);

      if (isRelevant) {
        setMessages(prev =>
          prev.map(msg => (msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg))
        );
      }
    };

    const handleDirectMessageDeleted = (data: { messageId: string }) => {
      setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
    };

    socket.on('direct_message_received', handleDirectMessageReceived);
    socket.on('direct_message_updated', handleDirectMessageUpdated);
    socket.on('direct_message_deleted', handleDirectMessageDeleted);

    return () => {
      socket.off('direct_message_received', handleDirectMessageReceived);
      socket.off('direct_message_updated', handleDirectMessageUpdated);
      socket.off('direct_message_deleted', handleDirectMessageDeleted);
    };
  }, [socket, selectedUser, currentUser]);

  // Send message
  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedUser || !socket || !isConnected || !currentUser) return;

    const messageData: DirectMessage = {
      id: crypto.randomUUID(),
      content: newMessage.trim(),
      authorId: currentUser.id,
      targetId: selectedUser.id,
      createdAt: new Date().toISOString(),
      author: currentUser
    };

    setMessages(prev => [...prev, messageData]);

    socket.emit('send_direct_message', {
      targetId: selectedUser.id,
      content: newMessage.trim(),
    });

    setNewMessage('');
  };

  // Edit message handlers
  const handleStartEdit = (message: DirectMessage) => {
    if (message.authorId !== currentUser?.id) return;
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editContent.trim() || !selectedUser || !socket || !isConnected || !currentUser) {
      return;
    }

    const originalMessage = messages.find(msg => msg.id === editingMessageId);
    if (!originalMessage || originalMessage.authorId !== currentUser.id) {
      handleCancelEdit();
      return;
    }

    if (editContent.trim() === originalMessage.content) {
      handleCancelEdit();
      return;
    }

    try {
      // Optimistically update UI
      setMessages(prev =>
        prev.map(msg =>
          msg.id === editingMessageId ? { ...msg, content: editContent.trim(), edited: true } : msg
        )
      );

      const token = localStorage.getItem('token');
      if (!token) throw new Error('No auth token');

      await axios.patch(
        `http://localhost:3000/api/dms/messages/${editingMessageId}`,
        { content: editContent.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Failed to edit message:', error);
      // Revert optimistic update on error
      setMessages(prev =>
        prev.map(msg => (msg.id === editingMessageId ? originalMessage : msg))
      );
      alert('Failed to edit message.');
    } finally {
      handleCancelEdit();
    }
  };
console.log("selected user id:",selectedUser.id)
  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSaveEdit();
    else if (e.key === 'Escape') handleCancelEdit();
  };

  // Copy message content to clipboard
  const handleCopyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.error('Failed to copy message: ', err);
      alert('Failed to copy message.');
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this message?');
    if (!confirmDelete) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token");
      }

      // Optimistic UI update
      const messageToDelete = messages.find(msg => msg.id === messageId);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));

      const response = await axios.delete(`http://localhost:3000/api/dms/messages/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status !== 200) {
        throw new Error('Failed to delete message on server');
      }

    } catch (err) {
      console.error("Delete message failed:", err);
      alert("Failed to delete message. Please try again.");
      
      // Revert optimistic update on error
      if (selectedUser && currentUser) {
        const loadConversation = async () => {
          try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const res = await axios.get<DirectMessage[]>(`http://localhost:3000/api/dms/${selectedUser.id}/messages`, {
              headers: { Authorization: `Bearer ${token}` }
            });

            setMessages(res.data);
          } catch (error) {
            console.error('Failed to reload conversation:', error);
          }
        };
        loadConversation();
      }
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'ONLINE': return 'bg-green-400';
      case 'IDLE': return 'bg-yellow-400';
      case 'DO_NOT_DISTURB': return 'bg-red-400';
      default: return 'bg-gray-400';
    }
  };

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
      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
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
    <Button 
      variant="ghost" 
      size="sm" 
      className="text-gray-400 hover:text-white"
      onClick={() => {
        initiateCall(selectedUser.id, 'voice');
        setIsCallInterfaceOpen(true);
      }}
    >
      <Phone className="h-4 w-4" />
    </Button>
    <Button 
      variant="ghost" 
      size="sm" 
      className="text-gray-400 hover:text-white"
      onClick={() => {
        initiateCall(selectedUser.id, 'video');
        setIsCallInterfaceOpen(true);
      }}
    >
      <Video className="h-4 w-4" />
    </Button>
    {[Pin, Bell, MoreVertical].map((Icon, i) => (
      <Button key={i} variant="ghost" size="sm" className="text-gray-400 hover:text-white">
        <Icon className="h-4 w-4" />
      </Button>
    ))}
  </div>
</div>
<CallInterface
  currentUser={currentUser}
  isOpen={isCallInterfaceOpen}
  onClose={() => setIsCallInterfaceOpen(false)}
/>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#36393f]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400">Loading messages...</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupMessagesByDate(messages)).map(([date, msgs]) => (
                <div key={date}>
                  {/* Date Divider */}
                  <div className="flex items-center my-4">
                    <div className="flex-grow border-t border-gray-600"></div>
                    <span className="mx-2 text-gray-400 text-xs">{date}</span>
                    <div className="flex-grow border-t border-gray-600"></div>
                  </div>

                  {msgs.map(message => (
                    <div key={message.id} className="flex items-start group hover:bg-[#32353b] px-2 py-1 rounded">
                      <Avatar className="h-10 w-10 mr-3 flex-shrink-0">
                        <AvatarImage src={message.author.avatar || `https://api.dicebear.com/6.x/bottts/svg?seed=${message.author.username}`} />
                        <AvatarFallback>{message.author.username[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        {/* Header with name, timestamp, and menu */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-baseline">
                            <span className="font-semibold text-white mr-2">{message.author.displayName || message.author.username}</span>
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                              {new Date(message.createdAt).toLocaleString("en-GB", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          
                          {/* Three-dot menu - Only for own messages */}
                          {message.authorId === currentUser?.id && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="p-1 h-6 w-6 text-gray-400 hover:text-gray-200 hover:bg-[#40444b]"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-[#18191c] border-[#202225] text-white">
                                  <DropdownMenuLabel>Message</DropdownMenuLabel>
                                  <DropdownMenuSeparator className="bg-[#202225]" />
                                  <DropdownMenuItem
                                    className="hover:bg-[#36393f] focus:bg-[#36393f] cursor-pointer"
                                    onClick={() => handleStartEdit(message)}
                                  >
                                    <span>Edit</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="hover:bg-[#36393f] focus:bg-[#36393f] cursor-pointer"
                                    onClick={() => handleCopyMessage(message.content)}
                                  >
                                    <Copy className="mr-2 h-4 w-4" />
                                    <span>Copy</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="hover:bg-red-600 focus:bg-red-600 text-red-400 hover:text-white focus:text-white cursor-pointer"
                                    onClick={() => handleDeleteMessage(message.id)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span>Delete</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </div>

                        {/* Message Content / Edit Input */}
                        <div className="mt-1">
                          {editingMessageId === message.id ? (
                            // Edit mode
                            <div className="flex items-center">
                              <Input
                                ref={editInputRef}
                                type="text"
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                onKeyDown={handleEditKeyDown}
                                className="flex-1 bg-[#40444b] text-white border-0 focus:ring-1 focus:ring-blue-500"
                              />
                              <Button onClick={handleSaveEdit} size="sm" variant="ghost" className="ml-2 text-green-400 hover:text-green-300 hover:bg-[#40444b]">
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button onClick={handleCancelEdit} size="sm" variant="ghost" className="ml-1 text-gray-400 hover:text-gray-300 hover:bg-[#40444b]">
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            // Display mode
                            <div 
                              className="text-gray-300 break-words cursor-text flex items-start"
                              onDoubleClick={() => handleStartEdit(message)}
                            >
                              <span className="flex-1">{message.content}</span>
                              {message.edited && (
                                <span className="text-xs text-gray-500 ml-2 mt-0.5 flex-shrink-0">(edited)</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
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
          {!isConnected && <div className="text-xs text-red-400 mt-1">Disconnected - messages cannot be sent</div>}
        </div>
      </div>

      {/* User Profile */}
      {selectedUser && (
        <div className="w-60 bg-[#2f3136] flex flex-col border-l border-[#202225]">
          <div className="h-24 bg-[#b54782] relative">
            <div className="absolute -bottom-8 left-4">
              <Avatar className="h-16 w-16 border-4 border-[#2f3136] rounded-full">
                <AvatarImage src={selectedUser.avatar || `https://api.dicebear.com/6.x/bottts/svg?seed=${selectedUser.username}`} />
                <AvatarFallback>{selectedUser.username[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
            </div>
          </div>

          <div className="p-4 mt-10">
            <h2 className="text-lg font-bold text-white">{selectedUser.username}</h2>
            <p className="text-sm text-gray-400">{selectedUser.displayName}</p>

            <div className="mt-4 text-sm">
              <p className="font-semibold text-gray-300">Status</p>
              <div className="flex items-center mt-1">
                <div className={`w-3 h-3 rounded-full mr-2 ${getStatusColor(selectedUser.status)}`}></div>
                <span className="text-gray-300 capitalize">{selectedUser.status?.toLowerCase().replace('_', ' ') || 'Unknown'}</span>
              </div>
            </div>

            <div className="mt-4 text-sm">
              <p className="font-semibold text-gray-300">About Me</p>
              <p className="text-gray-300">{selectedUser.bio}</p>
            </div>

            <div className="mt-4 text-sm">
              <p className="font-semibold text-gray-300">Member Since</p>
              <p className="text-gray-300">
                {selectedUser.createdAt
                  ? new Date(selectedUser.createdAt).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                  : 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}