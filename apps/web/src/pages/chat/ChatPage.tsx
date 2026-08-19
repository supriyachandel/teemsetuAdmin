import { useEffect, useState, useRef } from 'react';
import { Send, Users, Hash, User as UserIcon, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { 
  setRooms, 
  setActiveRoom, 
  setMessages, 
  addMessage, 
  updateMessage, 
  deleteMessage,
  setTyping 
} from '@/store/slices/chatSlice';
import { api, getApiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { getSocket } from '@/hooks/useSocket';

export function ChatPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { rooms, activeRoomId, messagesByRoom, typingUsersByRoom } = useAppSelector((s) => s.chat);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // New Chat State
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Reactive Socket & Sending state
  const [socket, setSocket] = useState(getSocket());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    // Keep checking getSocket() until it's initialized by the global socket provider
    const interval = setInterval(() => {
      const s = getSocket();
      if (s) {
        setSocket(s);
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Load Rooms
  useEffect(() => {
    api.get('/chat/rooms')
      .then((res) => {
        dispatch(setRooms(res.data.data ?? []));
        if (res.data.data?.length > 0 && !activeRoomId) {
          dispatch(setActiveRoom(res.data.data[0].id));
        }
      })
      .catch((e) => toast.error(getApiErrorMessage(e)))
      .finally(() => setLoadingRooms(false));
  }, [dispatch, activeRoomId]);

  // Handle Socket Events
  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (msg: any) => {
      dispatch(addMessage({ roomId: msg.roomId, message: msg }));
    };
    const onUpdateMessage = (msg: any) => {
      dispatch(updateMessage({ roomId: msg.roomId, message: msg }));
    };
    const onDeleteMessage = (data: any) => {
      dispatch(deleteMessage({ roomId: data.roomId, messageId: data.messageId }));
    };
    const onTyping = (data: any) => {
      dispatch(setTyping(data));
    };

    socket.on('message:new', onNewMessage);
    socket.on('message:updated', onUpdateMessage);
    socket.on('message:deleted', onDeleteMessage);
    socket.on('chat:typing', onTyping);

    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('message:updated', onUpdateMessage);
      socket.off('message:deleted', onDeleteMessage);
      socket.off('chat:typing', onTyping);
    };
  }, [socket, dispatch]);

  // Load Messages for Active Room
  useEffect(() => {
    if (!activeRoomId) return;

    // Join room channel
    const socketInstance = getSocket();
    socketInstance?.emit('chat:join', activeRoomId);

    // Fetch message history
    if (!messagesByRoom[activeRoomId]) {
      api.get(`/chat/rooms/${activeRoomId}/messages`)
        .then((res) => {
          dispatch(setMessages({ roomId: activeRoomId, messages: res.data.data ?? [] }));
        })
        .catch((e) => toast.error(getApiErrorMessage(e)));
    }

    return () => {
      socketInstance?.emit('chat:leave', activeRoomId);
    };
  }, [activeRoomId, dispatch, messagesByRoom]);

  // Mark Active Room as Read
  useEffect(() => {
    if (!activeRoomId) return;
    api.post(`/chat/rooms/${activeRoomId}/read`).catch(() => {});
  }, [activeRoomId, activeRoomId ? messagesByRoom[activeRoomId]?.length : 0]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesByRoom, activeRoomId]);

  const openNewChatDialog = async () => {
    setIsNewChatOpen(true);
    setLoadingEmployees(true);
    setSearchTerm('');
    try {
      const res = await api.get('/employees', { params: { limit: 100 } });
      // Filter out the logged-in user themselves
      const list = (res.data.data ?? []).filter((emp: any) => emp.user?.id !== user?.id);
      setEmployeesList(list);
    } catch (e) {
      toast.error('Failed to load employees list');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleStartChat = async (otherUserId: string) => {
    try {
      const res = await api.post(`/chat/direct/${otherUserId}`);
      const newRoom = res.data.data;
      
      // Update room list if not already present
      const exists = rooms.some((r) => r.id === newRoom.id);
      if (!exists) {
        dispatch(setRooms([newRoom, ...rooms]));
      }
      
      dispatch(setActiveRoom(newRoom.id));
      setIsNewChatOpen(false);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeRoomId || sending) return;

    setSending(true);
    const text = messageText;
    setMessageText(''); // Optimistic clear
    
    // Stop typing indicator
    const socketInstance = getSocket();
    socketInstance?.emit('chat:typing', { roomId: activeRoomId, isTyping: false });

    try {
      const response = await api.post(`/chat/rooms/${activeRoomId}/messages`, { content: text });
      // Immediately add the saved database message to the local Redux state
      dispatch(addMessage({ roomId: activeRoomId, message: response.data.data }));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
      setMessageText(text); // Restore on error
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);
    const socketInstance = getSocket();
    if (socketInstance && activeRoomId) {
      socketInstance.emit('chat:typing', { roomId: activeRoomId, isTyping: e.target.value.length > 0 });
    }
  };

  const activeRoom = rooms.find((r) => r.id === activeRoomId);
  const messages = activeRoomId ? (messagesByRoom[activeRoomId] || []) : [];
  const typingUsers = activeRoomId ? (typingUsersByRoom[activeRoomId] || []) : [];

  const getRoomName = (room: any) => {
    if (!room.isDirect) return room.name || 'Group Chat';
    const otherMember = room.members?.find((m: any) => m.user?.id !== user?.id)?.user;
    return otherMember ? `${otherMember.firstName} ${otherMember.lastName}` : 'User';
  };

  const filteredEmployees = employeesList.filter((emp) => {
    const fullName = `${emp.user?.firstName || ''} ${emp.user?.lastName || ''}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) || (emp.user?.email || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background border-t -m-4 sm:-m-6 lg:-m-8">
      {/* Sidebar - Rooms List */}
      <div className="w-80 border-r flex flex-col bg-muted/10">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Users className="h-5 w-5" /> Chats
          </h2>
          <Button size="sm" variant="outline" onClick={openNewChatDialog} className="gap-1">
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingRooms ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Loading...</div>
          ) : rooms.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">No chats available</div>
          ) : (
            rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => dispatch(setActiveRoom(room.id))}
                className={`w-full text-left p-4 flex items-center gap-3 hover:bg-muted transition-colors border-b last:border-b-0 ${
                  activeRoomId === room.id ? 'bg-muted border-l-4 border-l-primary' : ''
                }`}
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className={room.isDirect ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}>
                    {room.isDirect ? <UserIcon className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{getRoomName(room)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {room.messages?.[0]?.content || 'No messages yet'}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeRoom ? (
          <>
            <div className="p-4 border-b bg-card flex flex-col">
              <h2 className="font-semibold text-lg">{getRoomName(activeRoom)}</h2>
              <span className="text-xs text-muted-foreground">
                {activeRoom.isDirect ? 'Direct Message' : 'Project Channel'}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => {
                const isMe = msg.sender.id === user?.id;
                const showAvatar = !isMe && (idx === 0 || messages[idx - 1].sender.id !== msg.sender.id);
                
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex gap-2 max-w-[70%] ${isMe ? 'flex-row-reverse' : ''}`}>
                      {!isMe && (
                        <div className="w-8 flex-shrink-0">
                          {showAvatar && (
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">{msg.sender.firstName[0]}{msg.sender.lastName[0]}</AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      )}
                      
                      <div className="flex flex-col">
                        {!isMe && showAvatar && (
                          <span className="text-xs text-muted-foreground mb-1">{msg.sender.firstName} {msg.sender.lastName}</span>
                        )}
                        <div className={`p-3 rounded-lg text-sm ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted rounded-tl-none'}`}>
                          {msg.content}
                        </div>
                        <span className={`text-[10px] text-muted-foreground mt-1 ${isMe ? 'text-right' : 'text-left'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {typingUsers.length > 0 && (
                <div className="flex items-center text-xs text-muted-foreground gap-2 pl-10">
                  <div className="flex gap-1">
                    <span className="animate-bounce">.</span>
                    <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>.</span>
                  </div>
                  Someone is typing...
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-card border-t">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <Input
                  placeholder="Type your message..."
                  className="flex-1"
                  value={messageText}
                  onChange={handleTyping}
                />
                <Button type="submit" size="icon" disabled={!messageText.trim() || sending}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a chat to start messaging
          </div>
        )}
      </div>

      {/* New Chat Dialog */}
      <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Start a New Chat</DialogTitle>
          </DialogHeader>
          <div className="relative my-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
            {loadingEmployees ? (
              <div className="text-center p-4 text-sm text-muted-foreground">Loading employees...</div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center p-4 text-sm text-muted-foreground">No employees found</div>
            ) : (
              filteredEmployees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => handleStartChat(emp.user?.id)}
                  className="w-full text-left p-3 hover:bg-muted transition-colors rounded-lg flex items-center gap-3 border"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {emp.user?.firstName?.[0] || ''}{emp.user?.lastName?.[0] || ''}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {emp.user?.firstName} {emp.user?.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{emp.user?.email}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
