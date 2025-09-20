// src/components/ChannelViewer.tsx
import React, { useEffect, useState, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Hash, Volume2, MoreVertical, Copy, Trash2, Check, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import useChannelChat from "../hooks/useChannelChat";
import axios from 'axios';

interface Channel {
  id: string;
  name: string;
  type: "TEXT" | "VOICE";
  position: number;
}

interface User {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
}

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
  updatedAt?: string;
  edited?: boolean;
  isSending?: boolean;
}

interface ChannelViewerProps {
  selectedChannel: Channel;
  currentUser: User | null;
}

const ChannelViewer: React.FC<ChannelViewerProps> = ({ selectedChannel, currentUser }) => {
  const [newMessage, setNewMessage] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const editInputRef = useRef<HTMLInputElement>(null);
  
  const {
    messages,
    isLoading,
    isConnected,
    error,
    sendMessage,
    updateMessage,
    deleteMessage,
    setMessages
  } = useChannelChat({ channelId: selectedChannel?.id || null });

  // Group messages by date
  const groupMessagesByDate = (msgs: Message[]) => {
    return msgs.reduce((groups: Record<string, Message[]>, msg) => {
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

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingMessageId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingMessageId]);

  // Send message
  const handleMessageSend = () => {
    if (!newMessage.trim() || !selectedChannel || !isConnected || !currentUser) return;
    
    sendMessage(newMessage);
    setNewMessage("");
  };

  // Edit message handlers
  const handleStartEdit = (message: Message) => {
    if (message.author.id !== currentUser?.id) return;
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editContent.trim() || !selectedChannel || !currentUser) {
      return;
    }

    const originalMessage = messages.find(msg => msg.id === editingMessageId);
    if (!originalMessage || originalMessage.author.id !== currentUser.id) {
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

      await updateMessage(editingMessageId, editContent.trim());
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
      // Optimistic UI update
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      await deleteMessage(messageId);
    } catch (err) {
      console.error("Delete message failed:", err);
      alert("Failed to delete message. Please try again.");
      
      // Reload messages on error
      if (selectedChannel) {
        const reloadMessages = async () => {
          try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const res = await fetch(
              `http://localhost:3000/api/channels/${selectedChannel.id}/messages?limit=50`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );

            if (res.ok) {
              const messageData = await res.json();
              setMessages(messageData);
            }
          } catch (error) {
            console.error('Failed to reload messages:', error);
          }
        };
        reloadMessages();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleMessageSend();
    }
  };

  // Display error if any
  useEffect(() => {
    if (error) {
      alert(`Error: ${error}`);
    }
  }, [error]);

  return (
    <>
      {/* Channel header */}
<div className="h-[49.5px] border-t border-r border-l-0 border flex items-center bg-[#2b2d31]">
        {selectedChannel.type === 'TEXT' ? (
          <Hash className="h-5 w-5 ml-4 text-gray-400 mr-2" />
        ) : (
          <Volume2 className="h-5 w-5 text-gray-400 mr-2" />
        )}
        <span className="font-semibold  text-white">{selectedChannel.name}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#36393f]">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <div className="text-gray-400">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center items-center h-32">
            <div className="text-gray-400">No messages yet. Be the first to say something!</div>
          </div>
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

                {msgs.map((msg) => (
                  <div key={msg.id} className={`flex hover:bg-[#32353b] p-2 rounded group ${msg.isSending ? 'opacity-60' : ''}`}>
                    <Avatar className="h-10 w-10 mr-3 flex-shrink-0">
                      <AvatarImage
                        src={
                          msg.author?.avatar ||
                          `https://api.dicebear.com/6.x/bottts/svg?seed=${msg.author?.username || 'default'}`
                        }
                        alt={msg.author?.username || "User"}
                      />
                      <AvatarFallback>
                        {msg.author?.username?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      {/* Header with name, timestamp, and menu */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline">
                          <span className="font-semibold text-white mr-2">
                            {msg.author?.displayName || msg.author?.username || "Unknown User"}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(msg.createdAt).toLocaleString("en-GB", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {msg.isSending && (
                            <span className="text-xs text-gray-500 ml-2">Sending...</span>
                          )}
                        </div>
                        
                        {/* Three-dot menu - Only for own messages */}
                        {msg.author.id === currentUser?.id && (
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
                                  onClick={() => handleStartEdit(msg)}
                                >
                                  <span>Edit</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="hover:bg-[#36393f] focus:bg-[#36393f] cursor-pointer"
                                  onClick={() => handleCopyMessage(msg.content)}
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  <span>Copy</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="hover:bg-red-600 focus:bg-red-600 text-red-400 hover:text-white focus:text-white cursor-pointer"
                                  onClick={() => handleDeleteMessage(msg.id)}
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
                        {editingMessageId === msg.id ? (
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
                            onDoubleClick={() => handleStartEdit(msg)}
                          >
                            <span className="flex-1">{msg.content}</span>
                            {msg.edited && (
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

      {/* Message input */}
      <div className="p-3 border-t border-gray-700 bg-[#313338]">
        <div className="flex items-center bg-[#404249] rounded-lg px-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${selectedChannel.name}`}
            className="flex-1 bg-transparent border-0 text-gray-200 focus-visible:ring-0 py-4"
            disabled={!isConnected}
          />
          <Button
            onClick={handleMessageSend}
            disabled={!newMessage.trim() || !isConnected}
            className="ml-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600"
          >
            Send
          </Button>
        </div>
        {!isConnected && (
          <div className="text-xs text-red-400 mt-1">
            Disconnected - messages cannot be sent
          </div>
        )}
      </div>
    </>
  );
};

export default ChannelViewer;