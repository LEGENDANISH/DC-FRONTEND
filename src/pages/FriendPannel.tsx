import React, { useState, useEffect } from 'react';
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { 
  Users, 
  UserPlus, 
  UserX, 
  MessageCircle, 
  Search, 
  Check, 
  X,
  MoreHorizontal,
  UserMinus,
  Shield
} from "lucide-react";
import axios from 'axios';

interface User {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  status?: 'ONLINE' | 'IDLE' | 'DO_NOT_DISTURB' | 'OFFLINE';
}

interface Friend extends User {
  friendsSince: string;
}

interface FriendRequest {
  id: string;
  sender: User;
  createdAt: string;
}

interface SentRequest {
  id: string;
  receiver: User;
  createdAt: string;
}

interface SearchResult extends User {
  friendshipStatus: 'NONE' | 'PENDING' | 'ACCEPTED' | 'BLOCKED';
  canSendRequest: boolean;
}

interface FriendsPanelProps {
  socket?: any;
  onSelectDM: (user: User) => void;
}

export default function FriendsPanel({ socket, onSelectDM }: FriendsPanelProps) {
  const [activeTab, setActiveTab] = useState<'online' | 'all' | 'pending' | 'add'>('online');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addFriendInput, setAddFriendInput] = useState('');

  // Fetch initial friends data
  useEffect(() => {
    fetchFriends();
    fetchPendingRequests();
    fetchSentRequests();
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleFriendsData = (data: any) => {
      setFriends(data.friends);
      setPendingRequests(data.pendingRequests);
      setSentRequests(data.sentRequests);
    };

    const handleFriendRequest = (request: FriendRequest) => {
      setPendingRequests(prev => [request, ...prev]);
    };

    const handleFriendAdded = (data: { friend: Friend }) => {
      setFriends(prev => [...prev, data.friend]);
      // Remove from pending if it exists
      setPendingRequests(prev => prev.filter(r => r.sender.id !== data.friend.id));
    };

    const handleFriendRemoved = (data: { userId: string }) => {
      setFriends(prev => prev.filter(f => f.id !== data.userId));
    };

    const handleFriendStatusUpdate = (data: { userId: string; status: string }) => {
      setFriends(prev => prev.map(f => 
        f.id === data.userId ? { ...f, status: data.status as any } : f
      ));
    };

    const handleRequestRemoved = (data: { requestId: string }) => {
      setPendingRequests(prev => prev.filter(r => r.id !== data.requestId));
    };

    socket.on('friends_initial_data', handleFriendsData);
    socket.on('friend_request_received', handleFriendRequest);
    socket.on('friend_added', handleFriendAdded);
    socket.on('friend_removed', handleFriendRemoved);
    socket.on('friend_status_update', handleFriendStatusUpdate);
    socket.on('friend_request_removed', handleRequestRemoved);

    return () => {
      socket.off('friends_initial_data', handleFriendsData);
      socket.off('friend_request_received', handleFriendRequest);
      socket.off('friend_added', handleFriendAdded);
      socket.off('friend_removed', handleFriendRemoved);
      socket.off('friend_status_update', handleFriendStatusUpdate);
      socket.off('friend_request_removed', handleRequestRemoved);
    };
  }, [socket]);

  const fetchFriends = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await axios.get<Friend[]>('http://localhost:3000/api/friends', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFriends(res.data);
    } catch (error) {
      console.error('Failed to fetch friends:', error);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await axios.get<FriendRequest[]>('http://localhost:3000/api/friends/requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingRequests(res.data);
    } catch (error) {
      console.error('Failed to fetch pending requests:', error);
    }
  };

  const fetchSentRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await axios.get<SentRequest[]>('http://localhost:3000/api/friends/requests/sent', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSentRequests(res.data);
    } catch (error) {
      console.error('Failed to fetch sent requests:', error);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await axios.get<SearchResult[]>('http://localhost:3000/api/users/search', {
        headers: { Authorization: `Bearer ${token}` },
        params: { q: query }
      });
      setSearchResults(res.data);
    } catch (error) {
      console.error('Failed to search users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const sendFriendRequest = async (username: string) => {
    if (socket) {
      socket.emit('send_friend_request', { username });
      setAddFriendInput('');
    } else {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        await axios.post('http://localhost:3000/api/friends/request', 
          { username },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setAddFriendInput('');
        alert('Friend request sent!');
      } catch (error: any) {
        alert(error.response?.data?.error || 'Failed to send friend request');
      }
    }
  };

  const respondToFriendRequest = async (requestId: string, accept: boolean) => {
    if (socket) {
      socket.emit('respond_friend_request', { requestId, accept });
    } else {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        await axios.patch(`http://localhost:3000/api/friends/requests/${requestId}`, 
          { action: accept ? 'accept' : 'decline' },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (accept) {
          fetchFriends();
        }
        fetchPendingRequests();
      } catch (error) {
        console.error('Failed to respond to friend request:', error);
      }
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!confirm('Are you sure you want to remove this friend?')) return;

    if (socket) {
      socket.emit('remove_friend', { friendId });
    } else {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        await axios.delete(`http://localhost:3000/api/friends/${friendId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchFriends();
      } catch (error) {
        console.error('Failed to remove friend:', error);
      }
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'ONLINE': return 'bg-green-400';
      case 'IDLE': return 'bg-yellow-400';
      case 'DO_NOT_DISTURB': return 'bg-red-400';
      default: return 'bg-gray-400';
    }
  };

  const filteredFriends = friends.filter(friend => {
    if (activeTab === 'online') return friend.status === 'ONLINE';
    return true;
  });

  // Search functionality
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchQuery.trim()) {
        searchUsers(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  return (
    <div className="flex flex-col h-full bg-[#2f3136]">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center space-x-2 mb-4">
          <Users className="h-6 w-6 text-white" />
          <h1 className="text-xl font-bold text-white">Friends</h1>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#1e1f22] border-gray-600 text-white"
          />
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="grid grid-cols-4 gap-2 p-2 border-b border-[#202225]">
        <Button
          variant={activeTab === "online" ? "default" : "ghost"}
          onClick={() => setActiveTab("online")}
          className="flex flex-col items-center justify-center h-12"
        >
          <Users  />
          <span className="text-[10px]">Online ({friends.filter(f => f.status === "ONLINE").length})</span>
        </Button>
        <Button
          variant={activeTab === "all" ? "default" : "ghost"}
          onClick={() => setActiveTab("all")}
          className="flex flex-col items-center justify-center h-12"
        >
          <Users className="h-5 w-5 mb-1" />
          <span className="text-xs">All ({friends.length})</span>
        </Button>
        <Button
          variant={activeTab === "pending" ? "default" : "ghost"}
          onClick={() => setActiveTab("pending")}
          className="flex flex-col items-center justify-center h-12"
        >
          <MessageCircle className="h-5 w-5 mb-1" />
          <span className="text-[10px]">Pending ({pendingRequests.length})</span>
        </Button>
        <Button
          variant={activeTab === "add" ? "default" : "ghost"}
          onClick={() => setActiveTab("add")}
          className="flex flex-col items-center justify-center h-12"
        >
          <UserPlus className="h-5 w-5 mb-1" />
          <span className="text-xs">Add</span>
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Search Results */}
        {searchQuery.trim() && (
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-2 uppercase">Search Results</h3>
            {isSearching ? (
              <div className="text-gray-400 text-sm">Searching...</div>
            ) : searchResults.length === 0 ? (
              <div className="text-gray-400 text-sm">No users found</div>
            ) : (
              <div className="space-y-2">
                {searchResults.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-2 bg-[#36393f] rounded">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar || `https://api.dicebear.com/6.x/bottts/svg?seed=${user.username}`} />
                          <AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#36393f] ${getStatusColor(user.status)}`} />
                      </div>
                      <div>
                        <div className="font-semibold text-white">{user.displayName || user.username}</div>
                        <div className="text-sm text-gray-400">@{user.username}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ">
                      {user.friendshipStatus === 'NONE' && (
                        <Button
                          size="sm"
                          onClick={() => sendFriendRequest(user.username)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      )}
                      {user.friendshipStatus === 'PENDING' && (
                        <span className="text-xs text-yellow-400">Request Sent</span>
                      )}
                      {user.friendshipStatus === 'ACCEPTED' && (
                        <Button
                          size="sm"
                          onClick={() => onSelectDM(user)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content */}
        {!searchQuery.trim() && (
          <>
            {/* Online/All Friends */}
            {(activeTab === 'online' || activeTab === 'all') && (
              <div className="p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-2 uppercase">
                  {activeTab === 'online' ? 'Online' : 'All Friends'} — {filteredFriends.length}
                </h3>
                {filteredFriends.length === 0 ? (
                  <div className="text-gray-400 text-sm text-center py-8">
                    {activeTab === 'online' ? 'No friends online' : 'No friends yet'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredFriends.map(friend => (
                      <div key={friend.id} className="flex items-center justify-between p-2 hover:bg-[#36393f] rounded group">
                        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectDM(friend)}>
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={friend.avatar || `https://api.dicebear.com/6.x/bottts/svg?seed=${friend.username}`} />
                              <AvatarFallback>{friend.username[0]?.toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#2f3136] ${getStatusColor(friend.status)}`} />
                          </div>
                          <div>
                            
                            <div className="font-semibold text-white">{friend.displayName || friend.username}</div>
                            <div className="text-sm text-gray-400 capitalize">
                              {friend.status?.toLowerCase().replace('_', ' ') || 'offline'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeFriend(friend.id)}
                            className="hover:bg-red-600"
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pending Friend Requests */}
            {activeTab === 'pending' && (
              <div className="p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-2 uppercase">
                  Pending — {pendingRequests.length}
                </h3>
                {pendingRequests.length === 0 ? (
                  <div className="text-gray-400 text-sm text-center py-8">
                    No pending friend requests
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingRequests.map(request => (
                      <div key={request.id} className="flex items-center justify-between p-3 bg-[#36393f] rounded">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={request.sender.avatar || `https://api.dicebear.com/6.x/bottts/svg?seed=${request.sender.username}`} />
                            <AvatarFallback>{request.sender.username[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold text-white">{request.sender.displayName || request.sender.username}</div>
                            <div className="text-sm text-gray-400">@{request.sender.username}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            onClick={() => respondToFriendRequest(request.id, true)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => respondToFriendRequest(request.id, false)}
                            className="hover:bg-red-600"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sent Requests */}
                {sentRequests.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-400 mb-2 mt-6 uppercase">
                      Outgoing — {sentRequests.length}
                    </h3>
                    <div className="space-y-2">
                      {sentRequests.map(request => (
                        <div key={request.id} className="flex items-center justify-between p-2 bg-[#36393f] rounded">
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={request.receiver.avatar || `https://api.dicebear.com/6.x/bottts/svg?seed=${request.receiver.username}`} />
                              <AvatarFallback>{request.receiver.username[0]?.toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-sm text-white">{request.receiver.displayName || request.receiver.username}</div>
                              <div className="text-xs text-gray-400">@{request.receiver.username}</div>
                            </div>
                          </div>
                          <span className="text-xs text-yellow-400">Pending</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Add Friend */}
            {activeTab === 'add' && (
              <div className="p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase">Add Friend</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-400 mb-2">
                      You can add friends with their username.
                    </p>
                    <div className="flex space-x-2">
                      <Input
                        placeholder="Enter username"
                        value={addFriendInput}
                        onChange={(e) => setAddFriendInput(e.target.value)}
                        className="bg-[#1e1f22] border-gray-600 text-white"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && addFriendInput.trim()) {
                            sendFriendRequest(addFriendInput.trim());
                          }
                        }}
                      />
                      <Button
                        onClick={() => addFriendInput.trim() && sendFriendRequest(addFriendInput.trim())}
                        disabled={!addFriendInput.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        Send Request
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}