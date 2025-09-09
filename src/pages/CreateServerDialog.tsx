import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import axios from "axios";
import { useState } from "react";
import { z } from "zod";

const createServerSchema = z.object({
  name: z.string().min(1, "Server name is required").max(100, "Name must be under 100 characters"),
  description: z.string().max(500, "Description must be under 500 characters").optional(),
  icon: z.string().url("Must be a valid URL").optional(),
  isPublic: z.boolean().default(false)
});

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CreateServerDialog({ open, onClose }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    try {
      // Validate with zod before sending
      const validated = createServerSchema.parse({ name, description, icon, isPublic });

      const response = await axios.post(
        "http://localhost:3000/api/servers",
        validated,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );

      console.log("Server created:", response.data);
      setName("");
      setDescription("");
      setIcon("");
      setIsPublic(false);
      setErrors({});
      onClose(); // close dialog after creation
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        // Show frontend validation errors
        const formatted: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) {
            formatted[e.path[0].toString()] = e.message;
          }
        });
        setErrors(formatted);
      } else {
        console.error("Error creating server:", err);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create a New Server</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Server Name */}
          <div>
            <Label htmlFor="name">Server Name *</Label>
            <Input
              id="name"
              placeholder="My Cool Server"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && <p className="text-red-500 text-sm">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Optional (max 500 chars)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {errors.description && <p className="text-red-500 text-sm">{errors.description}</p>}
          </div>

          {/* Icon URL */}
          <div>
            <Label htmlFor="icon">Icon URL</Label>
            <Input
              id="icon"
              placeholder="https://example.com/icon.png"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
            />
            {errors.icon && <p className="text-red-500 text-sm">{errors.icon}</p>}
          </div>

          {/* Public Server Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isPublic"
              checked={isPublic}
              onCheckedChange={(checked) => setIsPublic(!!checked)}
            />
            <Label htmlFor="isPublic">Public Server</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="add" onClick={handleSubmit}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
