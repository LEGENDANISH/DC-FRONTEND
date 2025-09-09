import { useEffect, useState } from "react";
import axios from "axios";

interface Channel {
  id: string;
  name: string;
  type: "TEXT" | "VOICE";
}

export const ChannelList = ({ serverId }: { serverId: string }) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(
          `http://localhost:3000/api/servers/${serverId}/channels`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setChannels(res.data); // assuming API returns an array of channels
      } catch (err) {
        console.error("Failed to fetch channels", err);
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, [serverId]);

  if (loading) {
    return <p className="px-3 text-gray-400 text-sm">Loading channels...</p>;
  }

  return (
    <nav className="flex flex-col space-y-2 px-3 text-gray-300 text-sm">
      {channels.length > 0 ? (
        channels.map((ch) => (
          <button
            key={ch.id}
            className="flex items-center space-x-2 hover:bg-[#3c3e44] p-2 rounded"
          >
            <span>{ch.type === "VOICE" ? "🔊" : "#"}</span>
            <span>{ch.name}</span>
          </button>
        ))
      ) : (
        <p className="text-gray-500">No channels available</p>
      )}
    </nav>
  );
};
