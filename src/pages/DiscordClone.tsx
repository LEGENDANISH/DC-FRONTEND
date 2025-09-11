// DiscordClone.tsx
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Users, Headphones, Hash, Volume2 } from "lucide-react";
import CreateServerDialog from "./CreateServerDialog";
import { useEffect, useState } from "react";
import axios from "axios";
import { JoinServer } from "./Joinserver";
import { ChannelList } from "./Channel";
import CreateChannelDialog from "./CreateChannelDialog";
import InviteDialog from "./InviteDialog";
import useSocket from "../hooks/useSocket";

interface Server {
  id: string;
  name: string;
  owner: { id: string; username: string; avatar: string | null };
}

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
  attachments?: any[];
  replyTo?: any;
  isSending?: boolean; // For optimistic updates
}

export default function DiscordClone() {
  const [open, setOpen] = useState(false);
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedView, setSelectedView] = useState<"friends" | { serverId: string }>("friends");
  const [join, setJoin] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [openChannelDialog, setOpenChannelDialog] = useState(false);
  const [openInviteDialog, setOpenInviteDialog] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Get socket instance
  const { socket, isConnected, joinChannel, leaveChannel } = useSocket();

  // Fetch user data on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          console.error("No token found");
          return;
        }

        const res = await axios.get<User>("http://localhost:3000/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(res.data);
      } catch (err) {
        console.error("Failed to fetch user", err);
      }
    };
    fetchUser();
  }, []);

  // Fetch servers
  useEffect(() => {
    const fetchServers = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token || !user) return;

        const res = await axios.get<Server[]>("http://localhost:3000/api/servers", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setServers(res.data);
      } catch (err) {
        console.error("Failed to fetch servers", err);
      }
    };
    if (user) {
      fetchServers();
    }
  }, [user]);

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

        const res = await axios.get<Message[]>(
          `http://localhost:3000/api/channels/${selectedChannel.id}/messages`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: { limit: 50 } // Fetch last 50 messages
          }
        );
        // Messages should already be in correct order from backend
        setMessages(res.data);
      } catch (err) {
        console.error("Failed to fetch messages", err);
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [selectedChannel]);

  // Handle real-time socket events
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewMessage = (message: Message) => {
      console.log("Received new message:", message);
      setMessages(prev => {
        // Remove any optimistic message with temp ID
        const filtered = prev.filter(m => !m.isSending || m.id !== message.id);
        return [...filtered, message];
      });
    };

    const handleMessageUpdate = (message: Message) => {
      console.log("Message updated:", message);
      setMessages(prev => 
        prev.map(m => m.id === message.id ? message : m)
      );
    };

    const handleMessageDelete = (data: { messageId: string }) => {
      console.log("Message deleted:", data.messageId);
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
  }, [socket, isConnected]);

  // Join/leave channels when selection changes
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Leave previous channel
    const prevChannel = selectedChannel;
    
    return () => {
      if (prevChannel) {
        leaveChannel(prevChannel.id);
      }
    };
  }, [selectedChannel, socket, isConnected, leaveChannel]);

  useEffect(() => {
    if (selectedChannel && socket && isConnected) {
      joinChannel(selectedChannel.id);
    }
  }, [selectedChannel, socket, isConnected, joinChannel]);

  const handleMessageSend = async () => {
    if (!newMessage.trim() || !selectedChannel || !user) return;

    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      content: newMessage,
      author: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar
      },
      createdAt: new Date().toISOString(),
      isSending: true,
    };

    // Optimistic update
    setMessages(prev => [...prev, tempMessage]);
    const messageContent = newMessage;
    setNewMessage("");

    try {
      // Send via REST API (which will also broadcast via WebSocket)
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await axios.post<Message>(
        `http://localhost:3000/api/channels/${selectedChannel.id}/messages`,
        { content: messageContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Remove optimistic message - real message will come via WebSocket
      setMessages(prev => prev.filter(m => m.id !== tempId));

    } catch (err) {
      console.error("Failed to send message", err);
      // Remove optimistic message and restore input
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(messageContent);
      alert("Failed to send message.");
    }
  };

  // Handle pressing Enter to send message
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleMessageSend();
    }
  };

  // Reset channel and messages when switching servers or views
  useEffect(() => {
    if (selectedChannel) {
      setSelectedChannel(null);
      setMessages([]);
    }
  }, [selectedView]);

  const handleChannelSelect = (channel: Channel) => {
    // Leave current channel before selecting new one
    if (selectedChannel && socket && isConnected) {
      leaveChannel(selectedChannel.id);
    }
    setSelectedChannel(channel);
    setMessages([]); // Clear messages immediately for better UX
  };

  return (
    <div className="h-screen w-screen flex bg-[#313338] text-white overflow-hidden">
      {/* Connection Status Indicator */}
      {!isConnected && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-600 text-center py-1 text-sm z-50">
          Connecting to server...
        </div>
      )}

      {/* Sidebar */}
      <div className="w-16 bg-[#1e1f22] flex flex-col items-center py-3 space-y-3 overflow-y-auto">
        <Button
          className={`rounded-full h-12 w-12 p-0 ${selectedView === "friends" ? "!bg-indigo-600" : "!bg-gray-800 hover:!bg-indigo-500"}`}
          onClick={() => setSelectedView("friends")}
          title="Friends"
        >
          <Users className="h-5 w-5" />
        </Button>

        <div className="w-8 h-0.5 bg-gray-600 rounded mx-auto"></div>

        {servers.map((server) => (
          <Button
            key={server.id}
            className={`rounded-full h-12 w-12 p-0 overflow-hidden ${
              typeof selectedView === "object" && selectedView.serverId === server.id
                ? "!bg-indigo-600"
                : "!bg-gray-800 hover:!bg-indigo-500"
            }`}
            onClick={() => setSelectedView({ serverId: server.id })}
            title={server.name}
          >
            {server.owner?.avatar ? (
              <img
                src={server.owner.avatar}
                alt={server.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs font-bold">{server.name.charAt(0).toUpperCase()}</span>
            )}
          </Button>
        ))}

        <Button
          className="rounded-full h-12 w-12 p-0 !bg-gray-800 hover:!bg-green-600"
          onClick={() => setOpen(true)}
          title="Add a Server"
        >
          +
        </Button>
        <CreateServerDialog open={open} onClose={() => setOpen(false)} />

        <Button
          className="rounded-full h-12 w-12 p-0 !bg-gray-800 hover:!bg-green-600"
          onClick={() => setJoin(true)}
          title="Join a Server"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265ZM21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 12Z"/>
          </svg>
        </Button>
        <JoinServer open={join} onClose={() => setJoin(false)} />
      </div>

      {/* Left Sidebar */}
      <div className="w-60 bg-[#2b2d31] flex flex-col">
        {selectedView === "friends" ? (
          <>
            <div className="p-3">
              <Input placeholder="Find or start a conversation" className="bg-[#1e1f22] border-0 text-sm" />
            </div>
            <nav className="flex flex-col space-y-2 px-3 text-gray-300 text-sm">
              <button className="flex items-center space-x-2 hover:bg-[#3c3e44] p-2 rounded">
                <Users className="h-4 w-4" /> <span>Friends</span>
              </button>
            </nav>
            <div className="mt-4 px-3 text-xs text-gray-400">Direct Messages</div>
            <div className="px-3 py-1 text-sm text-gray-500">No friends online</div>
          </>
        ) : (
          <>
            <div className="p-3 text-lg font-bold border-b border-gray-700">
              {servers.find(s => s.id === (selectedView as { serverId: string }).serverId)?.name || "Server"}
            </div>

            <div className="p-2 text-xs font-semibold uppercase text-gray-400 px-3">
              Text Channels
            </div>

            <div className="flex-1 overflow-y-auto">
              <ChannelList
                serverId={(selectedView as { serverId: string }).serverId}
                onSelect={handleChannelSelect}
                selectedChannel={selectedChannel}
              />
            </div>

            {/* Server Actions */}
            {(() => {
              const server = servers.find(
                (s) => s.id === (selectedView as { serverId: string }).serverId
              );
              if (!server) return null;

              return (
                <div className="p-2 space-y-1">
                  <Button
                    className="w-full !bg-gray-700 hover:!bg-gray-600 text-xs flex items-center justify-start"
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem("token");
                        if (!token || !server.id) return;
                        const res = await axios.post<{ code: string }>(
                          `http://localhost:3000/api/servers/${server.id}/invites`,
                          {},
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        setInviteCode(res.data.code);
                        setOpenInviteDialog(true);
                      } catch (err) {
                        console.error("Failed to create invite", err);
                        alert("Failed to create invite");
                      }
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-1"
                    >
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                    Invite People
                  </Button>

                  {server.owner?.id === user?.id && (
                    <Button
                      className="w-full !bg-gray-700 hover:!bg-gray-600 text-xs flex items-center justify-start"
                      onClick={() => setOpenChannelDialog(true)}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mr-1"
                      >
                        <line x1="12" x2="12" y1="5" y2="19"></line>
                        <line x1="5" x2="19" y1="12" y2="12"></line>
                      </svg>
                      Create Channel
                    </Button>
                  )}

                  <InviteDialog
                    open={openInviteDialog}
                    onClose={() => setOpenInviteDialog(false)}
                    inviteCode={inviteCode}
                  />
                </div>
              );
            })()}

            <CreateChannelDialog
              open={openChannelDialog}
              onClose={() => setOpenChannelDialog(false)}
              serverId={(selectedView as { serverId: string }).serverId}
            />
          </>
        )}

        {/* User profile */}
        <div className="mt-auto p-3 border-t border-gray-700 flex items-center justify-between bg-[#232428]">
          <div className="flex items-center space-x-2">
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={
                  user?.avatar ||
                  `https://api.dicebear.com/6.x/bottts/svg?seed=${user?.username || 'default'}`
                }
                alt={user?.username || "User"}
              />
              <AvatarFallback>
                {user?.displayName?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium">{user?.displayName || user?.username || "User"}</span>
              <div className="flex items-center gap-1">
                <span className={`inline-block h-2 w-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-xs text-gray-400">{isConnected ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Headphones className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-[#36393f]">
        {selectedChannel ? (
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
        ) : (
          <div className="flex flex-col h-full items-center justify-center bg-[#36393f] text-gray-400">
            {typeof selectedView === "object" ? (
              <>
                <div className="text-3xl font-bold mb-2">Welcome!</div>
                <p className="mb-4">Select a channel to start chatting.</p>
              </>
            ) : (
              <>
                <Users className="h-24 w-24 mb-4 text-gray-500" />
                <h1 className="text-3xl font-bold mb-2">Friends</h1>
                <p className="mb-4">Your friends will appear here once you add them.</p>
                <Button>Add Friend</Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}