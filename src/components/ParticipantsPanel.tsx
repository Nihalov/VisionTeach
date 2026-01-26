import { X, Mic, MicOff, Video, VideoOff, MoreHorizontal, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isHost: boolean;
}

interface ParticipantsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const mockParticipants: Participant[] = [
  { id: '1', name: 'You', isMuted: false, isVideoOff: false, isHost: true },
  { id: '2', name: 'Sarah Chen', isMuted: true, isVideoOff: false, isHost: false },
  { id: '3', name: 'Mike Johnson', isMuted: false, isVideoOff: true, isHost: false },
  { id: '4', name: 'Emma Wilson', isMuted: true, isVideoOff: true, isHost: false },
];

export default function ParticipantsPanel({ isOpen, onClose }: ParticipantsPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="w-80 h-full glass-strong flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h3 className="font-semibold text-foreground">Participants</h3>
          <p className="text-sm text-muted-foreground">{mockParticipants.length} in meeting</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto p-2">
        {mockParticipants.map((participant) => (
          <div
            key={participant.id}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
          >
            {/* Avatar */}
            <div className="relative">
              {participant.avatar ? (
                <img
                  src={participant.avatar}
                  alt={participant.name}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
                  {participant.name.charAt(0)}
                </div>
              )}
              {participant.isHost && (
                <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-accent">
                  <Crown className="w-3 h-3 text-accent-foreground" />
                </div>
              )}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {participant.name}
                {participant.isHost && (
                  <span className="text-xs text-muted-foreground ml-2">(Host)</span>
                )}
              </p>
            </div>

            {/* Status Icons */}
            <div className="flex items-center gap-1">
              {participant.isMuted ? (
                <span className="p-1.5 rounded-lg bg-destructive/20">
                  <MicOff className="w-4 h-4 text-destructive" />
                </span>
              ) : (
                <span className="p-1.5 rounded-lg bg-muted">
                  <Mic className="w-4 h-4 text-foreground" />
                </span>
              )}
              {participant.isVideoOff ? (
                <span className="p-1.5 rounded-lg bg-destructive/20">
                  <VideoOff className="w-4 h-4 text-destructive" />
                </span>
              ) : (
                <span className="p-1.5 rounded-lg bg-muted">
                  <Video className="w-4 h-4 text-foreground" />
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <Button variant="glass" className="w-full">
          Invite Participants
        </Button>
      </div>
    </div>
  );
}
