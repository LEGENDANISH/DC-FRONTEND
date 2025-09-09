import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { X } from "lucide-react";

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  inviteCode: string | null;
}

export default function InviteDialog({ open, onClose, inviteCode }: InviteDialogProps) {
  const handleCopy = async () => {
    if (!inviteCode) return;
    const inviteUrl = `${window.location.origin}/invite/${inviteCode}`;
    await navigator.clipboard.writeText(inviteUrl);
    alert("Invite link copied to clipboard!");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#2b2d31] text-white rounded-2xl shadow-lg">
        <DialogHeader className="flex justify-between items-center">
          <DialogTitle>Server Invite</DialogTitle>
        
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 p-4">
          <div className="bg-[#1e1f22] px-4 py-2 rounded-md font-mono text-lg">
            {inviteCode}
          </div>
          <Button className="w-full" onClick={handleCopy}>
            Copy Invite Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
