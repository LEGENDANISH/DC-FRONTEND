import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useEffect, useState } from "react";

interface Friend {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  status: "ONLINE" | "OFFLINE" | "IDLE";
  bio?: string;
  createdAt: Date;
  friendshipId: string;
  friendsSince: Date;
}

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  inviteCode: string | null;
  serverName?: string; // Optional: e.g., "My Server"
}

export default function InviteDialog({ open, onClose, inviteCode, serverName }: InviteDialogProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredFriends, setFilteredFriends] = useState<Friend[]>([]);
console.log(inviteCode)
  // Fetch friends when dialog opens
  useEffect(() => {
    if (!open) return;

    const fetchFriends = async () => {
      try {
        const res = await fetch("/api/friends", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        if (!res.ok) throw new Error("Failed to load friends");

        const data = await res.json();
      console.log(data); // { friends: [...], pendingRequests: [...], sentRequests: [...] }
setFriends(data.friends);
setFilteredFriends(data.friends);
      } catch (error) {
        console.error("Error fetching friends:", error);
      }
    };

    fetchFriends();
  }, [open]);

  // Filter friends based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFriends(friends);
    } else {
      const filtered = friends.filter(
        (f) =>
          f.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredFriends(filtered);
    }
  }, [searchQuery, friends]);

  const handleCopyInviteLink = async () => {
    if (!inviteCode) return;
    const inviteUrl = `${window.location.origin}/invite/${inviteCode}`;
    await navigator.clipboard.writeText(inviteUrl);
    alert("Invite link copied to clipboard!");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#2b2d31] text-white rounded-2xl shadow-lg max-w-md w-full overflow-hidden">
        <DialogHeader className="flex justify-between items-center p-4 border-b border-gray-700">
          <DialogTitle>
            Invite friends to{" "}
            <span className="text-blue-400 font-semibold">{serverName || "your server"}</span>
          </DialogTitle>
         
        </DialogHeader>

        {/* Search Bar */}
        <div className="p-4">
          
          <div className="relative mb-4">
            
            <Input
              type="text"
              placeholder="Search for friends"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#1e1f22] border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500"
            />
           
          </div>

          {/* Friends List */}
          <div className="max-h-64 overflow-y-auto pr-2 space-y-2">
            {filteredFriends.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No friends found.</p>
            ) : (
              filteredFriends.map((friend) => (
                <div key={friend.id} className="flex items-center justify-between p-2 rounded-md hover:bg-[#1e1f22] transition-colors">
                  <div className="flex items-center gap-3">
                    <img
                      src={friend.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"}
                      alt={friend.displayName}
                      className="w-8 h-8 rounded-full"
                    />
                    <div>
                      <p className="font-medium">{friend.displayName}</p>
                      <p className="text-xs text-gray-400">@{friend.username}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="bg-transparent border-green-500 text-green-500 hover:bg-green-500 hover:text-white px-3 py-1 text-sm rounded-md transition-colors"
                    onClick={() => {
                      // You can add logic here to send invite request or use existing invite code
                      alert(`Inviting ${friend.displayName}...`);
                    }}
                  >
                    Invite
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Invite Link Section */}
        <div className="border-t border-gray-700 p-4 bg-[#1e1f22]">
          <p className="text-sm text-gray-400 mb-2">Or send a server invite link to a friend</p>
          <div className="flex items-center justify-between">
            <input
              type="text"
              value={inviteCode ? `http://localhost:3000/api/invites/${inviteCode}/join` : ""}
              readOnly
              className="bg-[#1e1f22] border border-gray-600 text-white px-3 py-2 rounded-md flex-grow text-sm focus:outline-none"
            />
            <Button
              onClick={handleCopyInviteLink}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm rounded-md ml-2 transition-colors"
            >
              Copy
            </Button>
          </div>
         
          
        </div>
        
      </DialogContent>
    </Dialog>
  );
}