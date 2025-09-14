// src/components/DiscordClone.tsx
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import {
  Users,
  Headphones,
  Hash,
  Volume2,
  MessageCircle,
  Bell,
  Plus,
  Globe
} from "lucide-react";
import CreateServerDialog from "./CreateServerDialog";
import { useEffect, useState } from "react";
import { JoinServer } from "./Joinserver";
import { ChannelList } from "./Channel";
import CreateChannelDialog from "./CreateChannelDialog";
import InviteDialog from "./InviteDialog";
import useSocket from "../hooks/useSocket";

// Import new components
import FriendsPanel from "./FriendPannel";
import DirectMessages from "./DirectMessage"; // Make sure this component is updated to accept selectedUser prop

// --- Interfaces ---
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
  status?: 'ONLINE' | 'IDLE' | 'DO_NOT_DISTURB' | 'OFFLINE';
  email?:string;
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
  isSending?: boolean;
  // channelId?: string; // Consider adding if needed for filtering
}

type ViewState =
  | { type: 'friends' }
  | { type: 'dm', user: User } // Represents the target user for the DM
  | { type: 'server', serverId: string };

// --- Main Component ---
export default function DiscordClone() {
  // --- State ---
  const [open, setOpen] = useState(false); // For Create Server Dialog
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedView, setSelectedView] = useState<ViewState>({ type: 'friends' });
  const [join, setJoin] = useState(false); // For Join Server Dialog
  const [user, setUser] = useState<User | null>(null); // Current logged-in user
  const [openChannelDialog, setOpenChannelDialog] = useState(false); // For Create Channel Dialog
  const [openInviteDialog, setOpenInviteDialog] = useState(false); // For Invite Dialog
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [notifications, setNotifications] = useState<number>(0); // For friend/DM notifications

  // --- Hooks ---
  const { socket, isConnected, joinChannel, leaveChannel } = useSocket();

  // --- Effects ---

  // Fetch current user data on mount
