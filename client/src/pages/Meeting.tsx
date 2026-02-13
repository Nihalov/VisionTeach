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
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const previousVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const hadVideoBeforeShareRef = useRef(false);

  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const meetingId = 'abc-defg-hij';

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (hasLocalVideo && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [hasLocalVideo]);

  const startVideo = useCallback(async () => {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const videoTrack = videoStream.getVideoTracks()[0];
      if (!videoTrack) return;

      if (!localStreamRef.current) {
        localStreamRef.current = new MediaStream();
      }

      const existingVideoTrack = localStreamRef.current.getVideoTracks()[0];
      if (existingVideoTrack) {
        localStreamRef.current.removeTrack(existingVideoTrack);
        existingVideoTrack.stop();
      }

      localStreamRef.current.addTrack(videoTrack);
      setHasLocalVideo(true);
      setIsVideoOff(false);
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  }, []);

  const stopVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        localStreamRef.current?.removeTrack(track);
        track.stop();
      });
      if (localStreamRef.current.getTracks().length === 0) {
        localStreamRef.current = null;
      }
    }
    setHasLocalVideo(false);
    setIsVideoOff(true);
  }, []);

  const stopScreenShare = useCallback((restorePreviousVideo = true) => {
    if (!localStreamRef.current) {
      setIsScreenSharing(false);
      return;
    }

    const screenTrack = screenTrackRef.current;
    if (screenTrack) {
      localStreamRef.current.removeTrack(screenTrack);
      screenTrack.stop();
      screenTrackRef.current = null;
    }

    if (
      restorePreviousVideo &&
      hadVideoBeforeShareRef.current &&
      previousVideoTrackRef.current &&
      previousVideoTrackRef.current.readyState === 'live'
    ) {
      localStreamRef.current.addTrack(previousVideoTrackRef.current);
      setHasLocalVideo(true);
      setIsVideoOff(false);
    } else {
      setHasLocalVideo(false);
      setIsVideoOff(true);
      if (localStreamRef.current.getTracks().length === 0) {
        localStreamRef.current = null;
      }
    }

    previousVideoTrackRef.current = null;
    hadVideoBeforeShareRef.current = false;
    setIsScreenSharing(false);
  }, []);

  const handleToggleVideo = () => {
    if (isVideoOff) {
      startVideo();
    } else {
      if (isScreenSharing) {
        stopScreenShare(false);
      }
      stopVideo();
    }
  };

  const handleToggleMute = () => {
    if (isMuted) {
      void (async () => {
        try {
          if (!localStreamRef.current) {
            localStreamRef.current = new MediaStream();
          }

          let audioTrack = localStreamRef.current.getAudioTracks()[0];
          if (!audioTrack) {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            audioTrack = audioStream.getAudioTracks()[0];
            if (audioTrack) {
              localStreamRef.current.addTrack(audioTrack);
            }
          }

          if (audioTrack) {
            audioTrack.enabled = true;
            setIsMuted(false);
          }
        } catch (error) {
          console.error('Error accessing microphone:', error);
        }
      })();
      return;
    }

    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = false;
      }
    }
    setIsMuted(true);
  };

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare(true);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const screenTrack = screenStream.getVideoTracks()[0];
        if (!screenTrack) return;

        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream();
        }

        hadVideoBeforeShareRef.current = hasLocalVideo && !isVideoOff;
        previousVideoTrackRef.current = localStreamRef.current.getVideoTracks()[0] ?? null;

        if (previousVideoTrackRef.current) {
          localStreamRef.current.removeTrack(previousVideoTrackRef.current);
        }

        localStreamRef.current.addTrack(screenTrack);
        screenTrackRef.current = screenTrack;
        screenTrack.onended = () => stopScreenShare(true);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        setHasLocalVideo(true);
        setIsScreenSharing(true);
      } catch (error) {
        console.error('Error sharing screen:', error);
      }
    }
  };

  const handleLeave = () => {
    if (isScreenSharing) {
      stopScreenShare(false);
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setHasLocalVideo(false);
    setIsVideoOff(true);
    setIsMuted(true);
    navigate('/home');
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
              mirror={!isScreenSharing}
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
