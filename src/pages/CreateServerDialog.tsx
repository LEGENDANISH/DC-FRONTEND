import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { useEffect, useState } from "react";

// Define the template types


interface CreateServerDialogProps {
  open: boolean;
  onClose: () => void;
  onServerCreated: (serverId: string) => void;
  onJoinServer: (inviteCode: string) => void;
}

export default function CreateServerDialog({ open, onClose, onServerCreated, onJoinServer }: CreateServerDialogProps) {
  const [step, setStep] = useState<'create' | 'type' | 'customize' | 'join'>('create');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [serverType, setServerType] = useState<'friends' | 'community' | null>(null);
  const [serverName, setServerName] = useState('');
  const [serverIcon, setServerIcon] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [inviteCode, setInviteCode] = useState('');

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    setStep('type');
  };

  // Handle server type selection
  const handleServerTypeSelect = (type: 'friends' | 'community') => {
    setServerType(type);
    setStep('customize');
  };

  // Handle form submission
const handleSubmit = async () => {
  if (!serverName.trim()) {
    setErrors({ serverName: 'Server name is required' });
    return;
  }

  try {
    const token = localStorage.getItem("token");
    if (!token) return;

    const body: Record<string, any> = {
      name: serverName.trim(),
      isPublic: serverType === 'community',
    };

    if (serverIcon) body.icon = serverIcon;
    if (serverName.trim()) body.description = ''; // optional

    const response = await fetch('http://localhost:3000/api/servers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      const data = await response.json();
      // Call the parent callback
      // Close the dialog
      onClose();

      // Reset form
      setErrors({});
      setServerName('');
      setServerIcon(null);
      setServerType(null);
      setStep('create');
      setSelectedTemplate(null);
    } else {
      const errorData = await response.json();
      console.error('Failed to create server', errorData);
      setErrors({ serverName: 'Failed to create server' });
    }
  } catch (error) {
    console.error('Error creating server:', error);
    setErrors({ serverName: 'Network error' });
  }
};



  // Handle join server submission
