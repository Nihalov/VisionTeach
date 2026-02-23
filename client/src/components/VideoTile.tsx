import { Mic, MicOff, Pin } from 'lucide-react';

interface VideoTileProps {
  name: string;
  avatar?: string;
  isMuted?: boolean;
  isPinned?: boolean;
  isLocal?: boolean;
  mirror?: boolean;
  videoRef?: React.Ref<HTMLVideoElement>;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  drawCanvasRef?: React.RefObject<HTMLCanvasElement>;
  hasVideo?: boolean;
  onPin?: () => void;
}

export default function VideoTile({
  name,
  avatar,
  isMuted = false,
  isPinned = false,
  isLocal = false,
  mirror = isLocal,
  videoRef,
  canvasRef,
  drawCanvasRef,
  hasVideo = false,
  onPin,
}: VideoTileProps) {
  return (
    <div
      className={`video-tile group relative overflow-hidden bg-background ${isPinned ? 'ring-2 ring-primary glow-effect' : ''
        }`}
    >
      {/* MEDIA LAYER */}
      <div className={`absolute inset-0 w-full h-full ${mirror ? 'scale-x-[-1]' : ''}`}>
        {hasVideo && videoRef ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isLocal}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <canvas
              ref={drawCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ display: 'none' }}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
            />
          </>
        ) : (
          <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/50 ${isLocal ? 'scale-x-[-1]' : ''}`}>
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
      </div>

      {/* UI OVERLAY */}

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      {/* Name Tag */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 pointer-events-none">
        <span className="px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm text-sm font-medium text-white shadow-sm">
          {isLocal ? 'You' : name}
        </span>
        {isMuted && (
          <span className="p-1.5 rounded-lg bg-destructive/80 backdrop-blur-sm shadow-sm">
            <MicOff className="w-3.5 h-3.5 text-white" />
          </span>
        )}
      </div>

      {/* Pin Button — visible on hover, always visible if pinned */}
      {onPin && (
        <button
          onClick={onPin}
          title={isPinned ? 'Unpin' : 'Pin'}
          className={`absolute top-3 right-3 p-2 rounded-lg backdrop-blur-sm shadow-sm
            transition-all duration-200 cursor-pointer z-10
            ${isPinned
              ? 'bg-primary/80 opacity-100'
              : 'bg-black/50 opacity-0 group-hover:opacity-100 hover:bg-primary/60'
            }`}
        >
          <Pin className={`w-4 h-4 text-white transition-transform ${isPinned ? 'rotate-45' : ''}`} />
        </button>
      )}

      {/* Speaking Indicator */}
      <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
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
