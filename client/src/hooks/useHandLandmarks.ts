import { useRef, useState, useCallback, useEffect } from "react";
import {
  HandLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

// 21-landmark hand connections (MediaPipe hand skeleton)
const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // Index
  [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
  [0, 13], [13, 14], [14, 15], [15, 16],// Ring
  [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
  [5, 9], [9, 13], [13, 17],            // Palm
];

// Fingertip landmark indices (for bigger dots)
const FINGERTIP_IDS = new Set([4, 8, 12, 16, 20]);

// Pinch threshold — normalised distance between thumb tip (4) and index tip (8)
const PINCH_THRESHOLD = 0.06;

export function useHandLandmarks() {
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  // ── Air-drawing state ────────────────────────────────────────────
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const drawingModeRef = useRef(false); // mirror for use inside rAF loop
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevPointRef = useRef<{ x: number; y: number } | null>(null);
  const wasPinchingRef = useRef(false);

  // Keep the ref in sync with the state
  useEffect(() => {
    drawingModeRef.current = isDrawingMode;
  }, [isDrawingMode]);

  // ── Initialise the HandLandmarker model (runs once) ──────────────
  const initModel = useCallback(async () => {
    if (handLandmarkerRef.current) return; // already loaded

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
    });
  }, []);

  // ── Clear drawing canvas ─────────────────────────────────────────
  const clearDrawing = useCallback(() => {
    const dc = drawCanvasRef.current;
    if (!dc) return;
    const ctx = dc.getContext("2d");
    ctx?.clearRect(0, 0, dc.width, dc.height);
  }, []);

  // ── Detection loop ───────────────────────────────────────────────
  const startDetection = useCallback(
    async (
      videoEl: HTMLVideoElement,
      canvasEl: HTMLCanvasElement,
      drawCanvasEl?: HTMLCanvasElement | null
    ) => {
      await initModel();

      const ctx = canvasEl.getContext("2d");
      if (!ctx || !handLandmarkerRef.current) return;

      // Store draw-canvas ref for later
      if (drawCanvasEl) {
        drawCanvasRef.current = drawCanvasEl;
      }

      let lastTimestamp = -1;

      const detect = () => {
        if (!handLandmarkerRef.current) return;

        // Match canvas pixel buffer to its CSS display size so drawings
        // map 1:1 to visible pixels (no stretching mismatch).
        const displayW = canvasEl.clientWidth;
        const displayH = canvasEl.clientHeight;
        if (canvasEl.width !== displayW || canvasEl.height !== displayH) {
          canvasEl.width = displayW;
          canvasEl.height = displayH;
        }

        // Keep the drawing canvas in sync too
        const dc = drawCanvasRef.current;
        if (dc) {
          if (dc.width !== displayW || dc.height !== displayH) {
            // Save existing drawing before resizing (resize clears the canvas)
            const tmpCanvas = document.createElement("canvas");
            tmpCanvas.width = dc.width;
            tmpCanvas.height = dc.height;
            const tmpCtx = tmpCanvas.getContext("2d");
            tmpCtx?.drawImage(dc, 0, 0);

            dc.width = displayW;
            dc.height = displayH;

            // Restore the drawing stretched to new size
            const dcCtx = dc.getContext("2d");
            dcCtx?.drawImage(tmpCanvas, 0, 0, displayW, displayH);
          }
        }

        const now = performance.now();
        if (videoEl.readyState >= 2 && now !== lastTimestamp) {
          lastTimestamp = now;

          const results = handLandmarkerRef.current.detectForVideo(
            videoEl,
            now
          );

          // ── Clear and paint the video frame onto the canvas ──
          ctx.clearRect(0, 0, displayW, displayH);

          // Compute "object-cover"–style source crop so the video
          // fills the canvas without letterboxing.
          const vw = videoEl.videoWidth;
          const vh = videoEl.videoHeight;
          const videoAR = vw / vh;
          const canvasAR = displayW / displayH;

          let sx = 0, sy = 0, sw = vw, sh = vh;
          if (videoAR > canvasAR) {
            // Video is wider → crop sides
            sw = vh * canvasAR;
            sx = (vw - sw) / 2;
          } else {
            // Video is taller → crop top/bottom
            sh = vw / canvasAR;
            sy = (vh - sh) / 2;
          }

          ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, displayW, displayH);

          // ── Composite the persistent drawing layer ────────────
          if (dc) {
            ctx.drawImage(dc, 0, 0);
          }

          // ── Draw landmarks + air-drawing logic ───────────────
          if (results.landmarks) {
            for (const landmarks of results.landmarks) {
              // Convert normalised MediaPipe coords → canvas pixels,
              // accounting for the same crop we applied above.
              const pts = landmarks.map((lm) => {
                const cx = ((lm.x * vw) - sx) / sw * displayW;
                const cy = ((lm.y * vh) - sy) / sh * displayH;
                return { x: cx, y: cy };
              });

              // ── Air Drawing (pinch gesture) ──────────────────
              let isPinching = false;
              if (drawingModeRef.current) {
                const thumbTip = landmarks[4];
                const indexTip = landmarks[8];
                const dx = thumbTip.x - indexTip.x;
                const dy = thumbTip.y - indexTip.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                isPinching = dist < PINCH_THRESHOLD;

                const indexPt = pts[8];

                if (isPinching && dc) {
                  const dcCtx = dc.getContext("2d");
                  if (dcCtx) {
                    if (wasPinchingRef.current && prevPointRef.current) {
                      // Continue the stroke
                      dcCtx.beginPath();
                      dcCtx.moveTo(prevPointRef.current.x, prevPointRef.current.y);
                      dcCtx.lineTo(indexPt.x, indexPt.y);
                      dcCtx.strokeStyle = "#00BFFF";
                      dcCtx.lineWidth = 4;
                      dcCtx.lineCap = "round";
                      dcCtx.lineJoin = "round";
                      dcCtx.shadowBlur = 8;
                      dcCtx.shadowColor = "#00BFFF";
                      dcCtx.stroke();
                      dcCtx.shadowBlur = 0;
                    }
                    // else: first frame of a new pinch, just record position
                  }
                  prevPointRef.current = { x: indexPt.x, y: indexPt.y };
                } else {
                  // Pen up — clear previous point so next pinch starts fresh
                  prevPointRef.current = null;
                }

                wasPinchingRef.current = isPinching;
              }

              // Draw skeleton connectors
              ctx.strokeStyle = "#00FF88";
              ctx.lineWidth = 3;
              ctx.lineCap = "round";
              for (const [a, b] of HAND_CONNECTIONS) {
                ctx.beginPath();
                ctx.moveTo(pts[a].x, pts[a].y);
                ctx.lineTo(pts[b].x, pts[b].y);
                ctx.stroke();
              }

              // Draw landmark dots
              for (let i = 0; i < pts.length; i++) {
                const isIndexTip = i === 8;
                const r = FINGERTIP_IDS.has(i) ? 6 : 4;
                ctx.beginPath();
                ctx.arc(pts[i].x, pts[i].y, r, 0, Math.PI * 2);

                if (isIndexTip && drawingModeRef.current) {
                  // Special styling for index tip in drawing mode
                  ctx.fillStyle = isPinching ? "#00BFFF" : "#FFD700";
                  ctx.fill();
                  ctx.strokeStyle = "#FFFFFF";
                  ctx.lineWidth = 2;
                  ctx.stroke();
                  // Glow ring when pinching
                  if (isPinching) {
                    ctx.beginPath();
                    ctx.arc(pts[i].x, pts[i].y, 12, 0, Math.PI * 2);
                    ctx.strokeStyle = "rgba(0, 191, 255, 0.5)";
                    ctx.lineWidth = 2;
                    ctx.stroke();
                  }
                } else {
                  ctx.fillStyle = FINGERTIP_IDS.has(i) ? "#FF3366" : "#FF6699";
                  ctx.fill();
                  ctx.strokeStyle = "#FFFFFF";
                  ctx.lineWidth = 1.5;
                  ctx.stroke();
                }
              }
            }
          }
        }

        animFrameRef.current = requestAnimationFrame(detect);
      };

      setIsDetecting(true);
      detect();
    },
    [initModel]
  );

  // ── Stop detection ───────────────────────────────────────────────
  const stopDetection = useCallback(
    (canvasEl?: HTMLCanvasElement | null) => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      // Clear the canvas so no stale landmarks remain
      if (canvasEl) {
        const ctx = canvasEl.getContext("2d");
        ctx?.clearRect(0, 0, canvasEl.width, canvasEl.height);
      }

      // Clear drawing state
      prevPointRef.current = null;
      wasPinchingRef.current = false;
      setIsDrawingMode(false);
      clearDrawing();

      setIsDetecting(false);
    },
    [clearDrawing]
  );

  // ── Cleanup on unmount ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
      handLandmarkerRef.current?.close();
      handLandmarkerRef.current = null;
    };
  }, []);

  return {
    isDetecting,
    startDetection,
    stopDetection,
    isDrawingMode,
    setIsDrawingMode,
    clearDrawing,
  };
}