const handleJoinSubmit = async () => {
  if (!inviteCode.trim()) {
    setErrors({ inviteCode: "Invite code is required" });
    return;
  }

  // Extract code: split by /, remove empty parts, ignore "join"
  const parts = inviteCode.trim().split('/').filter(Boolean);
  let codeOnly = parts[parts.length - 1];
  if (codeOnly.toLowerCase() === 'join' && parts.length >= 2) {
    codeOnly = parts[parts.length - 2];
  }

  // Validate code
  if (!/^[a-zA-Z0-9]+$/.test(codeOnly)) {
    setErrors({ inviteCode: "Invalid invite code format" });
    return;
  }

  try {
    const token = localStorage.getItem("token");
    if (!token) {
      setErrors({ inviteCode: "You must be logged in" });
      return;
    }

    const response = await fetch(
      `http://localhost:3000/api/invites/${codeOnly}/join`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log("Joined server:", data);
      setInviteCode("");
      onClose(); // Close dialog only on success
    } else {
      const err = await response.json();
      setErrors({ inviteCode: err.error || "Failed to join server" });
    }
  } catch (error) {
    console.error("Error joining server:", error);
    setErrors({ inviteCode: "Network error" });
  }
};





  // Reset errors when closing dialog
  useEffect(() => {
    if (!open) {
      setErrors({});
      setServerName('');
      setServerIcon(null);
      setSelectedTemplate(null);
      setServerType(null);
      setInviteCode('');
      setStep('create');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-[#2b2d31] text-white rounded-lg shadow-lg">
        {step === 'create' ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Create Your Server</DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <p className="text-gray-400 text-center text-sm">
                Your server is where you and your friends hang out. Make yours and start talking.
              </p>

              {/* Create My Own */}
              <button 
                onClick={() => setStep('type')}
                className="w-full flex items-center justify-between p-3 border border-gray-600 rounded-md hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-green-400">🎨</span>
                  <span className="font-medium">Create My Own</span>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

             

              {/* Join Server Option */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Already have an invite?</h3>
                <button
                  onClick={() => setStep('join')}
                  className="w-full p-3 border border-gray-600 rounded-md hover:bg-gray-700 transition-colors text-left"
                >
                  Join a Server
                </button>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
            </DialogFooter>
          </>
        ) : step === 'type' ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Tell Us More About Your Server</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <p className="text-gray-400 text-center text-sm">
                In order to help you with your setup, is your new server for just a few friends or a larger community?
              </p>

              <button
                onClick={() => handleServerTypeSelect('friends')}
                className="w-full flex items-center justify-between p-3 border border-gray-600 rounded-md hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-pink-400">💖</span>
                  <span className="font-medium">For me and my friends</span>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={() => handleServerTypeSelect('community')}
                className="w-full flex items-center justify-between p-3 border border-gray-600 rounded-md hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-blue-400">🌍</span>
                  <span className="font-medium">For a club or community</span>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <p className="text-gray-400 text-xs text-center">
                Not sure? You can <span className="text-blue-400 cursor-pointer">skip this question</span> for now.
              </p>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep('create')}>Back</Button>
            </DialogFooter>
          </>
        ) : step === 'customize' ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Customise Your Server</DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <p className="text-gray-400 text-center text-sm">
                Give your new server a personality with a name and an icon. You can always change it later.
              </p>

              {/* Server Icon Upload */}
              <div className="flex justify-center">
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-gray-500 rounded-full">
                    <div className="flex flex-col items-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.84-1.68a2 2 0 011.664-.89H9a2 2 0 012 2v.93a2 2 0 00.89 1.664l1.68.84a2 2 0 01.89 1.664V15a2 2 0 01-2 2h-.93a2 2 0 00-1.664.89l-.84 1.68a2 2 0 01-1.664.89H9a2 2 0 01-2-2v-.93a2 2 0 00-.89-1.664l-1.68-.84A2 2 0 013 15V9z" />
                      </svg>
                      <p className="text-xs mt-1 text-gray-400">UPLOAD</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {}}
                    className="absolute top-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Server Name */}
              <div className="space-y-2">
                <Label htmlFor="serverName" className="text-sm font-medium">
                  Server Name
                </Label>
                <Input
                  id="serverName"
                  placeholder="My Awesome Server"
                  value={serverName}
                  onChange={(e) => {
                    setServerName(e.target.value);
                    if (errors.serverName) setErrors({});
                  }}
                  className="bg-[#1e1f22] border-gray-600 text-white focus:ring-blue-500"
                />
                {errors.serverName && (
                  <p className="text-red-500 text-sm">{errors.serverName}</p>
                )}
              </div>

              {/* Community Guidelines */}
              <p className="text-xs text-gray-400">
                By creating a server, you agree to Discord's{' '}
                <span className="text-blue-400 cursor-pointer">Community Guidelines</span>.
              </p>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep('type')}>Back</Button>
              <Button 
                onClick={handleSubmit}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition-colors"
              >
                Create
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Join a Server</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <p className="text-gray-400 text-center text-sm">
                Enter an invite below to join an existing server
              </p>

              {/* Invite Link Input */}
              <div className="space-y-2">
                <Label htmlFor="inviteCode" className="text-sm font-medium">
                  Invite link *
                </Label>
                <Input
                  id="inviteCode"
                  placeholder="https://localhost:3000/invites/code/join"
                  value={inviteCode}
                  onChange={(e) => {
                    setInviteCode(e.target.value);
                    if (errors.inviteCode) setErrors({});
                  }}
                  className="bg-[#1e1f22] border-gray-600 text-white focus:ring-blue-500"
                />
                {errors.inviteCode && (
                  <p className="text-red-500 text-sm">{errors.inviteCode}</p>
                )}
              </div>

              {/* Example Invites
              <div className="space-y-1">
                <p className="text-gray-400 text-xs">Invites should look like</p>
                <div className="text-sm text-gray-400 space-y-1">
                  <p>hTKzmak</p>
                  <p>https://discord.gg/hTKzmak</p>
                  <p>https://discord.gg/wumpus-friends</p>
                </div>
              </div> */}

              {/* Discoverable Communities */}
              <div className="p-3 bg-[#1e1f22] border border-gray-600 rounded-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium">Don't have an invite?</p>
                      <p className="text-xs text-gray-400">Check out Discoverable communities in Server Discovery.</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep('create')}>Back</Button>
              <Button 
                onClick={handleJoinSubmit}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition-colors"
              >
                Join Server
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}