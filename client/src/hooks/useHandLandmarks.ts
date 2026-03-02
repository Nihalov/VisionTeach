import { useRef, useState, useCallback, useEffect, MutableRefObject } from "react";
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

const FINGERTIP_IDS = new Set([4, 8, 12, 16, 20]);

// ── Gesture thresholds ─────────────────────────────────────────────
const PINCH_THRESHOLD = 0.07;       // slightly generous to avoid micro-breaks
const TWO_FINGER_THRESHOLD = 0.05;
const SMOOTHING_FACTOR = 0.35;      // 0 = max smooth (laggy), 1 = raw (jittery)
const PINCH_GRACE_FRAMES = 4;       // keep pen down for N frames after brief drop

// ── Drawing palette data ───────────────────────────────────────────
export const DRAWING_COLORS = [
  { name: "Cyan", value: "#00BFFF" },
  { name: "Red", value: "#FF3B5C" },
  { name: "Lime", value: "#39FF14" },
  { name: "Yellow", value: "#FFD700" },
] as const;

export const LINE_WIDTHS = [
  { name: "Thin", value: 1 },
  { name: "Medium", value: 3 },
  { name: "Thick", value: 5 },
] as const;

export type DrawingColor = typeof DRAWING_COLORS[number]["value"];

// ── Toolbar layout constants ───────────────────────────────────────
const BTN_SIZE = 36;      // main & row circle radius-ish
const ROW_H = 44;      // height per row in the expanded list
const MARGIN = 16;      // from canvas edge
const SUB_RADIUS = 16;      // sub-item circle radius
const SUB_GAP = 10;      // gap between sub-items

// Menu states
type MenuState = "collapsed" | "expanded" | "colors" | "widths";

// ── Drawing event types (sent over DataChannel) ───────────────────
export type DrawEvent =
  | { t: "draw"; pts: [number, number][]; c: string; w: number }
  | { t: "up" }
  | { t: "erase"; x: number; y: number; w: number }
  | { t: "clear" };

export type OnDrawEventFn = (event: DrawEvent) => void;

