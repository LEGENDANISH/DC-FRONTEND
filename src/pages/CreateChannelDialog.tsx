import { useState } from "react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { Text, Volume2, Users } from "lucide-react"; // icons for types

interface CreateChannelDialogProps {
  open: boolean;
  onClose: () => void;
  serverId: string;
  onChannelCreated?: () => void;
}

export default function CreateChannelDialog({
  open,
  onClose,
  serverId,
  onChannelCreated,
}: CreateChannelDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"TEXT" | "VOICE" | "FORUM">("TEXT");
  const [topic, setTopic] = useState("");
  const [privateChannel, setPrivateChannel] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    try {
      setLoading(true);
      await axios.post(
        `http://localhost:3000/api/servers/${serverId}/channels`,
        {
          name,
          type,
          topic,
          position: 0,
          nsfw: false,
          slowMode: 0,
          private: privateChannel,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      setName("");
      setTopic("");
      setType("TEXT");
      setPrivateChannel(false);
      onChannelCreated?.();
      onClose();
    } catch (error) {
      console.error("Failed to create channel:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="bg-[#2b2d31] text-white w-[420px] max-w-[95%] rounded-lg shadow-lg
                   fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        <DialogHeader>
          <DialogTitle>Create Channel</DialogTitle>
          <p className="text-sm text-gray-400 mt-1">
            in Text channels
          </p>
        </DialogHeader>

        {/* Channel Type */}
        <div className="mt-4 space-y-2">
          <p className="font-medium">Channel Type</p>
          <div className="flex flex-col gap-2">
            <label
              className={`flex items-center justify-between p-2 rounded-md cursor-pointer
                        ${type === "TEXT" ? "bg-indigo-600" : "bg-[#1e1f22] hover:bg-gray-700"}`}
            >
              <div className="flex items-center gap-2">
                <Text className="w-5 h-5" />
                <div>
                  <p className="text-sm font-medium">Text</p>
                  <p className="text-xs text-gray-400">
                    Send messages, images, GIFs, emoji, opinions and puns
                  </p>
                </div>
              </div>
              <input
                type="radio"
                name="channel-type"
                className="hidden"
                checked={type === "TEXT"}
                onChange={() => setType("TEXT")}
              />
            </label>

            <label
              className={`flex items-center justify-between p-2 rounded-md cursor-pointer
                        ${type === "VOICE" ? "bg-indigo-600" : "bg-[#1e1f22] hover:bg-gray-700"}`}
            >
              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5" />
                <div>
                  <p className="text-sm font-medium">Voice</p>
                  <p className="text-xs text-gray-400">
                    Hang out together with voice, video and screen share
                  </p>
                </div>
              </div>
              <input
                type="radio"
                name="channel-type"
                className="hidden"
                checked={type === "VOICE"}
                onChange={() => setType("VOICE")}
              />
            </label>

            <label
              className={`flex items-center justify-between p-2 rounded-md cursor-pointer
                        ${type === "FORUM" ? "bg-indigo-600" : "bg-[#1e1f22] hover:bg-gray-700"}`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <div>
                  <p className="text-sm font-medium">Forum</p>
                  <p className="text-xs text-gray-400">
                    Create a space for organised discussions
                  </p>
                </div>
              </div>
              <input
                type="radio"
                name="channel-type"
                className="hidden"
                checked={type === "FORUM"}
                onChange={() => setType("FORUM")}
              />
            </label>
          </div>
        </div>

        {/* Channel Name */}
        <div className="mt-4 space-y-1">
          <p className="font-medium">Channel Name</p>
          <div className="flex items-center bg-[#1e1f22] rounded-md">
            <span className="px-2 text-gray-400">#</span>
            <Input
              placeholder="new-channel"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="bg-transparent border-0 flex-1 text-white"
            />
          </div>
        </div>

       

        <DialogFooter className="mt-4 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="bg-[#1e1f22] hover:bg-gray-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {loading ? "Creating..." : "Create Channel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