useEffect(() => {
  const fetchUser = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("No authentication token found");
        return;
      }

      const res = await fetch("http://localhost:3000/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("Raw response:", res); // logs the full Response object

      if (res.ok) {
        const userData: User = await res.json(); // ✅ parse JSON
        console.log("User data:", userData); // instead of res.data
        
        setUser(userData);
      } else {
        console.error("Failed to fetch user data:", res.status, res.statusText);
      }
      
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
  };

  fetchUser();
}, []);
useEffect(() => {
  const fetchUser = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("No authentication token found");
        return;
      }

      const res = await fetch("http://localhost:3000/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
   

      console.log("Raw response:", res); // logs the full Response object

      if (res.ok) {
        const userData: User = await res.json(); // ✅ parse JSON
        console.log("User data:", userData); // instead of res.data
        setUser(userData);
      } else {
        console.error("Failed to fetch user data:", res.status, res.statusText);
      }
      console.log("user:",user?.email)
      console.log(user?.id)
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
  };
   console.log("user:",user?.email)
      console.log(user?.id)
  fetchUser();
}, []);


  // Fetch servers list when user is available
  useEffect(() => {
    const fetchServers = async () => {
      if (!user) return; // Wait for user to be loaded

      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const res = await fetch("http://localhost:3000/api/servers", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const serverData: Server[] = await res.json();
          setServers(serverData);
        } else {
          console.error("Failed to fetch servers:", res.status, res.statusText);
        }
      } catch (err) {
        console.error("Error fetching servers:", err);
      }
    };

    fetchServers();
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

        const res = await fetch(
          `http://localhost:3000/api/channels/${selectedChannel.id}/messages?limit=50`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (res.ok) {
          const messageData: Message[] = await res.json();
          setMessages(messageData);
        } else {
          console.error("Failed to fetch messages:", res.status, res.statusText);
          setMessages([]); // Clear messages on error
        }
      } catch (err) {
        console.error("Error fetching messages:", err);
        setMessages([]); // Clear messages on error
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [selectedChannel]);

  // Handle real-time socket events for CHANNEL messages and general events
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewMessage = (message: Message) => {
      console.log("Received new channel message:", message);
      // Optimistically add the new message to the list
      // The backend should ensure this message is for the currently selected channel
      // or we should filter here based on message.channelId if implemented.
      setMessages(prev => {
        // Filter out temporary messages with the same ID if they exist
        const filtered = prev.filter(m => !m.isSending || m.id !== message.id);
        return [...filtered, message];
      });
    };

    const handleMessageUpdate = (message: Message) => {
      console.log("Channel message updated:", message);
      setMessages(prev =>
        prev.map(m => m.id === message.id ? message : m)
      );
    };

    const handleMessageDelete = (data: { messageId: string }) => {
      console.log("Channel message deleted:", data.messageId);
      setMessages(prev =>
        prev.filter(m => m.id !== data.messageId)
      );
    };

    const handleError = (error: { message: string }) => {
      console.error("Socket error:", error);
      alert(`Error: ${error.message}`);
    };

    const handleFriendRequest = () => {
      // Increment notification count for friend requests or new DMs
      setNotifications(prev => prev + 1);
    };

    // Listen to socket events
    socket.on('message', handleNewMessage);
    socket.on('message_update', handleMessageUpdate);
    socket.on('message_delete', handleMessageDelete);
    socket.on('error', handleError);
    socket.on('friend_request_received', handleFriendRequest);
    // Assuming 'direct_message_received' also increments notifications
    socket.on('direct_message_received', handleFriendRequest);

    // Cleanup listeners on unmount or dependency change
    return () => {
      socket.off('message', handleNewMessage);
      socket.off('message_update', handleMessageUpdate);
      socket.off('message_delete', handleMessageDelete);
      socket.off('error', handleError);
      socket.off('friend_request_received', handleFriendRequest);
      socket.off('direct_message_received', handleFriendRequest);
    };
  }, [socket, isConnected /* selectedChannel is not needed here if backend filters */]);

  // Join/leave channels via socket when selection changes
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Leave the previous channel if one was selected
    return () => {
      if (selectedChannel) {
        leaveChannel(selectedChannel.id);
      }
    };
  }, [selectedChannel, socket, isConnected, leaveChannel]);

  // Join the newly selected channel
  useEffect(() => {
    if (selectedChannel && socket && isConnected) {
      joinChannel(selectedChannel.id);
    }
  }, [selectedChannel, socket, isConnected, joinChannel]);

  // --- Handlers ---

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

    // Optimistically add the temporary message
    setMessages(prev => [...prev, tempMessage]);
    const messageContent = newMessage;
    setNewMessage(""); // Clear input

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(
        `http://localhost:3000/api/channels/${selectedChannel.id}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ content: messageContent })
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      // The real message will come back via the 'message' socket event.
      // We can remove the temp message now, or wait for the socket confirmation.
      // Removing it now prevents a flicker if the ID changes.
      // setMessages(prev => prev.filter(m => m.id !== tempId));

    } catch (err) {
      console.error("Failed to send message:", err);
      // Remove the temporary message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      // Restore the message content to the input
      setNewMessage(messageContent);
      alert("Failed to send message. Please try again.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleMessageSend();
    }
  };

  // Reset channel and messages when switching away from server view
  useEffect(() => {
    if (selectedView.type !== 'server') {
      setSelectedChannel(null);
      setMessages([]);
    }
  }, [selectedView]);

  const handleChannelSelect = (channel: Channel) => {
    // Optional: Explicitly leave the previous channel via socket before selecting new one
    // if (selectedChannel && socket && isConnected) {
    //   leaveChannel(selectedChannel.id);
    // }
    setSelectedChannel(channel);
    setMessages([]); // Clear messages for the new channel
  };

  const handleSelectDM = (targetUser: User) => {
    // Update the main view state to DM mode with the selected user
    setSelectedView({ type: 'dm', user: targetUser });
    // Clear DM notifications when opening a DM
    setNotifications(0);
  };

  // --- Render Helpers ---

  // Determine content for the left sidebar based on the selected view
  const renderLeftSidebarContent = () => {
    if (selectedView.type === "dm" || selectedView.type === "friends") {
      // Show Friends Panel for both Friends list view and DM view
      return (
        <div className="flex-1 overflow-y-auto">
          <FriendsPanel
            socket={socket} // Pass socket if needed by FriendsPanel
            onSelectDM={handleSelectDM} // Callback when a friend is selected for DM
          />
        </div>
      );
    } else if (selectedView.type === "server") {
      // Show Server Channels and Actions for Server view
      const server = servers.find(s => s.id === selectedView.serverId);
      return (
        <>
          <div className="p-3 text-lg font-bold border-b border-gray-700 truncate">
            {server?.name || "Server"}
          </div>

          <div className="p-2 text-xs font-semibold uppercase text-gray-400 px-3">
            Text Channels
          </div>

          <div className="flex-1 overflow-y-auto">
            <ChannelList
              serverId={selectedView.serverId}
              onSelect={handleChannelSelect}
              selectedChannel={selectedChannel}
            />
          </div>

          {/* Server Actions */}
          {server && (
            <div className="p-2 space-y-1 border-t border-gray-700">
              <Button
                className="w-full !bg-gray-700 hover:!bg-gray-600 text-xs flex items-center justify-start"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem("token");
                    if (!token || !server.id) return;

                    const res = await fetch(
                      `http://localhost:3000/api/servers/${server.id}/invites`,
                      {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` }
                      }
                    );

                    if (res.ok) {
                      const data = await res.json();
                      setInviteCode(data.code);
                      setOpenInviteDialog(true);
                    } else {
                      console.error("Failed to create invite:", res.status);
                      alert("Failed to create invite");
                    }
                  } catch (err) {
                    console.error("Error creating invite:", err);
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

              {/* Dialogs for Server Actions */}
              <InviteDialog
                open={openInviteDialog}
                onClose={() => setOpenInviteDialog(false)}
                inviteCode={inviteCode}
              />
              <CreateChannelDialog
                open={openChannelDialog}
                onClose={() => setOpenChannelDialog(false)}
                serverId={selectedView.serverId}
              />
            </div>
          )}
        </>
      );
    }
    return null; // Should not happen with defined ViewState
  };

  // Determine content for the main area based on the selected view
  const renderMainContent = () => {
    if (selectedView.type === "friends") {
      return (
        <div className="flex flex-col h-full items-center justify-center bg-[#36393f] text-gray-400">
          <Users className="h-24 w-24 mb-4 text-gray-500" />
          <h1 className="text-3xl font-bold mb-2">Friends</h1>
          <p className="mb-4">Select friends from the sidebar to view and manage your connections.</p>
        </div>
      );
    } else if (selectedView.type === "dm") {
      // Pass the selected user and current user to DirectMessages
      return (
        <DirectMessages
          currentUser={user}
          selectedUser={selectedView.user} // Pass the target user for the DM
          // onSelectUser={handleSelectConversation} // Might not be needed if DM component doesn't manage internal selection
        />
      );
    } else if (selectedView.type === "server" && selectedChannel) {
      // Show Channel Chat
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
                      <span className="font-semibold text-white mr-2 truncate">
                        {msg.author?.displayName || msg.author?.username || "Unknown User"}
                      </span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
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
    } else if (selectedView.type === "server") {
      // Server selected but no channel selected yet
      return (
        <div className="flex flex-col h-full items-center justify-center bg-[#36393f] text-gray-400">
          <div className="text-3xl font-bold mb-2">Welcome!</div>
          <p className="mb-4">Select a channel to start chatting.</p>
        </div>
      );
    }
    // Default fallback (shouldn't be reached)
    return (
      <div className="flex flex-col h-full items-center justify-center bg-[#36393f] text-gray-400">
        <div className="text-3xl font-bold mb-2">Welcome!</div>
        <p className="mb-4">Select a view to get started.</p>
      </div>
    );
  };

  // --- Render ---

  return (
    <div className="h-screen w-screen flex bg-[#313338] text-white overflow-hidden">
      {/* Connection Status Indicator */}
      {!isConnected && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-600 text-center py-1 text-sm z-50">
          Connecting to server...
        </div>
      )}

      {/* Main Horizontal Navigation Sidebar */}
      <div className="w-16 bg-[#1e1f22] flex flex-col items-center py-3 space-y-3 overflow-y-auto">
        {/* Friends/DMs Button */}
        <Button
          className={`rounded-full h-12 w-12 p-0 relative ${
            selectedView.type === "friends" || selectedView.type === "dm"
              ? "!bg-indigo-600"
              : "!bg-gray-800 hover:!bg-indigo-500"
          }`}
          onClick={() => setSelectedView({ type: 'friends' })}
          title="Direct Messages"
        >
          <MessageCircle className="h-5 w-5" />
          {notifications > 0 && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {notifications > 9 ? '9+' : notifications}
            </div>
          )}
        </Button>

        <div className="w-8 h-0.5 bg-gray-600 rounded mx-auto"></div>

        {/* Server List */}
        {servers.map((server) => (
          <Button
            key={server.id}
            className={`rounded-full h-12 w-12 p-0 overflow-hidden ${
              selectedView.type === "server" && selectedView.serverId === server.id
                ? "!bg-indigo-600"
                : "!bg-gray-800 hover:!bg-indigo-500"
            }`}
            onClick={() => setSelectedView({ type: 'server', serverId: server.id })}
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

        {/* Add Server Button */}
        <Button
          className="rounded-full h-12 w-12 p-0 !bg-gray-800 hover:!bg-green-600"
          onClick={() => setOpen(true)}
          title="Add a Server"
        >
          <Plus className="h-6 w-6" />
        </Button>
        <CreateServerDialog open={open} onClose={() => setOpen(false)} />

        {/* Join Server Button */}
        <Button
          className="rounded-full h-12 w-12 p-0 !bg-gray-800 hover:!bg-green-600"
          onClick={() => setJoin(true)}
          title="Join a Server"
        >
          <Globe className="h-6 w-6" />
        </Button>
        <JoinServer open={join} onClose={() => setJoin(false)} />
      </div>

      {/* Left Sidebar (Contextual Content) */}
      <div className="w-60 bg-[#2b2d31] flex flex-col">
        {renderLeftSidebarContent()}
        
        {/* User Profile - Always visible at the bottom */}
        <div className="p-3 border-t border-gray-700 flex items-center justify-between bg-[#232428]">
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
            <div className="flex flex-col items-start min-w-0">
              <span className="text-sm font-medium truncate">{user?.username }</span>
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-[#36393f]">
        {renderMainContent()}
      </div>
    </div>
  );
}