// ────────────────────────────────────────────────────────────────────
export function useHandLandmarks() {
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  // ── Air-drawing state ────────────────────────────────────────────
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const drawingModeRef = useRef(false);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const smoothPointRef = useRef<{ x: number; y: number } | null>(null);  // EMA-smoothed position
  const pointBufRef = useRef<{ x: number; y: number }[]>([]);            // ring buffer for spline
  const wasPinchingRef = useRef(false);
  const pinchGraceRef = useRef(0);   // frames since last valid pinch
  const drawColorRef = useRef<string>(DRAWING_COLORS[0].value);
  const drawWidthRef = useRef<number>(LINE_WIDTHS[1].value);
  const isEraserRef = useRef(false);
  const [activeToolName, setActiveToolName] = useState<string>(DRAWING_COLORS[0].name);

  // ── Draw event callback (wired by Meeting.tsx to send over DataChannel) ──
  const onDrawEventRef = useRef<OnDrawEventFn | null>(null);

  // ── Toolbar menu state (ref for rAF loop) ────────────────────────
  const menuStateRef = useRef<MenuState>("collapsed");
  const menuHoverTimerRef = useRef<number>(0);  // frames staying on main btn

  useEffect(() => {
    drawingModeRef.current = isDrawingMode;
    if (!isDrawingMode) menuStateRef.current = "collapsed";
  }, [isDrawingMode]);

  // ── Initialise the HandLandmarker model ──────────────────────────
  const initModel = useCallback(async () => {
    if (handLandmarkerRef.current) return;
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
    // Emit clear event to remote peer
    onDrawEventRef.current?.({ t: "clear" });
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  //  TOOLBAR GEOMETRY  — all coordinates in canvas-buffer space.
  //  The canvas is mirrored (scaleX -1), so we draw on the LEFT to
  //  appear on the RIGHT in the user's view.
  // ═══════════════════════════════════════════════════════════════════

  /** Compute hit-test regions for the current menu state. */
  const getToolbarLayout = useCallback((_dW: number) => {
    const mainBtn = {
      x: MARGIN + BTN_SIZE / 2,
      y: MARGIN + BTN_SIZE / 2,
      r: BTN_SIZE / 2,
    };

    // The 3 rows that appear when expanded
    const rowStartY = mainBtn.y + BTN_SIZE / 2 + 10;
    const rows = ["colors", "widths", "eraser"].map((id, i) => ({
      id,
      x: MARGIN,
      y: rowStartY + i * ROW_H,
      w: 130,
      h: ROW_H - 4,
    }));

    // Sub-items expand to the RIGHT of the rows
    const colorSubs = DRAWING_COLORS.map((c, i) => ({
      ...c,
      cx: MARGIN + 130 + 14 + SUB_RADIUS + i * (SUB_RADIUS * 2 + SUB_GAP),
      cy: rows[0].y + rows[0].h / 2,
      r: SUB_RADIUS,
    }));

    const widthSubs = LINE_WIDTHS.map((w, i) => ({
      ...w,
      cx: MARGIN + 130 + 14 + SUB_RADIUS + i * (SUB_RADIUS * 2 + SUB_GAP),
      cy: rows[1].y + rows[1].h / 2,
      r: SUB_RADIUS,
    }));

    return { mainBtn, rows, colorSubs, widthSubs };
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  //  DETECTION LOOP
  // ═══════════════════════════════════════════════════════════════════

  const startDetection = useCallback(
    async (
      videoEl: HTMLVideoElement,
      canvasEl: HTMLCanvasElement,
      drawCanvasEl?: HTMLCanvasElement | null
    ) => {
      await initModel();
      const ctx = canvasEl.getContext("2d");
      if (!ctx || !handLandmarkerRef.current) return;
      if (drawCanvasEl) drawCanvasRef.current = drawCanvasEl;

      let lastTimestamp = -1;

      const detect = () => {
        if (!handLandmarkerRef.current) return;

        const displayW = canvasEl.clientWidth;
        const displayH = canvasEl.clientHeight;
        if (canvasEl.width !== displayW || canvasEl.height !== displayH) {
          canvasEl.width = displayW;
          canvasEl.height = displayH;
        }

        const dc = drawCanvasRef.current;
        if (dc && (dc.width !== displayW || dc.height !== displayH)) {
          const tmp = document.createElement("canvas");
          tmp.width = dc.width; tmp.height = dc.height;
          tmp.getContext("2d")?.drawImage(dc, 0, 0);
          dc.width = displayW; dc.height = displayH;
          dc.getContext("2d")?.drawImage(tmp, 0, 0, displayW, displayH);
        }

        const now = performance.now();
        if (videoEl.readyState >= 2 && now !== lastTimestamp) {
          lastTimestamp = now;
          const results = handLandmarkerRef.current.detectForVideo(videoEl, now);

          // ── Video frame ──
          ctx.clearRect(0, 0, displayW, displayH);
          const vw = videoEl.videoWidth, vh = videoEl.videoHeight;
          const videoAR = vw / vh, canvasAR = displayW / displayH;
          let sx = 0, sy = 0, sw = vw, sh = vh;
          if (videoAR > canvasAR) { sw = vh * canvasAR; sx = (vw - sw) / 2; }
          else { sh = vw / canvasAR; sy = (vh - sh) / 2; }
          ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, displayW, displayH);

          // ── Composite drawing layer ──
          if (dc) ctx.drawImage(dc, 0, 0);

          // ── Landmarks + drawing + toolbar interaction ──
          if (results.landmarks) {
            for (const landmarks of results.landmarks) {
              const pts = landmarks.map((lm) => ({
                x: ((lm.x * vw) - sx) / sw * displayW,
                y: ((lm.y * vh) - sy) / sh * displayH,
              }));

              // ── Two-finger gesture → toolbar navigation ──
              let isTwoFinger = false;
              if (drawingModeRef.current) {
                const idxTip = landmarks[8], midTip = landmarks[12];
                const d2 = Math.hypot(idxTip.x - midTip.x, idxTip.y - midTip.y);
                isTwoFinger = d2 < TWO_FINGER_THRESHOLD;

                if (isTwoFinger) {
                  const avgX = (pts[8].x + pts[12].x) / 2;
                  const avgY = (pts[8].y + pts[12].y) / 2;
                  const layout = getToolbarLayout(displayW);
                  const menu = menuStateRef.current;

                  // Is finger over the main button?
                  const overMain = Math.hypot(avgX - layout.mainBtn.x, avgY - layout.mainBtn.y) < layout.mainBtn.r + 12;

                  if (menu === "collapsed") {
                    if (overMain) {
                      menuHoverTimerRef.current++;
                      if (menuHoverTimerRef.current > 6) { // ~100ms at 60fps
                        menuStateRef.current = "expanded";
                        menuHoverTimerRef.current = 0;
                      }
                    } else {
                      menuHoverTimerRef.current = 0;
                    }
                  } else {
                    // Check rows
                    let overAnyRow = false;
                    for (const row of layout.rows) {
                      if (avgX >= row.x - 6 && avgX <= row.x + row.w + 6 &&
                        avgY >= row.y - 2 && avgY <= row.y + row.h + 2) {
                        overAnyRow = true;
                        if (row.id === "colors") {
                          menuStateRef.current = "colors";
                        } else if (row.id === "widths") {
                          menuStateRef.current = "widths";
                        } else if (row.id === "eraser") {
                          isEraserRef.current = true;
                          setActiveToolName("Eraser");
                          menuStateRef.current = "expanded";
                        }
                        break;
                      }
                    }

                    // Check sub-items
                    if (menu === "colors") {
                      for (const cs of layout.colorSubs) {
                        if (Math.hypot(avgX - cs.cx, avgY - cs.cy) < cs.r + 8) {
                          overAnyRow = true;
                          drawColorRef.current = cs.value;
                          isEraserRef.current = false;
                          setActiveToolName(cs.name);
                          // briefly flash then collapse
                          setTimeout(() => { menuStateRef.current = "collapsed"; }, 300);
                          break;
                        }
                      }
                    }
                    if (menu === "widths") {
                      for (const ws of layout.widthSubs) {
                        if (Math.hypot(avgX - ws.cx, avgY - ws.cy) < ws.r + 8) {
                          overAnyRow = true;
                          drawWidthRef.current = ws.value;
                          setActiveToolName(
                            (isEraserRef.current ? "Eraser" : DRAWING_COLORS.find(c => c.value === drawColorRef.current)?.name || "") +
                            ` · ${ws.name}`
                          );
                          setTimeout(() => { menuStateRef.current = "collapsed"; }, 300);
                          break;
                        }
                      }
                    }

                    // If not over any menu region AND not over main, collapse
                    if (!overAnyRow && !overMain) {
                      menuHoverTimerRef.current++;
                      if (menuHoverTimerRef.current > 15) {
                        menuStateRef.current = "collapsed";
                        menuHoverTimerRef.current = 0;
                      }
                    } else {
                      menuHoverTimerRef.current = 0;
                    }
                  }
                }
              }

              // ── Air Drawing (pinch with smoothing) ──────────────
              let isPenDown = false;
              if (drawingModeRef.current && !isTwoFinger) {
                const thumbTip = landmarks[4], indexTip = landmarks[8];
                const dist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
                const rawPinch = dist < PINCH_THRESHOLD;

                // Grace-frame logic: stay "pen down" briefly after pinch loss
                if (rawPinch) {
                  pinchGraceRef.current = 0;
                  isPenDown = true;
                } else if (wasPinchingRef.current && pinchGraceRef.current < PINCH_GRACE_FRAMES) {
                  pinchGraceRef.current++;
                  isPenDown = true;
                } else {
                  isPenDown = false;
                }

                const rawPt = pts[8];

                // ── Exponential Moving Average smoothing ──
                if (smoothPointRef.current) {
                  smoothPointRef.current = {
                    x: smoothPointRef.current.x + SMOOTHING_FACTOR * (rawPt.x - smoothPointRef.current.x),
                    y: smoothPointRef.current.y + SMOOTHING_FACTOR * (rawPt.y - smoothPointRef.current.y),
                  };
                } else {
                  smoothPointRef.current = { ...rawPt };
                }
                const sp = smoothPointRef.current;

                if (isPenDown && dc) {
                  const dcCtx = dc.getContext("2d");
                  if (dcCtx) {
                    if (isEraserRef.current) {
                      dcCtx.save();
                      dcCtx.globalCompositeOperation = "destination-out";
                      dcCtx.beginPath();
                      dcCtx.arc(sp.x, sp.y, drawWidthRef.current * 3, 0, Math.PI * 2);
                      dcCtx.fill();
                      dcCtx.restore();
                      // Emit erase event (normalized)
                      onDrawEventRef.current?.({
                        t: "erase",
                        x: sp.x / displayW,
                        y: sp.y / displayH,
                        w: drawWidthRef.current,
                      });
                    } else {
                      // Add smoothed point to ring buffer
                      pointBufRef.current.push({ x: sp.x, y: sp.y });
                      if (pointBufRef.current.length > 4) pointBufRef.current.shift();

                      const buf = pointBufRef.current;
                      if (buf.length >= 2) {
                        const color = drawColorRef.current;
                        const lw = drawWidthRef.current;

                        dcCtx.beginPath();
                        dcCtx.moveTo(buf[0].x, buf[0].y);

                        if (buf.length === 2) {
                          dcCtx.lineTo(buf[1].x, buf[1].y);
                        } else {
                          // Smooth spline through buffered points
                          for (let k = 1; k < buf.length - 1; k++) {
                            const cpX = (buf[k].x + buf[k + 1].x) / 2;
                            const cpY = (buf[k].y + buf[k + 1].y) / 2;
                            dcCtx.quadraticCurveTo(buf[k].x, buf[k].y, cpX, cpY);
                          }
                          dcCtx.lineTo(buf[buf.length - 1].x, buf[buf.length - 1].y);
                        }

                        dcCtx.strokeStyle = color;
                        dcCtx.lineWidth = lw;
                        dcCtx.lineCap = "round";
                        dcCtx.lineJoin = "round";
                        dcCtx.shadowBlur = lw * 2;
                        dcCtx.shadowColor = color;
                        dcCtx.stroke();
                        dcCtx.shadowBlur = lw * 0.8;
                        dcCtx.lineWidth = lw * 0.5;
                        dcCtx.globalAlpha = 0.7;
                        dcCtx.stroke();
                        dcCtx.globalAlpha = 1;
                        dcCtx.shadowBlur = 0;

                        // Emit draw event (normalized coordinates)
                        onDrawEventRef.current?.({
                          t: "draw",
                          pts: buf.map(p => [p.x / displayW, p.y / displayH] as [number, number]),
                          c: color,
                          w: lw,
                        });
                      }
                    }
                  }
                } else {
                  // Pen lifted — reset buffers & emit "up" event
                  if (wasPinchingRef.current) {
                    onDrawEventRef.current?.({ t: "up" });
                  }
                  smoothPointRef.current = null;
                  pointBufRef.current = [];
                }
                wasPinchingRef.current = isPenDown;
              } else if (drawingModeRef.current && isTwoFinger) {
                smoothPointRef.current = null;
                pointBufRef.current = [];
                wasPinchingRef.current = false;
                pinchGraceRef.current = 0;
              }

              // ── Draw skeleton ──
              ctx.strokeStyle = "#00FF88";
              ctx.lineWidth = 3;
              ctx.lineCap = "round";
              for (const [a, b] of HAND_CONNECTIONS) {
                ctx.beginPath();
                ctx.moveTo(pts[a].x, pts[a].y);
                ctx.lineTo(pts[b].x, pts[b].y);
                ctx.stroke();
              }

              // ── Draw landmark dots ──
              for (let i = 0; i < pts.length; i++) {
                const isIdx = i === 8;
                const r = FINGERTIP_IDS.has(i) ? 6 : 4;
                ctx.beginPath();
                ctx.arc(pts[i].x, pts[i].y, r, 0, Math.PI * 2);
                if (isIdx && drawingModeRef.current) {
                  const c = isEraserRef.current ? "#FFFFFF" : drawColorRef.current;
                  ctx.fillStyle = isPenDown ? c : "#FFD700";
                  ctx.fill();
                  ctx.strokeStyle = "#FFF"; ctx.lineWidth = 2; ctx.stroke();
                  if (isPenDown) {
                    ctx.beginPath();
                    ctx.arc(pts[i].x, pts[i].y, isEraserRef.current ? drawWidthRef.current * 3 : drawWidthRef.current * 2, 0, Math.PI * 2);
                    ctx.strokeStyle = isEraserRef.current ? "rgba(255,255,255,0.4)" : c + "80";
                    ctx.lineWidth = 2; ctx.stroke();
                  }
                } else {
                  ctx.fillStyle = FINGERTIP_IDS.has(i) ? "#FF3366" : "#FF6699";
                  ctx.fill();
                  ctx.strokeStyle = "#FFF"; ctx.lineWidth = 1.5; ctx.stroke();
                }
              }
            }
          }

          // ═════════════════════════════════════════════════════════
          //  DRAW THE TOOLBAR UI
          //  The canvas is inside a CSS-mirrored container (scaleX -1),
          //  so we counter-flip here so text and icons appear correct.
          // ═════════════════════════════════════════════════════════
          if (drawingModeRef.current) {
            const menu = menuStateRef.current;
            const layout = getToolbarLayout(displayW);

            // Counter-flip: mirror horizontally so text is readable
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-displayW, 0);
            // Now all coordinates are in "screen-right = canvas-right" space.
            // We need to remap x: screen x = displayW - canvasX
            // Since we already translated, we draw at (displayW - originalX - width).
            // Easiest: just compute mirrored positions.
            const mx = (x: number) => displayW - x; // mirror an x coord

            // ── Main button (always visible) ─────────────────────
            const mb = layout.mainBtn;
            const mbX = mx(mb.x);
            ctx.beginPath();
            ctx.arc(mbX, mb.y, mb.r, 0, Math.PI * 2);
            ctx.fillStyle = menu === "collapsed" ? "rgba(0,0,0,0.55)" : "rgba(0,191,255,0.7)";
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.7)";
            ctx.lineWidth = 2;
            ctx.stroke();
            // Hamburger icon (3 lines)
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 2;
            ctx.lineCap = "round";
            for (let li = -1; li <= 1; li++) {
              ctx.beginPath();
              ctx.moveTo(mbX - 9, mb.y + li * 7);
              ctx.lineTo(mbX + 9, mb.y + li * 7);
              ctx.stroke();
            }

            // ── Expanded menu rows ───────────────────────────────
            if (menu !== "collapsed") {
              for (const row of layout.rows) {
                const isHovered =
                  (row.id === "colors" && menu === "colors") ||
                  (row.id === "widths" && menu === "widths");
                const isActive =
                  (row.id === "eraser" && isEraserRef.current);

                // Mirrored row x: draw from right edge
                const rowX = displayW - row.x - row.w;

                // Row background
                ctx.fillStyle = isHovered || isActive
                  ? "rgba(0,191,255,0.35)"
                  : "rgba(0,0,0,0.5)";
                ctx.beginPath();
                ctx.roundRect(rowX, row.y, row.w, row.h, 10);
                ctx.fill();
                ctx.strokeStyle = "rgba(255,255,255,0.3)";
                ctx.lineWidth = 1;
                ctx.stroke();

                // Icon + label (text is now un-flipped!)
                ctx.fillStyle = "#FFFFFF";
                ctx.font = "bold 13px Inter, sans-serif";
                ctx.textBaseline = "middle";

                const cy = row.y + row.h / 2;
                const iconX = rowX + 20;
                const textX = rowX + 34;

                if (row.id === "colors") {
                  ctx.beginPath();
                  ctx.arc(iconX, cy, 7, 0, Math.PI * 2);
                  ctx.fillStyle = drawColorRef.current;
                  ctx.fill();
                  ctx.fillStyle = "#FFF";
                  ctx.fillText("Colors  ▸", textX, cy + 1);
                } else if (row.id === "widths") {
                  ctx.strokeStyle = "#FFF";
                  ctx.lineWidth = 3;
                  ctx.lineCap = "round";
                  ctx.beginPath();
                  ctx.moveTo(iconX - 7, cy);
                  ctx.lineTo(iconX + 7, cy);
                  ctx.stroke();
                  ctx.fillStyle = "#FFF";
                  ctx.fillText("Width  ▸", textX, cy + 1);
                } else {
                  // Eraser icon (small ✕)
                  ctx.strokeStyle = "#FF3B5C";
                  ctx.lineWidth = 2.5;
                  ctx.lineCap = "round";
                  const off = 5;
                  ctx.beginPath();
                  ctx.moveTo(iconX - off, cy - off);
                  ctx.lineTo(iconX + off, cy + off);
                  ctx.stroke();
                  ctx.beginPath();
                  ctx.moveTo(iconX + off, cy - off);
                  ctx.lineTo(iconX - off, cy + off);
                  ctx.stroke();
                  ctx.fillStyle = "#FFF";
                  ctx.fillText("Eraser", textX, cy + 1);
                }
              }

              // ── Color sub-items ──
              if (menu === "colors") {
                for (const cs of layout.colorSubs) {
                  const csMx = mx(cs.cx);
                  const isSel = !isEraserRef.current && drawColorRef.current === cs.value;
                  if (isSel) {
                    ctx.beginPath();
                    ctx.arc(csMx, cs.cy, cs.r + 4, 0, Math.PI * 2);
                    ctx.strokeStyle = "#FFF";
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                  }
                  ctx.beginPath();
                  ctx.arc(csMx, cs.cy, cs.r, 0, Math.PI * 2);
                  ctx.fillStyle = cs.value;
                  ctx.fill();
                  ctx.strokeStyle = "rgba(255,255,255,0.5)";
                  ctx.lineWidth = 1.5;
                  ctx.stroke();
                }
              }

              // ── Width sub-items ──
              if (menu === "widths") {
                for (const ws of layout.widthSubs) {
                  const wsMx = mx(ws.cx);
                  const isSel = drawWidthRef.current === ws.value;
                  ctx.beginPath();
                  ctx.arc(wsMx, ws.cy, ws.r, 0, Math.PI * 2);
                  ctx.fillStyle = isSel ? "rgba(0,191,255,0.4)" : "rgba(0,0,0,0.5)";
                  ctx.fill();
                  ctx.strokeStyle = isSel ? "#FFF" : "rgba(255,255,255,0.4)";
                  ctx.lineWidth = isSel ? 2.5 : 1.5;
                  ctx.stroke();
                  // Line preview inside circle
                  ctx.strokeStyle = "#FFF";
                  ctx.lineWidth = ws.value;
                  ctx.lineCap = "round";
                  ctx.beginPath();
                  ctx.moveTo(wsMx - 8, ws.cy);
                  ctx.lineTo(wsMx + 8, ws.cy);
                  ctx.stroke();
                }
              }
            }

            ctx.restore(); // undo the counter-flip
          }
        }

        animFrameRef.current = requestAnimationFrame(detect);
      };

      setIsDetecting(true);
      detect();
    },
    [initModel, getToolbarLayout]
  );

  // ── Stop detection ───────────────────────────────────────────────
  const stopDetection = useCallback(
    (canvasEl?: HTMLCanvasElement | null) => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (canvasEl) {
        const ctx = canvasEl.getContext("2d");
        ctx?.clearRect(0, 0, canvasEl.width, canvasEl.height);
      }
      smoothPointRef.current = null;
      pointBufRef.current = [];
      wasPinchingRef.current = false;
      pinchGraceRef.current = 0;
      isEraserRef.current = false;
      menuStateRef.current = "collapsed";
      setIsDrawingMode(false);
      setActiveToolName(DRAWING_COLORS[0].name);
      clearDrawing();
      setIsDetecting(false);
    },
    [clearDrawing]
  );

  // ── Cleanup on unmount ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
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
    activeToolName,
    onDrawEventRef,
  };
}
