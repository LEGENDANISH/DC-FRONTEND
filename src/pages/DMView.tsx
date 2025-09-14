// src/components/DMViewer.tsx
import React, { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { MessageCircle } from "lucide-react";
import useSocket from "../hooks/useSocket";

interface User {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  status?: 'ONLINE' | 'IDLE' | 'DO_NOT_DISTURB' | 'OFFLINE';
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

const DMViewer: React.FC<{ currentUser: User | null; targetUser: User }> = ({ currentUser, targetUser }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const { socket, isConnected } = useSocket();

  // TODO: Implement fetching initial DM messages between currentUser and targetUser
  // useEffect(() => {
  //   const fetchDMs = async () => {
  //     // API call to fetch DM history
  //   };
  //   fetchDMs();
  // }, [currentUser, targetUser]);

  // TODO: Implement joining a specific DM room via socket if needed
  // useEffect(() => {
  //   // Join DM room logic
  //   return () => {
  //     // Leave DM room logic
  //   };
  // }, [targetUser]);

  // Handle incoming DM messages via socket
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewDM = (message: Message) => {
       // Ensure the message is relevant to this DM conversation
       // This check might need adjustment based on your backend message structure
       const isRelevant = message.author?.id === targetUser.id || message.author?.id === currentUser?.id;
       if (isRelevant) {
         setMessages(prev => [...prev, message]);
       }
    };

    // Assuming a specific event for DMs or filtering general messages
    socket.on('direct_message_received', handleNewDM);
    // Potentially also listen to 'message' event and filter by conversation ID

    return () => {
      socket.off('direct_message_received', handleNewDM);
      // socket.off('message', handleNewDM); // if using general message event
    };
  }, [socket, isConnected, targetUser, currentUser]);

  const handleMessageSend = async () => {
    if (!newMessage.trim() || !socket || !isConnected || !currentUser) return;

    const tempId = `temp-${Date.now()}`;
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
      // You'll need to define the correct payload structure for your backend
      socket?.emit('send_direct_message', {
        content: messageContent,
        recipientId: targetUser.id // Assuming you send recipient ID
        // You might also send a conversationId if your backend uses that
      });

      // Remove temp message (optimistic update)
      // The real message will come back via the 'direct_message_received' event
      // or potentially a 'message_sent' confirmation event
      // For now, we'll just remove the temp one. The real one will arrive via socket.
      // A better approach might be to update the temp message with the real ID.
      // setMessages(prev => prev.filter(m => m.id !== tempId)); // Remove temp
      // Or wait for confirmation before removing

    } catch (err) {
      console.error("Failed to send DM", err);
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
    <div className="flex flex-col h-full">
      {/* DM Header */}
      <div className="p-3 border-b border-gray-700 flex items-center bg-[#313338]">
        <MessageCircle className="h-5 w-5 text-gray-400 mr-2" />
        <span className="font-semibold">{targetUser.displayName || targetUser.username}</span>
      </div>

      {/* DM Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#36393f]">
        {/* Placeholder for messages */}
        {messages.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-gray-400">Start a conversation with {targetUser.displayName || targetUser.username}.</div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.author?.id === currentUser?.id ? 'justify-end' : 'justify-start'} ${msg.isSending ? 'opacity-60' : ''}`}>
              {msg.author?.id !== currentUser?.id && (
                <Avatar className="h-8 w-8 mr-2 flex-shrink-0">
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
              )}
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${msg.author?.id === currentUser?.id ? 'bg-indigo-600 text-white' : 'bg-[#404249] text-gray-200'}`}>
                <div className="text-sm break-words">
                  {msg.content}
                </div>
                <div className={`text-xs mt-1 ${msg.author?.id === currentUser?.id ? 'text-indigo-200' : 'text-gray-400'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {msg.isSending && <span className="ml-2">(Sending...)</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* DM Message Input */}
      <div className="p-3 border-t border-gray-700 bg-[#313338]">
        <div className="flex items-center bg-[#404249] rounded-lg px-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message @${targetUser.username}`}
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
    </div>
  );
};

export default DMViewer;