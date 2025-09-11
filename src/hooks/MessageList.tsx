// Messages.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import useSocket from "../hooks/useSocket";

export interface Message {
  id: string;
  channelId: string;
  content: string;
  senderName: string;
  createdAt: string;
  replyToId?: string;
}

interface MessagesProps {
  channelId: string;
}

const Messages = ({ channelId }: MessagesProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");

  const { socket, isConnected } = useSocket();

  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("token");
        if (!token) throw new Error("No token found");

        const res = await axios.get<Message[]>(
          `http://localhost:3000/api/channels/${channelId}/messages`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessages(res.data);
      } catch (err: any) {
        setError(err.message || "Failed to fetch messages");
      } finally {
        setLoading(false);
      }
    };

    if (channelId) fetchMessages();
    else setMessages([]);
  }, [channelId]);

  // Real-time updates
  useEffect(() => {
    if (!socket || !isConnected || !channelId) return;

    // Join channel room
    socket.emit("join_channel", channelId);

    const handleNewMessage = (msg: Message) => {
      if (msg.channelId === channelId) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    socket.on("message", handleNewMessage);

    return () => {
      socket.off("message", handleNewMessage);
      socket.emit("leave_channel", channelId);
    };
  }, [socket, isConnected, channelId]);

  // Send message
  const sendMessage = () => {
    if (!newMessage.trim()) return;
    socket?.emit("message", { channelId, content: newMessage });
    setNewMessage("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading ? (
          <p className="text-gray-400 text-sm">Loading messages...</p>
        ) : error ? (
          <p className="text-red-400 text-sm">{error}</p>
        ) : messages.length === 0 ? (
          <p className="text-gray-500 text-sm">No messages yet</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="text-sm">
              <span className="font-semibold">{msg.senderName}: </span>
              <span>{msg.content}</span>
              <span className="text-gray-400 text-xs ml-2">
                {new Date(msg.createdAt).toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Input to send new message */}
      <div className="flex p-2 border-t border-gray-700">
        <input
          type="text"
          className="flex-1 bg-gray-800 text-white p-2 rounded"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          className="ml-2 bg-blue-600 px-4 py-2 rounded hover:bg-blue-700"
          onClick={sendMessage}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Messages;
