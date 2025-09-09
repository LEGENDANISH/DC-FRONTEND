import { useState } from "react";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const JoinServer = ({ open, onClose }: Props) => {
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      setMessage("Please enter an invite code.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      const token = localStorage.getItem("token"); // adjust if needed
      const res = await axios.post(
        `http://localhost:3000/api/invites/${inviteCode}/join`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setMessage(res.data.message || "Joined successfully!");
      setInviteCode("");

      // ✅ close immediately on success
      onClose();
    } catch (err: any) {
      setMessage(err.response?.data?.error || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join a Server</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input
            placeholder="Paste invite code here"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
          />
          <Button onClick={handleJoin} disabled={loading}>
            {loading ? "Joining..." : "Join"}
          </Button>
          {message && (
            <p className="text-sm text-gray-500 text-center">{message}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
