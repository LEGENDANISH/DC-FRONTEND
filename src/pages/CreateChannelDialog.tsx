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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";

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
  const [type, setType] = useState("TEXT");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    try {
      setLoading(true);
      await axios.post(
        `http://localhost:3000/api/servers/${serverId}/channels`, // 👈 proxy handles it
        {
          name,
          type,
          topic,
          position: 0,
          nsfw: false,
          slowMode: 0,
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
      <DialogContent className="bg-[#2b2d31] text-white">
        <DialogHeader>
          <DialogTitle>Create Channel</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Channel name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            className="bg-[#1e1f22] border-0"
          />

          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="bg-[#1e1f22] border-0">
              <SelectValue placeholder="Select channel type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TEXT">Text</SelectItem>
              <SelectItem value="VOICE">Voice</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Topic (optional)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={loading}
            className="bg-[#1e1f22] border-0"
          />
        </div>

        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
