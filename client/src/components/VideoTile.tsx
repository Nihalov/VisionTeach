import { useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Pin } from 'lucide-react';
import type { DrawEvent } from '@/hooks/useHandLandmarks';

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
  /** Callback setter — parent stores a function here so it can push draw events to us */
  remoteDrawRef?: React.MutableRefObject<((evt: DrawEvent) => void) | null>;
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
  remoteDrawRef,
}: VideoTileProps) {

  // Canvas for rendering remote peer's drawings
  const remoteDrawCanvasRef = useRef<HTMLCanvasElement>(null);

  // Process incoming draw events and render them onto the remote draw canvas
  const handleRemoteDrawEvent = useCallback((evt: DrawEvent) => {
    const canvas = remoteDrawCanvasRef.current;
    if (!canvas) return;

    // Ensure canvas dimensions match display size
    const dW = canvas.clientWidth;
    const dH = canvas.clientHeight;
    if (canvas.width !== dW || canvas.height !== dH) {
      // Preserve existing drawing when resizing
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      tmp.getContext('2d')?.drawImage(canvas, 0, 0);
      canvas.width = dW;
      canvas.height = dH;
      canvas.getContext('2d')?.drawImage(tmp, 0, 0, dW, dH);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    switch (evt.t) {
      case 'draw': {
        const pts = evt.pts.map(([nx, ny]) => ({ x: nx * dW, y: ny * dH }));
        if (pts.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);

        if (pts.length === 2) {
          ctx.lineTo(pts[1].x, pts[1].y);
        } else {
          for (let k = 1; k < pts.length - 1; k++) {
            const cpX = (pts[k].x + pts[k + 1].x) / 2;
            const cpY = (pts[k].y + pts[k + 1].y) / 2;
            ctx.quadraticCurveTo(pts[k].x, pts[k].y, cpX, cpY);
          }
          ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        }

        ctx.strokeStyle = evt.c;
        ctx.lineWidth = evt.w;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = evt.w * 2;
        ctx.shadowColor = evt.c;
        ctx.stroke();
        // Inner glow pass
        ctx.shadowBlur = evt.w * 0.8;
        ctx.lineWidth = evt.w * 0.5;
        ctx.globalAlpha = 0.7;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        break;
      }
      case 'erase': {
        const ex = evt.x * dW;
        const ey = evt.y * dH;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(ex, ey, evt.w * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'clear': {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        break;
      }
      case 'up':
        // No-op on remote — just signals stroke end
        break;
    }
  }, []);

  // Register the handler so the parent (Meeting.tsx) can push events to us
  useEffect(() => {
    if (remoteDrawRef) {
      remoteDrawRef.current = handleRemoteDrawEvent;
    }
    return () => {
      if (remoteDrawRef) {
        remoteDrawRef.current = null;
      }
    };
  }, [remoteDrawRef, handleRemoteDrawEvent]);

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
            {/* Remote peer's drawing overlay */}
            {!isLocal && (
              <canvas
                ref={remoteDrawCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ zIndex: 5 }}
              />
            )}
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
