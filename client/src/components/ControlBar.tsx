import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  MessageSquare,
  Users,
  Phone,
  MoreHorizontal,
  Hand,
  // Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ControlBarProps {
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
  isGestureActive?: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onToggleGesture?: () => void;
  onLeave: () => void;
}

export default function ControlBar({
  isMuted,
  isVideoOff,
  isScreenSharing,
  isChatOpen,
  isParticipantsOpen,
  isGestureActive = false,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleChat,
  onToggleParticipants,
  onToggleGesture,
  onLeave,
}: ControlBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30">
      <div className="flex items-center justify-center gap-3 p-4">
        <div className="glass-strong rounded-2xl p-3 flex items-center gap-3">
          {/* Mic */}
          <Button
            variant={isMuted ? 'controlActive' : 'control'}
            size="iconLg"
            onClick={onToggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>

          {/* Video */}
          <Button
            variant={isVideoOff ? 'controlActive' : 'control'}
            size="iconLg"
            onClick={onToggleVideo}
            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </Button>

          {/* Screen Share */}
          <Button
            variant={isScreenSharing ? 'gradient' : 'control'}
            size="iconLg"
            onClick={onToggleScreenShare}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            <ScreenShare className="w-5 h-5" />
          </Button>

          <div className="w-px h-8 bg-border" />

          {/* Drawing */}
          {/* <Button
            variant={isDrawingActive ? 'gradient' : 'control'}
            size="iconLg"
            onClick={onToggleDrawing}
            title="Air Drawing"
          >
            <Pencil className="w-5 h-5" />
          </Button> */}

          {/* Hand Tracking */}
          <Button
            variant={isGestureActive ? 'gradient' : 'control'}
            size="iconLg"
            onClick={onToggleGesture}
            title={isGestureActive ? 'Stop hand tracking' : 'Start hand tracking'}
          >
            <Hand className="w-5 h-5" />
          </Button>

          <div className="w-px h-8 bg-border" />

          {/* Participants */}
          <Button
            variant={isParticipantsOpen ? 'gradient' : 'control'}
            size="iconLg"
            onClick={onToggleParticipants}
            title="Participants"
          >
            <Users className="w-5 h-5" />
          </Button>

          {/* Chat */}
          <Button
            variant={isChatOpen ? 'gradient' : 'control'}
            size="iconLg"
            onClick={onToggleChat}
            title="Chat"
          >
            <MessageSquare className="w-5 h-5" />
          </Button>

          {/* More */}
          <Button variant="control" size="iconLg" title="More options">
            <MoreHorizontal className="w-5 h-5" />
          </Button>

          <div className="w-px h-8 bg-border" />

          {/* Leave */}
          <Button
            variant="destructive"
            size="iconLg"
            onClick={onLeave}
            className="rounded-full"
            title="Leave meeting"
          >
            <Phone className="w-5 h-5 rotate-[135deg]" />
          </Button>
        </div>
      </div>
    </div>
  );
}
