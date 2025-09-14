// src/components/ChannelViewer.tsx
import React, { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Hash, Volume2 } from "lucide-react";
import useSocket from "../hooks/useSocket";

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
  author: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
  createdAt: string;
  isSending?: boolean;
}

const ChannelViewer: React.FC<{ selectedChannel: Channel }> = ({ selectedChannel }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const { socket, isConnected, joinChannel, leaveChannel } = useSocket();

  // Fetch messages when a channel is selected
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedChannel) {
        setMessages([]);
        return;
      }

      setIsLoadingMessages(true);
      try {
        const token = localStorage.getItem("token");
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
      } catch (err) {
        console.error("Failed to fetch messages", err);
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [selectedChannel]);

  // Join/leave channels when selection changes
  useEffect(() => {
    if (!socket || !isConnected) return;

    const prevChannelId = selectedChannel?.id;

    // Join the new channel
    if (selectedChannel) {
      joinChannel(selectedChannel.id);
    }

    // Cleanup: leave the previous channel
    return () => {
      if (prevChannelId) {
        leaveChannel(prevChannelId);
      }
    };
  }, [selectedChannel, socket, isConnected, joinChannel, leaveChannel]);

  // Handle real-time socket events for channel messages
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewMessage = (message: Message) => {
      // Only add messages for the currently selected channel
      // (Backend should ideally handle this filtering)
      if (message.channelId === selectedChannel?.id) {
        setMessages(prev => {
          const filtered = prev.filter(m => !m.isSending || m.id !== message.id);
          return [...filtered, message];
        });
      }
    };

    const handleMessageUpdate = (message: Message) => {
      setMessages(prev =>
        prev.map(m => m.id === message.id ? message : m)
      );
    };

    const handleMessageDelete = (data: { messageId: string }) => {
      setMessages(prev =>
        prev.filter(m => m.id !== data.messageId)
      );
    };

    const handleError = (error: { message: string }) => {
      console.error("Socket error:", error);
      alert(`Error: ${error.message}`);
    };

    // Listen to socket events
    socket.on('message', handleNewMessage);
    socket.on('message_update', handleMessageUpdate);
    socket.on('message_delete', handleMessageDelete);
    socket.on('error', handleError);

    return () => {
      socket.off('message', handleNewMessage);
      socket.off('message_update', handleMessageUpdate);
      socket.off('message_delete', handleMessageDelete);
      socket.off('error', handleError);
    };
  }, [socket, isConnected, selectedChannel?.id]);

  const handleMessageSend = async () => {
    if (!newMessage.trim() || !selectedChannel || !socket || !isConnected) return;

    const tempId = `temp-${Date.now()}`;
    // Assuming you have access to the current user data somehow, e.g., via context or prop
    // For now, placeholder user data. You might need to pass currentUser as a prop.
    const currentUser = { id: 'current-user-id-placeholder', username: 'You', displayName: 'You', avatar: null };

    const tempMessage: Message = {
      id: tempId,
      content: newMessage,
      author: {
        id: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.displayName,
        avatar: currentUser.avatar
      },
      createdAt: new Date().toISOString(),
      isSending: true,
    };

    setMessages(prev => [...prev, tempMessage]);
    const messageContent = newMessage;
    setNewMessage("");

    try {
      // Emit the message via socket
      socket.emit('send_message', {
        content: messageContent,
        channelId: selectedChannel.id
      });

      // Optimistically remove temp message (real one will come back via socket)
      // setMessages(prev => prev.filter(m => m.id !== tempId)); // Optional: remove temp

    } catch (err) {
      console.error("Failed to send message", err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(messageContent);
      alert("Failed to send message.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleMessageSend();
    }
  };

  return (
    <>
      {/* Channel header */}
      <div className="p-3 border-b border-gray-700 flex items-center bg-[#313338]">
        {selectedChannel.type === 'TEXT' ? (
          <Hash className="h-5 w-5 text-gray-400 mr-2" />
        ) : (
          <Volume2 className="h-5 w-5 text-gray-400 mr-2" />
        )}
        <span className="font-semibold">{selectedChannel.name}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#36393f]">
        {isLoadingMessages ? (
          <div className="flex justify-center items-center h-32">
            <div className="text-gray-400">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center items-center h-32">
            <div className="text-gray-400">No messages yet. Be the first to say something!</div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex hover:bg-[#32353b] p-2 rounded ${msg.isSending ? 'opacity-60' : ''}`}>
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
                <div className="flex items-baseline">
                  <span className="font-semibold text-white mr-2">
                    {msg.author?.displayName || msg.author?.username || "Unknown User"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(msg.createdAt).toLocaleString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                  {msg.isSending && (
                    <span className="text-xs text-gray-500 ml-2">Sending...</span>
                  )}
                </div>
                <div className="text-gray-300 break-words">
                  {msg.content}
                </div>
              </div>
            </div>
          ))
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