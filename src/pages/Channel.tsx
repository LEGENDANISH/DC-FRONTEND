// Channel.tsx
import { useEffect, useState } from "react";
import axios from "axios";

// Define the Channel interface locally if not globally available
interface Channel {
  id: string;
  name: string;
  type: "TEXT" | "VOICE";
  // Add other properties if your API returns them and you need them
}

interface ChannelListProps {
  serverId: string;
  onSelect: (channel: Channel) => void; // Function to call when a channel is selected
  selectedChannel: Channel | null;     // The currently selected channel object
}

export const ChannelList = ({ serverId, onSelect, selectedChannel }: ChannelListProps) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // Add error state

  useEffect(() => {
    const fetchChannels = async () => {
      // Reset state on server change or initial load
      setError(null);
      setLoading(true);
      setChannels([]); // Clear previous channels immediately
      try {
        const token = localStorage.getItem("token");
        if (!token) {
            throw new Error("No authentication token found.");
        }
        // Ensure serverId is valid before fetching
        if (!serverId) {
             throw new Error("Invalid server ID.");
        }
        const res = await axios.get<Channel[]>(
          `http://localhost:3000/api/servers/${serverId}/channels`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setChannels(res.data);
      } catch (err: any) {
        console.error("Failed to fetch channels for server", serverId, err);
        setError(err.message || "An error occurred while fetching channels.");
        setChannels([]); // Clear channels on error
      } finally {
        setLoading(false);
      }
    };

    if (serverId) { // Only fetch if serverId is provided and valid
       fetchChannels();
    } else {
       setLoading(false); // If no serverId, not loading
       setChannels([]);
    }
  }, [serverId]); // Re-run effect if serverId changes

  if (loading) {
    return <p className="px-3 py-1 text-gray-400 text-sm">Loading channels...</p>;
  }

  if (error) {
    return <p className="px-3 py-1 text-red-400 text-sm">Error: {error}</p>; // Display error
  }


  return (
    <nav className="flex flex-col space-y-1 px-2 text-gray-300 text-sm"> {/* Adjusted padding */}
      {channels.length > 0 ? (
        channels.map((channel) => {
          // Determine if this channel is the currently selected one
          const isSelected = selectedChannel?.id === channel.id;

          return (
            <button
              key={channel.id}
              onClick={() => onSelect(channel)} // Call the onSelect function passed from parent
              className={`flex items-center space-x-2 p-2 rounded text-left truncate ${
                isSelected
                  ? 'bg-[#3c3e44] text-white font-medium' // Highlight selected channel
                  : 'hover:bg-[#35373c]' // Hover effect for others
              }`}
            >
              {/* Channel Icon */}
              <span>{channel.type === "VOICE" ? "🔊" : "#"}</span>
              {/* Channel Name */}
              <span className="truncate">{channel.name}</span> {/* Truncate long names */}
            </button>
          );
        })
      ) : (
        <p className="px-3 py-1 text-gray-500 text-xs">No text channels available</p>
      )}
    </nav>
  );
};
