// src/components/renderMainContent.tsx
import { Users } from "lucide-react";
import DirectMessages from "./DirectMessage";
import ChannelViewer from "./ChannelView";

interface User {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  status?: 'ONLINE' | 'IDLE' | 'DO_NOT_DISTURB' | 'OFFLINE';
  email?: string;
}

interface Channel {
  id: string;
  name: string;
  type: "TEXT" | "VOICE";
  position: number;
}

type ViewState =
  | { type: 'friends' }
  | { type: 'dm', user: User }
  | { type: 'server', serverId: string };

interface MainContentProps {
  selectedView: ViewState;
  user: User | null;
  selectedChannel: Channel | null;
  // Remove unused props since ChannelViewer handles its own state
  // messages: Message[];
  // isLoadingMessages: boolean;
  // newMessage: string;
  // isConnected: boolean;
  // handleMessageSend: () => void;
  // handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  // setNewMessage: (message: string) => void;
}

export const renderMainContent = ({
  selectedView,
  user,
  selectedChannel,
}: MainContentProps) => {
  if (selectedView.type === "friends") {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-[#36393f] text-gray-400">
        <Users className="h-24 w-24 mb-4 text-gray-500" />
        <h1 className="text-3xl font-bold mb-2">Friends</h1>
        <p className="mb-4">Select friends from the sidebar to view and manage your connections.</p>
      </div>
    );
  } else if (selectedView.type === "dm") {
    return (
      <DirectMessages
        currentUser={user}
        selectedUser={selectedView.user}
      />
    );
  } else if (selectedView.type === "server" && selectedChannel) {
    return (
      <ChannelViewer
        selectedChannel={selectedChannel}
        currentUser={user}
      />
    );
  } else if (selectedView.type === "server") {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-[#36393f] text-gray-400">
        <div className="text-3xl font-bold mb-2">Welcome!</div>
        <p className="mb-4">Select a channel to start chatting.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full items-center justify-center bg-[#36393f] text-gray-400">
      <div className="text-3xl font-bold mb-2">Welcome!</div>
      <p className="mb-4">Select a view to get started.</p>
    </div>
  );
};