import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Users, Headphones } from "lucide-react";
import CreateServerDialog from "./CreateServerDialog";
import { useEffect, useState } from "react";
import axios from "axios";
import { set } from "zod";
import { JoinServer } from "./Joinserver";
import { ChannelList } from "./Channel";
import CreateChannelDialog from "./CreateChannelDialog";
import InviteDialog from "./InviteDialog";

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

export default function DiscordClone() {
  const [open, setOpen] = useState(false);
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedView, setSelectedView] = useState<"friends" | { serverId: string }>("friends");
  const [channels, setChannels] = useState<Channel[]>([]);
const [join, setJoin] = useState(false);
  const [user, setUser] = useState<any>(null);
const [openChannelDialog, setOpenChannelDialog] = useState(false);
const [openInviteDialog, setOpenInviteDialog] = useState(false);
const [inviteCode, setInviteCode] = useState<string | null>(null);

  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
const [messages, setMessages] = useState<any[]>([]);
const [newMessage, setNewMessage] = useState("");

  // Fetch servers
  useEffect(() => {
    const fetchServers = async () => {
      try {
        const res = await axios.get("http://localhost:3000/api/servers", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        setServers(res.data);
      } catch (err) {
        console.error("Failed to fetch servers", err);
      }
    };
    fetchServers();
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // Fetch channels when a server is selected
  useEffect(() => {
    const fetchChannels = async () => {
      if (typeof selectedView === "object") {
        try {
          const res = await axios.get(
            `http://localhost:3000/api/servers/${selectedView.serverId}/channels`,
            {
              headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            }
          );
          setChannels(res.data);
        } catch (err) {
          console.error("Failed to fetch channels", err);
        }
      }
    };
    fetchChannels();
  }, [selectedView]);
useEffect(() => {
  const fetchMessages = async () => {
    if (selectedChannel) {
      try {
        const res = await axios.get(
          `http://localhost:3000/api/channels/${selectedChannel.id}/messages`,
          {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
          }
        );
        setMessages(res.data);
      } catch (err) {
        console.error("Failed to fetch messages", err);
      }
    }
  };
  fetchMessages();
}, [selectedChannel]);

  return (
    <div className="h-screen w-screen flex bg-[#313338] text-white">
      {/* Sidebar */}
      <div className="w-16 bg-[#1e1f22] flex flex-col items-center py-3 space-y-3">
        {/* Default "Friends" button */}
        <Button
          className={`rounded-full h-12 w-12 p-0 ${selectedView === "friends" ? "!bg-indigo-600" : "!bg-gray-800"}`}
          onClick={() => setSelectedView("friends")}
        >
          D
        </Button>

        {/* Subscribed servers */}
        {servers.map((server) => (
          <Button
            key={server.id}
            className={`rounded-full h-12 w-12 p-0 overflow-hidden ${
              typeof selectedView === "object" && selectedView.serverId === server.id
                ? "!bg-indigo-600"
                : "!bg-gray-800"
            }`}
            onClick={() => setSelectedView({ serverId: server.id })}
          >
            {server.owner.avatar ? (
              <img
                src={server.owner.avatar}
                alt={server.name}
                className="h-full w-full object-cover"
              />
            ) : (
              server.name.charAt(0).toUpperCase()
            )}
          </Button>
        ))}

        {/* Create new server button */}
        <Button
          className="rounded-full h-12 w-12 p-0 !bg-gray-800"
          onClick={() => setOpen(true)}
        >
          +
        </Button>

        <CreateServerDialog open={open} onClose={() => setOpen(false)} />

          <Button
          className="rounded-full h-12 w-12 p-0 !bg-gray-800"
          onClick={()=> setJoin(true)}
          >
            JOIN
          </Button>
  <JoinServer open={join} onClose={() => setJoin(false)} />

      </div>

      {/* Left Sidebar */}
      <div className="w-60 bg-[#2b2d31] flex flex-col">
        {selectedView === "friends" ? (
          <>
            {/* Search */}
            <div className="p-3">
              <Input placeholder="Find or start a conversation" className="bg-[#1e1f22] border-0 text-sm" />
            </div>

            {/* Friends Menu */}
            <nav className="flex flex-col space-y-2 px-3 text-gray-300 text-sm">
              <button className="flex items-center space-x-2 hover:bg-[#3c3e44] p-2 rounded">
                <Users className="h-4 w-4" /> <span>Friends</span>
              </button>
            </nav>

            {/* Direct Messages */}
            <div className="mt-4 px-3 text-xs text-gray-400">Direct Messages</div>
          </>
        ) : (
          <>
  {/* Server Channels */}
  <div className="p-3 text-sm font-semibold">Channels</div>

  {/* Channel List */}
 <ChannelList
  serverId={(selectedView as { serverId: string }).serverId}
  onSelect={(ch) => setSelectedChannel(ch)}
/>


  {/* Create Channel Button (only for server owner) */}
  {(() => {
    const server = servers.find(
      (s) => s.id === (selectedView as { serverId: string }).serverId
    );
    if (server && server.owner.id === user?.id) {
      return (
       <>
        <Button
          className="mx-3 mt-2 !bg-gray-800 w-full"
          onClick={() => setOpenChannelDialog(true)}
        >
          + Create Channel
        </Button>

        {/* Invite Button */}
<Button
  className="mx-3 mt-2 !bg-gray-800 w-full"
  onClick={async () => {
    try {
      const res = await axios.post(
        `http://localhost:3000/api/servers/${server.id}/invites`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      const invite = res.data;
      setInviteCode(invite.code);
      setOpenInviteDialog(true);
    } catch (err) {
      console.error("Failed to create invite", err);
      alert("Failed to create invite");
    }
  }}
>
  + Invite
</Button>
<InviteDialog
  open={openInviteDialog}
  onClose={() => setOpenInviteDialog(false)}
  inviteCode={inviteCode}
/>

      </>
    );
  }
  return null;
})()}


  {/* Create Channel Dialog */}
  <CreateChannelDialog
    open={openChannelDialog}
    onClose={() => setOpenChannelDialog(false)}
    serverId={(selectedView as { serverId: string }).serverId}
    onChannelCreated={() => {
      // refresh channel list after new channel is created
    }}
  />
</>

        )}

        {/* User profile */}
         <div className="mt-auto p-3 border-t border-gray-700 flex items-center justify-between z-10">
  <div className="flex items-center space-x-2">
    <Avatar className="h-8 w-8">
      <AvatarImage
        src={
          user?.avatar ||
          `https://api.dicebear.com/6.x/bottts/svg?seed=${user?.username}`
        }
      />
      <AvatarFallback>
        {user?.displayName?.[0]?.toUpperCase() || "?"}
      </AvatarFallback>
    </Avatar>

    {/* name + green dot + Online */}
    <div className="flex flex-col items-start">
      <span className="text-sm">{user?.username || ""}</span>
      <div className="flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
        <span className="text-xs text-gray-400">Online</span>
      </div>
    </div>
  </div>

  <Headphones className="h-5 w-5" />
</div>
  
      </div>

      {/* Main Content */}
<div className="flex-1 flex flex-col">
  {selectedChannel ? (
    <>
      {/* Channel header */}
      <div className="p-3 border-b border-gray-700">
        <span className="font-semibold"># {selectedChannel.name}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((msg) => (
          <div key={msg.id} className="flex items-start space-x-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={msg.author.avatar} />
              <AvatarFallback>{msg.author.username[0]}</AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm font-semibold">{msg.author.username}</div>
              <div className="text-sm">{msg.content}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Message input */}
      <div className="p-3 border-t border-gray-700 flex space-x-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={`Message #${selectedChannel.name}`}
          className="flex-1 bg-[#1e1f22] border-0"
        />
        <Button
          onClick={async () => {
            if (!newMessage.trim()) return;
            try {
              const res = await axios.post(
                `http://localhost:3000/api/channels/${selectedChannel.id}/messages`,
                { content: newMessage },
                { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
              );
              setMessages([...messages, res.data]);
              setNewMessage("");
            } catch (err) {
              console.error("Failed to send message", err);
            }
          }}
        >
          Send
        </Button>
      </div>
    </>
  ) : (
    <div className="flex-1 flex items-center justify-center text-gray-400">
      Select a channel to start messaging
    </div>
  )}
</div>


    </div>
  );  
}
