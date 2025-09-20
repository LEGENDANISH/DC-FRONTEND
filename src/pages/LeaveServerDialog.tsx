// src/components/LeaveServerDialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface LeaveServerDialogProps {
  open: boolean;
  onClose: () => void;
  serverId: string;
  serverName: string;
  onLeave: (serverId: string) => void;
}

export default function LeaveServerDialog({ open, onClose, serverId, serverName, onLeave }: LeaveServerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#2b2d31] text-white">
        <DialogHeader>
          <DialogTitle>Leave Server</DialogTitle>
        </DialogHeader>
        <p>Are you sure you want to leave <span className="font-bold">{serverName}</span>?</p>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => onLeave(serverId)}
          >
            Leave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
