import { useState, useRef, useEffect } from 'react';
import { Pencil, Eraser, Trash2, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DrawingOverlayProps {
  isActive: boolean;
  onToggle: () => void;
}

const colors = [
  { name: 'Cyan', value: '#22d3ee' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'White', value: '#ffffff' },
];

export default function DrawingOverlay({ isActive, onToggle }: DrawingOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState(colors[0].value);
  const [brushSize, setBrushSize] = useState(4);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isActive) return;
    setIsDrawing(true);
    lastPos.current = getPos(e);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !isActive) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const pos = getPos(e);

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 10;
    ctx.shadowColor = currentColor;
    ctx.stroke();

    lastPos.current = pos;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <>
      {/* Drawing Canvas */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 z-10 ${isActive ? 'cursor-crosshair' : 'pointer-events-none'}`}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />

      {/* Drawing Controls */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20">
        <div className="glass-strong rounded-2xl p-2 flex items-center gap-2">
          <Button
            variant={isActive ? 'gradient' : 'glass'}
            size="icon"
            onClick={onToggle}
            className="relative"
          >
            <Pencil className="w-5 h-5" />
            {isActive && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full animate-pulse" />
            )}
          </Button>

          {isActive && (
            <>
              <div className="w-px h-8 bg-border" />

              {/* Color Picker */}
              <div className="relative">
                <Button
                  variant="glass"
                  size="icon"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                >
                  <div
                    className="w-5 h-5 rounded-full ring-2 ring-foreground/20"
                    style={{ backgroundColor: currentColor }}
                  />
                </Button>

                {showColorPicker && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 glass-strong rounded-xl p-2 flex gap-1.5 animate-scale-in">
                    {colors.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => {
                          setCurrentColor(color.value);
                          setShowColorPicker(false);
                        }}
                        className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                          currentColor === color.value ? 'ring-2 ring-foreground scale-110' : ''
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Brush Size */}
              <input
                type="range"
                min="2"
                max="20"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-20 accent-primary"
              />

              <Button variant="glass" size="icon" onClick={clearCanvas}>
                <Trash2 className="w-5 h-5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
