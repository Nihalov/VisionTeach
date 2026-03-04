import { useState, useRef, useEffect } from 'react';
import { X, Send, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { socket } from '../services/socket';

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;   // ISO string so it serialises over the wire
  isOwn: boolean;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string | null;
  userName: string;
  onNewMessage?: () => void;   // called when a remote message arrives
}

export default function ChatPanel({ isOpen, onClose, roomId, userName, onNewMessage }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for incoming messages
  useEffect(() => {
    const handleReceive = (msg: Omit<Message, 'isOwn'>) => {
      setMessages(prev => [...prev, { ...msg, isOwn: false }]);
      onNewMessage?.();
    };

    socket.on('receive-message', handleReceive);
    return () => { socket.off('receive-message', handleReceive); };
  }, [onNewMessage]);

  const handleSend = () => {
    if (!newMessage.trim() || !roomId) return;

    const msg = {
      id: Date.now().toString(),
      sender: userName,
      content: newMessage,
      timestamp: new Date().toISOString(),
    };

    // Show locally
    setMessages(prev => [...prev, { ...msg, isOwn: true }]);

    // Broadcast to room
    socket.emit('send-message', { roomId, message: msg });

    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 right-0 z-40 w-80 h-full glass-strong flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Chat</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center mt-8">
            No messages yet — say hello! 👋
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex flex-col ${message.isOwn ? 'items-end' : 'items-start'}`}
          >
            {!message.isOwn && (
              <span className="text-xs text-muted-foreground mb-1">{message.sender}</span>
            )}
            <div
              className={`max-w-[85%] px-4 py-2.5 rounded-2xl ${message.isOwn
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-muted text-foreground rounded-bl-sm'
                }`}
            >
              <p className="text-sm">{message.content}</p>
            </div>
            <span className="text-xs text-muted-foreground mt-1">
              {formatTime(message.timestamp)}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2">
          {/* <Button variant="ghost" size="icon" className="shrink-0">
            <Smile className="w-5 h-5 text-muted-foreground" />
          </Button> */}
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          <Button
            variant="gradient"
            size="icon"
            onClick={handleSend}
            disabled={!newMessage.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
