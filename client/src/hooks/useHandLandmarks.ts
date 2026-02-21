import { useRef, useState, useCallback, useEffect } from "react";
import {
  HandLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

// 21-landmark hand connections (MediaPipe hand skeleton)
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // Index
  [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
  [0, 13], [13, 14], [14, 15], [15, 16],// Ring
  [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
  [5, 9], [9, 13], [13, 17],            // Palm
];

export function useHandLandmarks() {
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

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

  // ── Detection loop ───────────────────────────────────────────────
  const startDetection = useCallback(
    async (
      videoEl: HTMLVideoElement,
      canvasEl: HTMLCanvasElement
    ) => {
      await initModel();

      const ctx = canvasEl.getContext("2d");
      if (!ctx || !handLandmarkerRef.current) return;

      const drawingUtils = new DrawingUtils(ctx);
      let lastTimestamp = -1;

      const detect = () => {
        if (!handLandmarkerRef.current) return;

        // Keep canvas size in sync with video
        if (
          canvasEl.width !== videoEl.videoWidth ||
          canvasEl.height !== videoEl.videoHeight
        ) {
          canvasEl.width = videoEl.videoWidth;
          canvasEl.height = videoEl.videoHeight;
        }

        const now = performance.now();
        if (videoEl.readyState >= 2 && now !== lastTimestamp) {
          lastTimestamp = now;

          const results = handLandmarkerRef.current.detectForVideo(
            videoEl,
            now
          );

          // Clear previous drawings
          ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

          if (results.landmarks) {
            for (const landmarks of results.landmarks) {
              // Draw connectors (skeleton lines)
              drawingUtils.drawConnectors(
                landmarks,
                HAND_CONNECTIONS as any,
                { color: "#00FF88", lineWidth: 3 }
              );

              // Draw landmark dots
              drawingUtils.drawLandmarks(landmarks, {
                color: "#FF3366",
                lineWidth: 1,
                radius: 4,
              });
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

      setIsDetecting(false);
    },
    []
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

  return { isDetecting, startDetection, stopDetection };
}
