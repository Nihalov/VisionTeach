import { Mic, MicOff, Pin } from 'lucide-react';

interface VideoTileProps {
  name: string;
  avatar?: string;
  isMuted?: boolean;
  isPinned?: boolean;
  isLocal?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement>;
  hasVideo?: boolean;
}

export default function VideoTile({
  name,
  avatar,
  isMuted = false,
  isPinned = false,
  isLocal = false,
  videoRef,
  hasVideo = false,
}: VideoTileProps) {
  return (
    <div
      className={`video-tile group relative ${
        isPinned ? 'ring-2 ring-primary glow-effect' : ''
      }`}
    >
      {/* Video or Avatar */}
      {hasVideo && videoRef ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              className="w-20 h-20 rounded-full ring-4 ring-border"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-semibold text-primary">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Name Tag */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2">
        <span className="px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm text-sm font-medium text-foreground">
          {isLocal ? 'You' : name}
        </span>
        {isMuted && (
          <span className="p-1.5 rounded-lg bg-destructive/80 backdrop-blur-sm">
            <MicOff className="w-3.5 h-3.5 text-destructive-foreground" />
          </span>
        )}
      </div>

      {/* Pin Indicator */}
      {isPinned && (
        <div className="absolute top-3 right-3 p-2 rounded-lg bg-primary/80 backdrop-blur-sm">
          <Pin className="w-4 h-4 text-primary-foreground" />
        </div>
      )}

      {/* Speaking Indicator */}
      <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm">
          <Mic className="w-3 h-3 text-accent" />
          <div className="flex gap-0.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-0.5 h-3 bg-accent rounded-full animate-pulse"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
