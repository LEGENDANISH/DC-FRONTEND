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
import useSocket from "../hooks/useSocket";
import { renderLeftSidebar } from "./renderLeftSidebar";
import { renderMainContent } from "./renderMainContent";

// Import new components
import FriendsPanel from "./FriendPannel";
import DirectMessages from "./DirectMessage";
import DeleteServerDialog from "./DeleteServerDialog";
import LeaveServerDialog from "./LeaveServerDialog";

// --- Interfaces ---
interface Server {
  id: string;
  name: string;
  description?: string;
  icon?: string | null;
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
  email?: string;
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
}

type ViewState =
  | { type: 'friends' }
  | { type: 'dm', user: User }
  | { type: 'server', serverId: string };

// --- Main Component ---
export default function DiscordClone() {
  // --- State ---
  const [open, setOpen] = useState(false);
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedView, setSelectedView] = useState<ViewState>({ type: 'friends' });
  const [join, setJoin] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [openChannelDialog, setOpenChannelDialog] = useState(false);
  const [openInviteDialog, setOpenInviteDialog] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openLeaveDialog, setOpenLeaveDialog] = useState(false);

  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [notifications, setNotifications] = useState<number>(0);

  // --- Hooks ---
  const { socket, isConnected, joinChannel, leaveChannel } = useSocket();

  // --- Effects ---
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

        if (res.ok) {
          const userData: User = await res.json();
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
    const fetchInviteCode = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const serverId = selectedView.type === "server" ? selectedView.serverId : null;
        if (!serverId) return;

        const res = await fetch(`http://localhost:3000/api/servers/${serverId}/invites`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch invite code: ${res.status}`);
        }

        const data = await res.json();
        setInviteCode(data.code);
      } catch (err) {
        console.error("Error fetching invite code:", err);
      }
    };

    fetchInviteCode();
  }, [selectedView]);

  useEffect(() => {
    const fetchServers = async () => {
      if (!user) return;

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
          setMessages([]);
        }
      } catch (err) {
        console.error("Error fetching messages:", err);
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [selectedChannel]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewMessage = (message: Message) => {
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isSending || m.id !== message.id);
        return [...filtered, message];
      });
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
      alert(`Error: ${error.message}`);
    };

    const handleFriendRequest = () => {
      setNotifications(prev => prev + 1);
    };

    socket.on('message', handleNewMessage);
    socket.on('message_update', handleMessageUpdate);
    socket.on('message_delete', handleMessageDelete);
    socket.on('error', handleError);
    socket.on('friend_request_received', handleFriendRequest);
    socket.on('direct_message_received', handleFriendRequest);

    return () => {
      socket.off('message', handleNewMessage);
      socket.off('message_update', handleMessageUpdate);
      socket.off('message_delete', handleMessageDelete);
      socket.off('error', handleError);
      socket.off('friend_request_received', handleFriendRequest);
      socket.off('direct_message_received', handleFriendRequest);
    };
  }, [socket, isConnected]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    return () => {
      if (selectedChannel) {
        leaveChannel(selectedChannel.id);
      }
    };
  }, [selectedChannel, socket, isConnected, leaveChannel]);

  useEffect(() => {
    if (selectedChannel && socket && isConnected) {
      joinChannel(selectedChannel.id);
    }
  }, [selectedChannel, socket, isConnected, joinChannel]);

  useEffect(() => {
    if (selectedView.type !== 'server') {
      setSelectedChannel(null);
      setMessages([]);
    }
  }, [selectedView]);

  // --- Handlers ---
  const handleLeave = async (serverId: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`http://localhost:3000/api/servers/${serverId}/leave`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to leave server");
      }

      setServers(prev => prev.filter(s => s.id !== serverId));
      setSelectedView({ type: "friends" });
      setOpenLeaveDialog(false);
    } catch (err) {
      console.error("Failed to leave server:", err);
      alert("Could not leave server.");
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`http://localhost:3000/api/servers/${serverId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to delete server");
      }

      setServers(prev => prev.filter(s => s.id !== serverId));
      setSelectedView({ type: 'friends' });
    } catch (err) {
      console.error(err);
      alert("Failed to delete server.");
    }
  };

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

    setMessages(prev => [...prev, tempMessage]);
    const messageContent = newMessage;
    setNewMessage("");

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
    } catch (err) {
      console.error("Failed to send message:", err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
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

  const handleChannelSelect = (channel: Channel) => {
    setSelectedChannel(channel);
    setMessages([]);
  };

  const handleSelectDM = (targetUser: User) => {
    setSelectedView({ type: 'dm', user: targetUser });
    setNotifications(0);
  };

  // --- Render ---
  return (
    <div className="h-screen w-screen flex bg-[#2C2D32] text-white overflow-hidden">
      {!isConnected && (
  <div className="absolute top-0 left-0 right-0 bg-yellow-600 text-center py-1 text-sm z-50 flex flex-col">
    <span>Connecting to server...</span>
    <span className="text-xs text-gray-100 mt-0.5">
      {selectedView.type === 'server'
        ? `Server: ${servers.find(s => s.id === selectedView.serverId)?.name || 'Unknown'}`
        : selectedView.type === 'dm'
        ? `Direct Message: ${selectedView.user?.username || 'Unknown'}`
        : 'Friends List'}
    </span>
  </div>
)}


{/* Main Vertical Navigation Sidebar */}
<div className="w-16 ml-2 overflow-y-auto no-scrollbar   bg-[#2C2D32] flex flex-col items-center mt-7 mb-10">
  {/* Top section (Friends Button) */}
  <div>
    <Button
      className={`relative rounded-full h-12 w-12 p-0 mt-2 ${
        selectedView.type === "friends" || selectedView.type === "dm"
          ? "!bg-indigo-600"
          : "!bg-gray-800 hover:!bg-indigo-500"
      }`}
      onClick={() => setSelectedView({ type: "friends" })}
      title="Direct Messages"
    >
      <MessageCircle className="h-5 w-5" />
      {notifications > 0 && (
        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {notifications > 9 ? "9+" : notifications}
        </div>
      )}
    </Button>

    <div className="w-8 h-0.5 bg-gray-600 rounded mx-auto my-3"></div>
  </div>

  {/* Scrollable servers list including Add & Join at end */}
  <div className="flex-1  ml-2  space-y-3">
    {servers.map((server) => (
      <Button
        key={server.id}
        className={`rounded-full h-12 w-12 p-0 overflow-hidden ${
          selectedView.type === "server" &&
          selectedView.serverId === server.id
            ? "!bg-indigo-600"
            : "!bg-gray-800 hover:!bg-indigo-500"
        }`}
        onClick={() =>
          setSelectedView({ type: "server", serverId: server.id })
        }
        title={server.name}
      >
        {server.icon ? (
          <img
            src={server.icon}
            alt={server.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xs font-bold">
            {server.name.charAt(0).toUpperCase()}
          </span>
        )}
      </Button>
    ))}

    {/* Add Server */}
    <Button
      className="rounded-full h-12 w-12 p-0 !bg-gray-800 hover:!bg-green-600"
      onClick={() => setOpen(true)}
      title="Add a Server"
    >
      <Plus className="h-6 w-6" />
    </Button>
    <CreateServerDialog open={open} onClose={() => setOpen(false)} />

    {/* Join Server */}
    <Button
      className="rounded-full h-12 w-12 p-0 !bg-gray-800 hover:!bg-green-600"
      onClick={() => setJoin(true)}
      title="Join a Server"
    >
      <Globe className="h-6 w-6" />
    </Button>
    <JoinServer open={join} onClose={() => setJoin(false)} />
  </div>
</div>


      {/* Left Sidebar (Contextual Content) */}
<div className="w-60 mt-7 ml-2 bg-[#2b2d31] flex flex-col rounded-tl-2xl border  border-r-0 overflow-hidden">
        {renderLeftSidebar({
          selectedView,
          servers,
          user,
          socket,
          handleSelectDM,
          setOpenInviteDialog,
          setOpenChannelDialog,
          setOpenDeleteDialog,
          setOpenLeaveDialog,
          openLeaveDialog,
          openChannelDialog,
          openDeleteDialog,
          openInviteDialog,
          inviteCode,
          handleLeave,
          handleDeleteServer,
          selectedChannel,
          handleChannelSelect
        })}
        
        {/* User Profile - Always visible at the bottom */}
        <div className="p-3 mb-4 border-t border-gray-700 flex items-center justify-between bg-[#232428]">
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
              <span className="text-sm font-medium truncate">{user?.username}</span>
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
      <div className="flex-1 flex flex-col bg-[#36393f] mt-7">
        {renderMainContent({
          selectedView,
          user,
          selectedChannel,
          messages,
          isLoadingMessages,
          newMessage,
          isConnected,
          handleMessageSend,
          handleKeyDown,
          setNewMessage
        })}
      </div>
    </div>
  );
}