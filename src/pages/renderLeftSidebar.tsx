// src/components/renderLeftSidebar.tsx
import { ChannelList } from "./Channel";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  UserPlus,
  PlusCircle,
  Trash2,
  LogOut
} from "lucide-react";
import FriendsPanel from "./FriendPannel";
import CreateChannelDialog from "./CreateChannelDialog";
import InviteDialog from "./InviteDialog";
import DeleteServerDialog from "./DeleteServerDialog";
import LeaveServerDialog from "./LeaveServerDialog";

interface Server {
  id: string;
  name: string;
  description?: string;
  icon?: string | null;
  owner: { id: string; username: string; avatar: string | null };
}

interface Channel {
  id: string;
  name: string;
  type: "TEXT" | "VOICE";
  position: number;
}

interface User {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  status?: 'ONLINE' | 'IDLE' | 'DO_NOT_DISTURB' | 'OFFLINE';
  email?: string;
}

type ViewState =
  | { type: 'friends' }
  | { type: 'dm', user: User }
  | { type: 'server', serverId: string };

interface LeftSidebarProps {
  selectedView: ViewState;
  servers: Server[];
  user: User | null;
  socket: any;
  handleSelectDM: (targetUser: User) => void;
  setOpenInviteDialog: (open: boolean) => void;
  setOpenChannelDialog: (open: boolean) => void;
  setOpenDeleteDialog: (open: boolean) => void;
  setOpenLeaveDialog: (open: boolean) => void;
  openLeaveDialog: boolean;
  openChannelDialog: boolean;
  openDeleteDialog: boolean;
  openInviteDialog: boolean;
  inviteCode: string | null;
  handleLeave: (serverId: string) => void;
  handleDeleteServer: (serverId: string) => void;
  selectedChannel: Channel | null;
  handleChannelSelect: (channel: Channel) => void;
}

export const renderLeftSidebar = ({
  selectedView,
  servers,
  user,
  socket,
  handleSelectDM,
  setOpenInviteDialog,
  setOpenChannelDialog,
  setOpenDeleteDialog,
  setOpenLeaveDialog,
  openLeaveDialog,
  openChannelDialog,
  openDeleteDialog,
  openInviteDialog,
  inviteCode,
  handleLeave,
  handleDeleteServer,
  selectedChannel,
  handleChannelSelect
}: LeftSidebarProps) => {
  if (selectedView.type === "dm" || selectedView.type === "friends") {
    return (
      <div className="flex-1 overflow-y-auto rounded-tl-xl">
        <FriendsPanel
          socket={socket}
          onSelectDM={handleSelectDM}
        />
      </div>
    );
  } else if (selectedView.type === "server") {
    const server = servers.find(s => s.id === selectedView.serverId);
    return (
      <>
<div className="grid grid-cols-4 gap-2 items-center rounded-tl-xl border-b-1  border-r-0 ">
          <div className="col-span-3">
       <DropdownMenu>
  <DropdownMenuTrigger asChild>
    <div className="w-full flex ml-5 items-center justify-between h-12 bg-[#2b2d31] text-white cursor-pointer px-3">
      <span className="font-medium">{server?.name || "Server"}</span>
    </div>
  </DropdownMenuTrigger>

  <DropdownMenuContent className="bg-[#2b2d31] text-white w-52">
    {/* Invite */}
    <DropdownMenuItem
      onClick={() => setOpenInviteDialog(true)}
      className="hover:bg-gray-700 flex items-center justify-between px-3"
    >
      <span>Invite to Server</span>
      <UserPlus className="w-4 h-4" />
    </DropdownMenuItem>

    {server?.owner?.id === user?.id ? (
      <>
        {/* Create Channel */}
        <DropdownMenuItem
          onClick={() => setOpenChannelDialog(true)}
          className="hover:bg-gray-700 flex items-center justify-between px-3"
        >
          <span>Create Channel</span>
          <PlusCircle className="w-4 h-4" />
        </DropdownMenuItem>

        {/* Delete Server */}
        <DropdownMenuItem
          onClick={() => setOpenDeleteDialog(true)}
          className="hover:bg-red-700 flex items-center justify-between px-3 text-red-400"
        >
          <span>Delete Server</span>
          <Trash2 className="w-4 h-4" />
        </DropdownMenuItem>
      </>
    ) : (
      /* Leave Server */
      <DropdownMenuItem
        onClick={() => setOpenLeaveDialog(true)}
        className="hover:bg-red-700 flex items-center justify-between px-3 text-red-400"
      >
        <span>Leave Server</span>
        <LogOut className="w-4 h-4" />
      </DropdownMenuItem>
    )}
  </DropdownMenuContent>
</DropdownMenu>

          </div>

          <div className="flex justify-center">
            <UserPlus
              className="w-6 h-6 cursor-pointer hover:text-green-400"
              onClick={() => setOpenInviteDialog(true)}
              title="Invite to Server"
            />
          </div>

          <LeaveServerDialog
            open={openLeaveDialog}
            onClose={() => setOpenLeaveDialog(false)}
            serverId={server?.id || ""}
            serverName={server?.name || ""}
            onLeave={handleLeave}
          />

          <CreateChannelDialog
            open={openChannelDialog}
            onClose={() => setOpenChannelDialog(false)}
            serverId={selectedView.serverId}
          />

          <DeleteServerDialog
            open={openDeleteDialog}
            onClose={() => setOpenDeleteDialog(false)}
            serverId={server?.id || ""}
            serverName={server?.name || ""}
            onDelete={handleDeleteServer}
          />

          <InviteDialog
            open={openInviteDialog}
            onClose={() => setOpenInviteDialog(false)}
            inviteCode={inviteCode}
            serverName={server?.name}
          />
        </div>

        <div className="p-2 text-xs font-semibold uppercase text-gray-400 px-3">
          Text Channels
        </div>

        <div className="flex-1 overflow-y-auto">
          <ChannelList
            serverId={selectedView.serverId}
            onSelect={handleChannelSelect}
            selectedChannel={selectedChannel}
          />
        </div>
      </>
    );
  }
  return null;
};