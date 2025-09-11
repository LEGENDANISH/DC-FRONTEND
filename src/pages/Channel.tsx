// Channel.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import useSocket from "../hooks/useSocket"; // Adjust the path if needed

// Define the Channel interface locally if not globally available
export interface Channel { // Export the interface for use in DiscordClone.tsx if needed
  id: string;
  name: string;
  type: "TEXT" | "VOICE";
  position?: number; // Add position if your API returns it and you want to sort
  // Add other properties if your API returns them and you need them
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

  useEffect(() => {
    const fetchChannels = async () => {
      setError(null);
      setLoading(true);
      // Keep previous channels visible while loading new ones, or clear them immediately?
      // setChannels([]); // Uncomment if you prefer to clear immediately
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("No authentication token found.");
        }
        if (!serverId) {
          throw new Error("Invalid server ID.");
        }
        const res = await axios.get<Channel[]>(
          `http://localhost:3000/api/servers/${serverId}/channels`, // Ensure this endpoint matches your backend
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        // Sort channels by position if available
        const sortedChannels = res.data.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        setChannels(sortedChannels);
      } catch (err: any) {
        console.error("Failed to fetch channels for server", serverId, err);
        setError(err.message || "An error occurred while fetching channels.");
        // Optionally, keep previous channels or clear them on error
        // setChannels([]); // Uncomment if you want to clear on error
      } finally {
        setLoading(false);
      }
    };

    if (serverId) {
      fetchChannels();
    } else {
      setLoading(false);
      setChannels([]);
    }
  }, [serverId]); // Re-fetch if serverId changes (e.g., switching servers)

  // --- Real-time Channel Updates ---
  useEffect(() => {
    if (!socket || !isConnected || !serverId) {
      return;
    }

    // Join the server room to listen for server-wide events
    // Your backend needs to emit events to `server:${serverId}` room
    socket.emit('join_server', serverId); // Make sure your backend handles this

    const handleChannelCreate = (newChannel: Channel) => {
      console.log("Channel created via socket:", newChannel);
      // Ensure the new channel belongs to the current server (sanity check)
      // This assumes your backend sends the serverId with the event payload
      // or you only join the relevant server room.
      if (newChannel /* && newChannel.serverId === serverId */) { // Adjust check based on your backend payload
        setChannels((prevChannels) => {
          // Avoid duplicates
          if (prevChannels.some(c => c.id === newChannel.id)) {
            return prevChannels;
          }
          // Add new channel and re-sort if position is relevant
          const updatedChannels = [...prevChannels, newChannel];
          return updatedChannels.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        });
      }
    };

    const handleChannelDelete = (deletedChannel: { id: string }) => {
      console.log("Channel deleted via socket:", deletedChannel);
      if (deletedChannel.id) {
        setChannels((prevChannels) =>
          prevChannels.filter((channel) => channel.id !== deletedChannel.id)
        );
        // Optional: If the deleted channel was the selected one, clear selection
        // This logic might be better in DiscordClone.tsx
        // if (selectedChannel?.id === deletedChannel.id) {
        //   onSelect(null); // Requires modifying onSelect prop type to accept null
        // }
      }
    };

    const handleChannelUpdate = (updatedChannel: Channel) => {
        console.log("Channel updated via socket:", updatedChannel);
        setChannels((prevChannels) =>
          prevChannels.map((channel) =>
            channel.id === updatedChannel.id ? updatedChannel : channel
          ).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) // Re-sort if name/position changed
        );
    };

    // Listen for channel events
    socket.on('channel_create', handleChannelCreate);
    socket.on('channel_delete', handleChannelDelete);
    socket.on('channel_update', handleChannelUpdate); // Listen for updates

    // Cleanup listeners and leave room on unmount or server change
    return () => {
      socket.off('channel_create', handleChannelCreate);
      socket.off('channel_delete', handleChannelDelete);
      socket.off('channel_update', handleChannelUpdate);
      socket.emit('leave_server', serverId); // Make sure your backend handles this
    };
  }, [socket, isConnected, serverId]); // Re-run if socket, connection status, or serverId changes
  // --- End Real-time Updates ---

  if (loading && channels.length === 0) { // Show loading only if no channels yet
    return <p className="px-3 py-1 text-gray-400 text-sm">Loading channels...</p>;
  }

  if (error && channels.length === 0) { // Show error only if no channels to display
    return <p className="px-3 py-1 text-red-400 text-sm">Error: {error}</p>;
  }

  // If loading/error but channels exist (from previous fetch), show channels

  return (
    <nav className="flex flex-col space-y-1 px-2 text-gray-300 text-sm">
      {channels.length > 0 ? (
        channels.map((channel) => {
          const isSelected = selectedChannel?.id === channel.id;

          return (
            <button
              key={channel.id}
              onClick={() => onSelect(channel)}
              className={`flex items-center space-x-2 p-2 rounded text-left truncate ${
                isSelected
                  ? 'bg-[#3c3e44] text-white font-medium'
                  : 'hover:bg-[#35373c]'
              }`}
            >
              <span>{channel.type === "VOICE" ? "🔊" : "#"}</span>
              <span className="truncate">{channel.name}</span>
            </button>
          );
        })
      ) : (
        <p className="px-3 py-1 text-gray-500 text-xs">No channels available</p> // Adjusted message
      )}
    </nav>
  );
};