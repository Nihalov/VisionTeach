import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VideoTile from '@/components/VideoTile';
import ChatPanel from '@/components/ChatPanel';
import ParticipantsPanel from '@/components/ParticipantsPanel';
import ControlBar from '@/components/ControlBar';
// import DrawingOverlay from '@/components/DrawingOverlay';
import { useAuth } from '@/hooks/useAuth';
import { Shield, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const mockParticipants = [
  { id: '2', name: 'Sarah Chen', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah' },
  { id: '3', name: 'Mike Johnson', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike' },
  { id: '4', name: 'Emma Wilson', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma' },
];

export default function Meeting() {
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  // const [isDrawingActive, setIsDrawingActive] = useState(false);
  const [hasLocalVideo, setHasLocalVideo] = useState(false);
  const [copied, setCopied] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const meetingId = 'abc-defg-hij';

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const startVideo = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setHasLocalVideo(true);
      setIsVideoOff(false);
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  }, []);

  const stopVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setHasLocalVideo(false);
    setIsVideoOff(true);
  }, []);

  const handleToggleVideo = () => {
    if (isVideoOff) {
      startVideo();
    } else {
      stopVideo();
    }
  };

  const handleToggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
      }
    }
    setIsMuted(!isMuted);
  };

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      setIsScreenSharing(false);
    } else {
      try {
        await navigator.mediaDevices.getDisplayMedia({ video: true });
        setIsScreenSharing(true);
      } catch (error) {
        console.error('Error sharing screen:', error);
      }
    }
  };

  const handleLeave = () => {
    stopVideo();
    navigate('/');
  };

  const handleCopyMeetingId = () => {
    navigator.clipboard.writeText(meetingId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getGridClass = () => {
    const total = mockParticipants.length + 1; // +1 for local user
    if (total <= 2) return 'grid-cols-1 md:grid-cols-2';
    if (total <= 4) return 'grid-cols-2';
    if (total <= 6) return 'grid-cols-2 md:grid-cols-3';
    return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 glass-strong border-b border-border z-40">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-display font-bold gradient-text">GestureLearn</h1>
          <div className="hidden sm:flex items-center gap-2 ml-4">
            <Shield className="w-4 h-4 text-accent" />
            <span className="text-sm text-muted-foreground">Meeting ID:</span>
            <code className="text-sm text-foreground font-mono">{meetingId}</code>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleCopyMeetingId}
            >
              {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
            {user?.name?.charAt(0) || 'U'}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 relative p-4 overflow-y-auto">
          <div className={`grid ${getGridClass()} gap-4 auto-rows-fr isolate`}>
            {/* Local User */}
            <VideoTile
              name={user?.name || 'You'}
              avatar={user?.avatar}
              isMuted={isMuted}
              isLocal
              videoRef={localVideoRef}
              hasVideo={hasLocalVideo}
              isPinned
            />

            {/* Remote Participants */}
            {mockParticipants.map((participant) => (
              <VideoTile
                key={participant.id}
                name={participant.name}
                avatar={participant.avatar}
                isMuted={Math.random() > 0.5}
              />
            ))}
          </div>

          {/* Drawing Overlay */}
          {/* <DrawingOverlay isActive={isDrawingActive} onToggle={() => setIsDrawingActive(!isDrawingActive)} /> */}

          {/* Control Bar */}
          <ControlBar
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            isScreenSharing={isScreenSharing}
            isChatOpen={isChatOpen}
            isParticipantsOpen={isParticipantsOpen}
            // isDrawingActive={isDrawingActive}
            onToggleMute={handleToggleMute}
            onToggleVideo={handleToggleVideo}
            onToggleScreenShare={handleToggleScreenShare}
            onToggleChat={() => {
              setIsChatOpen(!isChatOpen);
              if (!isChatOpen) setIsParticipantsOpen(false);
            }}
            onToggleParticipants={() => {
              setIsParticipantsOpen(!isParticipantsOpen);
              if (!isParticipantsOpen) setIsChatOpen(false);
            }}
            // onToggleDrawing={() => setIsDrawingActive(!isDrawingActive)}
            onLeave={handleLeave}
          />
        </div>

        {/* Side Panels */}
        <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
        <ParticipantsPanel isOpen={isParticipantsOpen} onClose={() => setIsParticipantsOpen(false)} />
      </div>
    </div>
  );
}
