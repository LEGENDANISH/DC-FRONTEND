import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface DeleteServerDialogProps {
  open: boolean;
  onClose: () => void;
  serverId: string;
  serverName: string;
  onDelete: (serverId: string) => void; // Callback to delete the server
}

export default function DeleteServerDialog({ open, onClose, serverId, serverName, onDelete }: DeleteServerDialogProps) {
  const [inputValue, setInputValue] = useState("");

  const isNameMatched = inputValue.trim() === serverName;

  const handleDelete = () => {
    if (!isNameMatched) return;
    onDelete(serverId);
    onClose();
    setInputValue(""); // Reset input
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Server "{serverName}"</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-300 my-4">
          Are you sure you want to delete this server? This action cannot be undone. 
          Please type the server name to confirm.
        </p>

        <Input
          placeholder="Type server name here"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />

        <DialogFooter className="mt-4 flex justify-end space-x-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-red-600 hover:bg-red-700"
            disabled={!isNameMatched}
            onClick={handleDelete}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
