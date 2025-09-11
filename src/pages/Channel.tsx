// Channel.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import useSocket from "../hooks/useSocket";
import { Hash } from "lucide-react";

export interface Channel {
  id: string;
  name: string;
  type: "TEXT" | "VOICE" | "CATEGORY" | "ANNOUNCEMENT" | "STAGE" | "FORUM";
  position?: number;
  serverId?: string;
  topic?: string;
  nsfw?: boolean;
  bitrate?: number;
  userLimit?: number;
  slowMode?: number;
}

interface ChannelListProps {
  serverId: string;
  onSelect: (channel: Channel) => void;
  selectedChannel: Channel | null;
}

export const ChannelList = ({ serverId, onSelect, selectedChannel }: ChannelListProps) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get socket instance from the hook
  const { socket, isConnected } = useSocket();

  // Fetch channels from API
  useEffect(() => {
    const fetchChannels = async () => {
      if (!serverId) {
        setChannels([]);
        setLoading(false);
        return;
      }

      setError(null);
      setLoading(true);
      
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("No authentication token found.");
        }

        const res = await axios.get<Channel[]>(
          `http://localhost:3000/api/servers/${serverId}/channels`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        
        // Sort channels by position, then by name
        const sortedChannels = res.data
          .filter(channel => channel.type === 'TEXT' || channel.type === 'VOICE') // Only show text and voice channels
          .sort((a, b) => {
            if (a.position !== undefined && b.position !== undefined) {
              return a.position - b.position;
            }
            return a.name.localeCompare(b.name);
          });
        
        setChannels(sortedChannels);
      } catch (err: any) {
        console.error("Failed to fetch channels for server", serverId, err);
        setError(err.response?.data?.error || err.message || "Failed to fetch channels");
        setChannels([]);
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, [serverId]);

  // Real-time channel updates via WebSocket
  useEffect(() => {
    if (!socket || !isConnected || !serverId) {
      return;
    }

    console.log('Setting up channel listeners for server:', serverId);

    const handleChannelCreate = (newChannel: Channel) => {
      console.log("Channel created via socket:", newChannel);
      // Only add if it belongs to current server and is TEXT/VOICE
      if (newChannel.serverId === serverId && (newChannel.type === 'TEXT' || newChannel.type === 'VOICE')) {
        setChannels(prevChannels => {
          // Check if channel already exists
          if (prevChannels.some(c => c.id === newChannel.id)) {
            return prevChannels;
          }
          
          // Add and re-sort
          const updatedChannels = [...prevChannels, newChannel];
          return updatedChannels.sort((a, b) => {
            if (a.position !== undefined && b.position !== undefined) {
              return a.position - b.position;
            }
            return a.name.localeCompare(b.name);
          });
        });
      }
    };

    const handleChannelUpdate = (updatedChannel: Channel) => {
      console.log("Channel updated via socket:", updatedChannel);
      if (updatedChannel.serverId === serverId) {
        setChannels(prevChannels => {
          const updated = prevChannels.map(channel =>
            channel.id === updatedChannel.id ? updatedChannel : channel
          );
          
          // Re-sort after update
          return updated.sort((a, b) => {
            if (a.position !== undefined && b.position !== undefined) {
              return a.position - b.position;
            }
            return a.name.localeCompare(b.name);
          });
        });
      }
    };

    const handleChannelDelete = (data: { id: string; serverId?: string }) => {
      console.log("Channel deleted via socket:", data);
      if (!data.serverId || data.serverId === serverId) {
        setChannels(prevChannels =>
          prevChannels.filter(channel => channel.id !== data.id)
        );
      }
    };

    // Listen for channel events
    socket.on('channel_create', handleChannelCreate);
    socket.on('channel_update', handleChannelUpdate);
    socket.on('channel_delete', handleChannelDelete);

    // Join server room to receive server-wide events
    socket.emit('join_server', serverId);

    return () => {
      socket.off('channel_create', handleChannelCreate);
      socket.off('channel_update', handleChannelUpdate);
      socket.off('channel_delete', handleChannelDelete);
      socket.emit('leave_server', serverId);
    };
  }, [socket, isConnected, serverId]);

  // Loading state
  if (loading && channels.length === 0) {
    return (
      <div className="px-3 py-2">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded mb-2"></div>
          <div className="h-4 bg-gray-700 rounded mb-2 w-3/4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  // Error state (only show if no channels to display)
  if (error && channels.length === 0) {
    return (
      <div className="px-3 py-2">
        <p className="text-red-400 text-sm">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="text-xs text-gray-400 hover:text-gray-300 mt-1"
        >
          Retry
        </button>
      </div>
    );
  }

  // Separate channels by type
  const textChannels = channels.filter(channel => channel.type === 'TEXT');
  const voiceChannels = channels.filter(channel => channel.type === 'VOICE');

  return (
    <nav className="flex flex-col space-y-1 px-2 text-gray-300 text-sm">
      {/* Text Channels */}
      {textChannels.length > 0 && (
        <>
          <div className="text-xs font-semibold uppercase text-gray-400 px-1 mt-2 mb-1">
            Text Channels
          </div>
          {textChannels.map((channel) => {
            const isSelected = selectedChannel?.id === channel.id;
            return (
              <button
                key={channel.id}
                onClick={() => onSelect(channel)}
                className={`flex items-center space-x-2 p-2 rounded text-left truncate transition-colors ${
                  isSelected
                    ? 'bg-[#3c3e44] text-white font-medium'
                    : 'hover:bg-[#35373c] hover:text-gray-100'
                }`}
                title={channel.topic || channel.name}
              >
                <Hash className="h-4 w-4 flex-shrink-0 text-gray-400" />
                <span className="truncate">{channel.name}</span>
                {channel.nsfw && (
                  <span className="text-xs bg-red-600 px-1 rounded">NSFW</span>
                )}
              </button>
            );
          })}
        </>
      )}

      {/* Voice Channels */}
      {voiceChannels.length > 0 && (
        <>
          <div className="text-xs font-semibold uppercase text-gray-400 px-1 mt-4 mb-1">
            Voice Channels
          </div>
          {voiceChannels.map((channel) => {
            const isSelected = selectedChannel?.id === channel.id;
            return (
              <button
                key={channel.id}
                onClick={() => onSelect(channel)}
                className={`flex items-center space-x-2 p-2 rounded text-left truncate transition-colors ${
                  isSelected
                    ? 'bg-[#3c3e44] text-white font-medium'
                    : 'hover:bg-[#35373c] hover:text-gray-100'
                }`}
                title={`Voice Channel: ${channel.name}`}
              >
                <svg 
                  className="h-4 w-4 flex-shrink-0 text-gray-400" 
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path d="M12 1c-1.336 0-2.4 1.079-2.4 2.4v9.6c0 1.321 1.064 2.4 2.4 2.4s2.4-1.079 2.4-2.4V3.4C14.4 2.079 13.336 1 12 1zM12 17.5c-2.209 0-4-1.791-4-4v-1c0-.276-.224-.5-.5-.5s-.5.224-.5.5v1c0 2.485 1.824 4.544 4.2 4.939V21.5h-2c-.276 0-.5.224-.5.5s.224.5.5.5h5c.276 0 .5-.224.5-.5s-.224-.5-.5-.5h-2v-4.061c2.376-.395 4.2-2.454 4.2-4.939v-1c0-.276-.224-.5-.5-.5s-.5.224-.5.5v1c0 2.209-1.791 4-4 4z"/>
                </svg>
                <span className="truncate">{channel.name}</span>
                {channel.userLimit && (
                  <span className="text-xs text-gray-500">
                    0/{channel.userLimit}
                  </span>
                )}
              </button>
            );
          })}
        </>
      )}

      {/* No channels message */}
      {channels.length === 0 && !loading && !error && (
        <div className="px-3 py-4 text-center">
          <p className="text-gray-500 text-xs mb-2">No channels available</p>
          <p className="text-gray-600 text-xs">
            Ask a server admin to create some channels.
          </p>
        </div>
      )}

      {/* Loading indicator */}
      {loading && channels.length > 0 && (
        <div className="px-3 py-1 text-xs text-gray-500">
          Updating channels...
        </div>
      )}
    </nav>
  );
};