import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import YPartyKitProvider from "y-partyserver/provider";
import * as awarenessProtocol from "y-protocols/awareness.js";
import "./App.css";

type Point = {
  x: number;
  y: number;
};

type Stroke = {
  id: string;
  points: Point[];
  color: string;
  width: number;
  // Optional for backward compatibility with existing strokes.
  tool?: "pen" | "pencil" | "brush" | "line" | "rectangle" | "circle" | "arrow" | "text";
  text?: string;
  fontSize?: number;
};

type RemoteUser = {
  x: number;
  y: number;
  name: string;
  color: string;
};

type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected";

/*
 * ============================================================
 * ROOM
 * ============================================================
 */

const getRoomName = () => {
  const path = window.location.pathname;

  if (path.startsWith("/room/")) {
    const room = path
      .replace("/room/", "")
      .trim();

    if (room) {
      return decodeURIComponent(room);
    }
  }

  return "default-room";
};

const ROOM_NAME = getRoomName();

/*
 * ============================================================
 * USER COLORS
 * ============================================================
 */

const USER_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#f97316",
  "#06b6d4",
];

/*
 * ============================================================
 * CANVAS SIZE
 * ============================================================
 */

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 650;

/*
 * ============================================================
 * APP
 * ============================================================
 */

function App() {
  const canvasRef =
    useRef<HTMLCanvasElement | null>(null);

  const docRef =
    useRef<Y.Doc | null>(null);

  const providerRef =
    useRef<YPartyKitProvider | null>(null);

  const strokesRef =
    useRef<Y.Array<Stroke> | null>(null);

  const awarenessRef =
    useRef<awarenessProtocol.Awareness | null>(null);

  const undoManagerRef =
    useRef<Y.UndoManager | null>(null);

  /*
   * ==========================================================
   * STATE
   * ==========================================================
   */

  const [strokes, setStrokes] =
    useState<Stroke[]>([]);

  const [currentStroke] =
    useState<Stroke | null>(null);

  const currentStrokeRef =
    useRef<Stroke | null>(null);

  const activePointerIdRef =
    useRef<number | null>(null);

  const [color, setColor] =
    useState("#000000");

  const [width, setWidth] =
    useState(5);

  const [tool, setTool] =
    useState<
      | "pen"
      | "pencil"
      | "brush"
      | "eraser"
      | "line"
      | "rectangle"
      | "circle"
      | "arrow"
      | "text"
    >("pen");

  const [remoteUsers, setRemoteUsers] =
    useState<Record<number, RemoteUser>>({});

  const [connectedUsers, setConnectedUsers] =
    useState(0);

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");

  const [roomInput, setRoomInput] =
    useState(ROOM_NAME);

  const [zoom, setZoom] = useState(1);

  /*
   * ==========================================================
   * USER IDENTITY
   * ==========================================================
   */

  const userColorRef = useRef(
    USER_COLORS[
      Math.floor(
        Math.random() *
          USER_COLORS.length
      )
    ]
  );

  const userNameRef = useRef(
    `User ${
      Math.floor(
        Math.random() * 900
      ) + 100
    }`
  );

  /*
   * ==========================================================
   * CONNECT YJS + PARTYKIT
   * ==========================================================
   */

  useEffect(() => {
    const ydoc = new Y.Doc();

    const awareness =
      new awarenessProtocol.Awareness(
        ydoc
      );

    const provider =
      new YPartyKitProvider(
        "https://collaborative-canvas-yjs.collaborative-canvas-kiruba.workers.dev",
        ROOM_NAME,
        ydoc,
        {
          awareness,
          party: "collaborative-canvas",
          
        }
      );

    /*
     * CONNECTION STATUS
     */

    const handleConnectionStatus = ({
      status,
    }: {
      status:
        | "connecting"
        | "connected"
        | "disconnected";
    }) => {
      if (status === "connected") {
        setConnectionStatus("connected");
      } else if (
        status === "disconnected"
      ) {
        setConnectionStatus(
          "disconnected"
        );
      } else {
        setConnectionStatus(
          "connecting"
        );
      }
    };

    provider.on(
      "status",
      handleConnectionStatus
    );

    /*
     * SHARED STROKES
     */

    const ystrokes =
      ydoc.getArray<Stroke>(
        "strokes"
      );

    /*
     * UNDO MANAGER
     */

    const undoManager =
      new Y.UndoManager(
        ystrokes
      );

    /*
     * STORE REFERENCES
     */

    docRef.current = ydoc;
    providerRef.current = provider;
    strokesRef.current = ystrokes;
    awarenessRef.current = awareness;
    undoManagerRef.current =
      undoManager;

    /*
     * STROKE SYNCHRONIZATION
     */

    const updateStrokes = () => {
      setStrokes(
        ystrokes.toArray()
      );
    };

    updateStrokes();

    ystrokes.observe(
      updateStrokes
    );

    /*
     * PRESENCE
     */

    awareness.setLocalState({
      user: {
        name: userNameRef.current,
        color: userColorRef.current,
      },
      cursor: null,
    });

    const updatePresence = () => {
      const states =
        awareness.getStates();

      const users: Record<
        number,
        RemoteUser
      > = {};

      states.forEach(
        (state, clientId) => {
          if (
            clientId ===
            ydoc.clientID
          ) {
            return;
          }

          if (
            !state.user ||
            !state.cursor
          ) {
            return;
          }

          users[clientId] = {
            x: state.cursor.x,
            y: state.cursor.y,
            name: state.user.name,
            color: state.user.color,
          };
        }
      );

      setConnectedUsers(
        Math.max(
          states.size - 1,
          0
        )
      );

      setRemoteUsers(users);
    };

    awareness.on(
      "change",
      updatePresence
    );

    updatePresence();

    /*
     * CLEANUP
     */

    return () => {
      ystrokes.unobserve(
        updateStrokes
      );

      awareness.off(
        "change",
        updatePresence
      );

      provider.off(
        "status",
        handleConnectionStatus
      );

      awareness.setLocalState(
        null
      );

      undoManager.destroy();

      provider.destroy();

      ydoc.destroy();

      docRef.current = null;
      providerRef.current = null;
      strokesRef.current = null;
      awarenessRef.current = null;
      undoManagerRef.current =
        null;
    };
  }, []);

  /*
   * ==========================================================
   * REDRAW CANVAS
   * ==========================================================
   */

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    const ctx =
      canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    for (const stroke of strokes) {
      drawStroke(
        ctx,
        stroke
      );
    }

    if (currentStroke) {
      drawStroke(
        ctx,
        currentStroke
      );
    }
  }, [
    strokes,
    currentStroke,
  ]);

  /*
   * ==========================================================
   * NATIVE POINTER DRAWING
   * ==========================================================
   *
   * Direct canvas drawing for mouse, touch and Apple Pencil.
   * The live stroke is NOT pushed through React state on every
   * move. This avoids Safari/React redraw timing issues.
   */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getPoint = (event: PointerEvent): Point => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * (canvas.width / rect.width),
        y: (event.clientY - rect.top) * (canvas.height / rect.height),
      };
    };

    const redraw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const stroke of strokesRef.current?.toArray() ?? []) {
        drawStroke(ctx, stroke);
      }

      const liveStroke = currentStrokeRef.current;
      if (liveStroke) {
        drawStroke(ctx, liveStroke);
      }
    };

    const drawLiveSegment = (from: Point, to: Point) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Keep the original Pen rendering unchanged.
      if (tool === "pen") {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        return;
      }

      if (tool === "pencil") {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.62;
        ctx.lineWidth = Math.max(1, width * 0.55);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        return;
      }

      // Brush: broader, softer-looking stroke.
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.72;
      ctx.lineWidth = Math.max(2, width * 1.55);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const createId = () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const makeStroke = (point: Point): Stroke => ({
      id: createId(),
      points: [point],
      color,
      width,
      tool: tool === "eraser" ? "pen" : tool,
    });

    const handleDown = (event: PointerEvent) => {
      if (activePointerIdRef.current !== null) return;

      activePointerIdRef.current = event.pointerId;
      event.preventDefault();

      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Safari may reject capture in some edge cases.
      }

      const point = getPoint(event);

      if (tool === "eraser") {
        eraseAtPoint(point);
        return;
      }

      if (tool === "text") {
        const text = window.prompt("Enter text:");
        if (text && text.trim()) {
          strokesRef.current?.push([{
            ...makeStroke(point),
            text: text.trim(),
            fontSize: Math.max(12, width * 4),
          }]);
        }

        currentStrokeRef.current = null;
        activePointerIdRef.current = null;

        try {
          canvas.releasePointerCapture(event.pointerId);
        } catch {}

        redraw();
        return;
      }

      const stroke: Stroke = makeStroke(point);
      currentStrokeRef.current = stroke;

      // Draw the first touch immediately.
      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (tool === "pen") {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(point.x, point.y, width / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (tool === "pencil") {
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.62;
          ctx.beginPath();
          ctx.arc(
            point.x,
            point.y,
            Math.max(0.8, width * 0.28),
            0,
            Math.PI * 2
          );
          ctx.fill();
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.72;
          ctx.beginPath();
          ctx.arc(
            point.x,
            point.y,
            Math.max(1, width * 0.78),
            0,
            Math.PI * 2
          );
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    };

    const handleMove = (event: PointerEvent) => {
      if (activePointerIdRef.current !== event.pointerId) {
        if (event.pointerType !== "touch") {
          awarenessRef.current?.setLocalStateField(
            "cursor",
            getPoint(event)
          );
        }
        return;
      }

      event.preventDefault();

      const point = getPoint(event);

      if (tool === "eraser") {
        eraseAtPoint(point);
        return;
      }

      const stroke = currentStrokeRef.current;
      if (!stroke) return;

      const previousPoint = stroke.points[stroke.points.length - 1];
      if (!previousPoint) return;

      drawLiveSegment(previousPoint, point);

      currentStrokeRef.current = {
        ...stroke,
        points: [...stroke.points, point],
      };
    };

    const finishPointer = (event: PointerEvent) => {
      if (activePointerIdRef.current !== event.pointerId) return;

      event.preventDefault();

      const stroke = currentStrokeRef.current;

      if (
        (tool === "pen" ||
          tool === "pencil" ||
          tool === "brush" ||
          tool === "line" ||
          tool === "rectangle" ||
          tool === "circle" ||
          tool === "arrow") &&
        stroke &&
        stroke.points.length > 0
      ) {
        strokesRef.current?.push([stroke]);
      }

      currentStrokeRef.current = null;
      activePointerIdRef.current = null;

      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore Safari capture errors.
      }

      // Make the committed Yjs stroke visible immediately.
      redraw();
    };

    const handleCancel = (event: PointerEvent) => {
      finishPointer(event);
    };

    canvas.addEventListener("pointerdown", handleDown, { passive: false });
    canvas.addEventListener("pointermove", handleMove, { passive: false });
    canvas.addEventListener("pointerup", finishPointer, { passive: false });
    canvas.addEventListener("pointercancel", handleCancel, { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown", handleDown);
      canvas.removeEventListener("pointermove", handleMove);
      canvas.removeEventListener("pointerup", finishPointer);
      canvas.removeEventListener("pointercancel", handleCancel);
    };
  }, [tool, color, width]);

  const handlePointerLeave = () => {
    awarenessRef.current?.setLocalStateField("cursor", null);
  };

  const strokeIntersectsPoint = (
    stroke: Stroke,
    point: Point,
    tolerance: number
  ) => {
    const points = stroke.points;
    if (points.length === 0) return false;

    const distanceToSegment = (p: Point, a: Point, b: Point) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (dx === 0 && dy === 0) {
        return Math.hypot(p.x - a.x, p.y - a.y);
      }
      const t = Math.max(
        0,
        Math.min(
          1,
          ((p.x - a.x) * dx + (p.y - a.y) * dy) /
            (dx * dx + dy * dy)
        )
      );
      const x = a.x + t * dx;
      const y = a.y + t * dy;
      return Math.hypot(p.x - x, p.y - y);
    };

    const hitTolerance = tolerance + stroke.width / 2;
    const tool = stroke.tool ?? "pen";

    if (tool === "text") {
      const p = points[0];
      return (
        point.x >= p.x - hitTolerance &&
        point.x <= p.x + Math.max(40, (stroke.text?.length ?? 1) * (stroke.fontSize ?? 20) * 0.6) + hitTolerance &&
        point.y >= p.y - hitTolerance &&
        point.y <= p.y + (stroke.fontSize ?? 20) + hitTolerance
      );
    }

    if (tool === "line" || tool === "arrow") {
      return distanceToSegment(point, points[0], points[points.length - 1]) <= hitTolerance;
    }

    if (tool === "rectangle" || tool === "circle") {
      const a = points[0];
      const b = points[points.length - 1];
      const minX = Math.min(a.x, b.x) - hitTolerance;
      const maxX = Math.max(a.x, b.x) + hitTolerance;
      const minY = Math.min(a.y, b.y) - hitTolerance;
      const maxY = Math.max(a.y, b.y) + hitTolerance;
      return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
    }

    for (let i = 0; i < points.length; i++) {
      if (i === 0) {
        if (Math.hypot(point.x - points[i].x, point.y - points[i].y) <= hitTolerance) return true;
      } else if (distanceToSegment(point, points[i - 1], points[i]) <= hitTolerance) {
        return true;
      }
    }
    return false;
  };

  /*
   * ==========================================================
   * ERASER
   * ==========================================================
   */

  const eraseAtPoint = (
    point: Point
  ) => {
    const ystrokes =
      strokesRef.current;

    if (!ystrokes) {
      return;
    }

    // Remove only the stroke currently touched by the eraser.
    // Check from the newest stroke backwards so the topmost
    // drawing is erased first.
    for (
      let i =
        ystrokes.length - 1;
      i >= 0;
      i--
    ) {
      const stroke =
        ystrokes.get(i);

      if (
        strokeIntersectsPoint(
          stroke,
          point,
          18
        )
      ) {
        ystrokes.delete(
          i,
          1
        );

        return;
      }
    }
  };

  /*
   * ==========================================================
   * CLEAR CANVAS
   * ==========================================================
   */

  const clearCanvas = () => {
    const ystrokes =
      strokesRef.current;

    if (!ystrokes) {
      return;
    }

    if (ystrokes.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      "Clear the entire canvas?\n\nThis will remove the drawing for everyone in this room."
    );

    if (!confirmed) {
      return;
    }

    ystrokes.delete(
      0,
      ystrokes.length
    );
  };

  /*
   * ==========================================================
   * EXPORT CANVAS
   * ==========================================================
   */

  const exportCanvas = () => {
  const canvas = canvasRef.current;

  if (!canvas) {
    return;
  }

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;

  const ctx = exportCanvas.getContext("2d");

  if (!ctx) {
    return;
  }

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(
    0,
    0,
    exportCanvas.width,
    exportCanvas.height
  );

  // Light grid
  ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
  ctx.lineWidth = 1;

  const gridSize = 32;

  for (
    let x = 0;
    x <= exportCanvas.width;
    x += gridSize
  ) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, exportCanvas.height);
    ctx.stroke();
  }

  for (
    let y = 0;
    y <= exportCanvas.height;
    y += gridSize
  ) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(exportCanvas.width, y);
    ctx.stroke();
  }

  // Draw all saved strokes
  for (
    const stroke of strokesRef.current?.toArray() ?? []
  ) {
    drawStroke(ctx, stroke);
  }

  const link = document.createElement("a");

  link.download =
    `collaborative-canvas-${Date.now()}.png`;

  link.href =
    exportCanvas.toDataURL("image/png");

  link.click();
  };

  /*
   * ==========================================================
   * UNDO
   * ==========================================================
   */

  const undo = () => {
    undoManagerRef.current?.undo();
  };

  /*
   * ==========================================================
   * REDO
   * ==========================================================
   */

  const redo = () => {
    undoManagerRef.current?.redo();
  };

  /*
   * ==========================================================
   * SHARE ROOM
   * ==========================================================
   */

  const shareRoom = async () => {
  const roomLink = window.location.href;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(roomLink);
      alert("Room link copied!");
      return;
    }

    // Fallback for iPhone / HTTP LAN
    const textArea = document.createElement("textarea");
    textArea.value = roomLink;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);

    textArea.focus();
    textArea.select();

    const copied = document.execCommand("copy");
    document.body.removeChild(textArea);

    if (copied) {
      alert("Room link copied!");
    } else {
      alert("Please copy this link:\n" + roomLink);
    }
  } catch {
    alert("Please copy this link:\n" + roomLink);
  }
};

  /*
   * ==========================================================
   * JOIN ROOM
   * ==========================================================
   */

  const joinRoom = () => {
    const room =
      roomInput.trim();

    if (!room) {
      return;
    }

    window.location.href =
      `/room/${encodeURIComponent(room)}`;
  };

  /*
   * ==========================================================
   * KEYBOARD SHORTCUTS
   * ==========================================================
   */

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifier =
        event.metaKey || event.ctrlKey;

      const key = event.key.toLowerCase();

      if (!isModifier) {
        return;
      }

      // Undo
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      // Redo on Mac
      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
        return;
      }

      // Redo on Windows/Linux
      if (key === "y" && event.ctrlKey) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

  /*
   * ==========================================================
   * CONNECTION STATUS
   * ==========================================================
   */

  const connectionText =
    connectionStatus ===
    "connecting"
      ? "Connecting..."
      : connectionStatus ===
        "disconnected"
      ? "Disconnected · Reconnecting..."
      : connectedUsers === 0
      ? "Connected · Only you"
      : `Connected · ${connectedUsers} other ${
          connectedUsers === 1
            ? "user"
            : "users"
        } online`;

  /*
   * ==========================================================
   * UI
   * ==========================================================
   */

  return (
    <div className="app">

      <header className="header">

        <div className="header-left">

          <div className="brand-row">
            <div className="brand-mark" aria-hidden="true">
              <span>✎</span>
            </div>

            <div className="brand-copy">
              <h1>
                Collaborative Canvas
              </h1>

              <p>
                Real-time drawing workspace
              </p>
            </div>

            <div
              className={`live-indicator ${connectionStatus}`}
              title={connectionText}
            >
              <span className="live-dot" />
              <span>LIVE</span>
            </div>
          </div>

          <div className="room-info">
            Room:{" "}
            <strong>
              {ROOM_NAME}
            </strong>
          </div>

          <div className="room-join">

            <input
              type="text"
              value={roomInput}
              onChange={(event) =>
                setRoomInput(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  joinRoom();
                }
              }}
              placeholder="Enter room name"
            />

            <button
              className="join-room-button"
              onClick={joinRoom}
            >
              Join Room
            </button>

          </div>

          <div className="presence-bar">
            <div
              className={`connection-status ${connectionStatus}`}
            >
              <span className="status-dot" />
              <span>
                {connectionText}
              </span>
            </div>

            <div className="presence-people">
              <div className="user-avatars">
                <div
                  className="user-avatar current-user"
                  style={{
                    backgroundColor: userColorRef.current,
                  }}
                  title={`${userNameRef.current} (You)`}
                >
                  {userNameRef.current.slice(-2)}
                </div>

                {Object.entries(remoteUsers).map(
                  ([clientId, user]) => (
                    <div
                      key={clientId}
                      className="user-avatar"
                      style={{
                        backgroundColor: user.color,
                      }}
                      title={user.name}
                    >
                      {user.name.slice(-2)}
                    </div>
                  )
                )}
              </div>

              <span className="presence-count">
                {connectedUsers === 0
                  ? "Only you"
                  : `${connectedUsers} collaborator${
                      connectedUsers === 1 ? "" : "s"
                    }`}
              </span>
            </div>
          </div>

        </div>

        <div className="controls">

          <div className="control-heading">
            <span className="control-eyebrow">
              Brush settings
            </span>
            <span className="control-tool">
              {tool === "eraser"
                ? "Eraser"
                : tool === "pencil"
                ? "Pencil"
                : tool === "brush"
                ? "Brush"
                : "Pen"}
            </span>
          </div>

          <div className="control-row">

            <label className="color-control">
              <span>Color</span>

              <input
                type="color"
                value={color}
                disabled={
                  tool === "eraser"
                }
                onChange={(event) =>
                  setColor(
                    event.target.value
                  )
                }
              />
            </label>

            <div className="control-separator" />

            <label className="width-control">
              <span className="width-label">
                Brush size
              </span>

              <div className="width-input">
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={width}
                  onChange={(event) =>
                    setWidth(
                      Number(
                        event.target.value
                      )
                    )
                  }
                />

                <span>
                  {width}px
                </span>
              </div>
            </label>

          </div>

        </div>

      </header>

      {/* =====================================================
          TOOLBAR
          ===================================================== */}

      <div className="toolbar">

        <button
          className={
            tool === "pen"
              ? "tool-button active"
              : "tool-button"
          }
          onClick={() =>
            setTool("pen")
          }
        >
          ✏️ Pen
        </button>

        <button
          className={
            tool === "pencil"
              ? "tool-button pencil-tool active"
              : "tool-button pencil-tool"
          }
          onClick={() =>
            setTool("pencil")
          }
        >
          ✏️ Pencil
        </button>

        <button
          className={
            tool === "brush"
              ? "tool-button brush-tool active"
              : "tool-button brush-tool"
          }
          onClick={() =>
            setTool("brush")
          }
        >
          🖌️ Brush
        </button>

        <button
          className={
            tool === "eraser"
              ? "tool-button active"
              : "tool-button"
          }
          onClick={() =>
            setTool("eraser")
          }
        >
          🧹 Eraser
        </button>

        <div className="toolbar-divider" />

        <button className={tool === "line" ? "tool-button active" : "tool-button"} onClick={() => setTool("line")}>
          📏 Line
        </button>

        <button className={tool === "rectangle" ? "tool-button active" : "tool-button"} onClick={() => setTool("rectangle")}>
          ▭ Rectangle
        </button>

        <button className={tool === "circle" ? "tool-button active" : "tool-button"} onClick={() => setTool("circle")}>
          ⭕ Circle
        </button>

        <button className={tool === "arrow" ? "tool-button active" : "tool-button"} onClick={() => setTool("arrow")}>
          ➡️ Arrow
        </button>

        <button className={tool === "text" ? "tool-button active" : "tool-button"} onClick={() => setTool("text")}>
          📝 Text
        </button>

        <label className="color-picker-tool" title="Choose drawing color">
          🎨
          <input
            aria-label="Color picker"
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
        </label>

        <div className="toolbar-divider" />

        <button
          className="tool-button"
          onClick={undo}
        >
          ↩️ Undo
        </button>

        <button
          className="tool-button"
          onClick={redo}
        >
          ↪️ Redo
        </button>

        <button
          className="tool-button danger"
          onClick={clearCanvas}
        >
          🗑️ Clear
        </button>

        <button
          className="tool-button"
          onClick={exportCanvas}
        >
          📥 Export PNG
        </button>

        <button
          className="tool-button share-button"
          onClick={shareRoom}
        >
          🔗 Share Room
        </button>

        <div className="zoom-control" aria-label="Canvas zoom controls">
          <button
            className="zoom-button"
            onClick={() => setZoom((value) => Math.max(0.5, +(value - 0.1).toFixed(1)))}
            aria-label="Zoom out"
          >
            −
          </button>

          <span>{Math.round(zoom * 100)}%</span>

          <button
            className="zoom-button"
            onClick={() => setZoom((value) => Math.min(2, +(value + 0.1).toFixed(1)))}
            aria-label="Zoom in"
          >
            +
          </button>

          <button
            className="zoom-reset"
            onClick={() => setZoom(1)}
          >
            Reset
          </button>
        </div>

        <div className="shortcut-info">

          <span>
            ⌘/Ctrl + Z
          </span>

          <span>
            Undo
          </span>

        </div>

      </div>

      {/* =====================================================
          CANVAS
          ===================================================== */}

      <main className="canvas-container">

        <div
          className="canvas-wrapper"
          style={{ transform: `scale(${zoom})` }}
        >

          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            style={{
              touchAction: "none",
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
            }}
            onPointerLeave={
              handlePointerLeave
            }
          />

          {/* =================================================
              REMOTE CURSORS
              ================================================= */}

          {Object.entries(
            remoteUsers
          ).map(
            ([clientId, user]) => (

              <div
                key={clientId}
                className="remote-cursor"
                style={{
                  pointerEvents: "none",
                  left: `${(
                    user.x /
                    CANVAS_WIDTH
                  ) * 100}%`,

                  top: `${(
                    user.y /
                    CANVAS_HEIGHT
                  ) * 100}%`,
                }}
              >

                <div
                  className="cursor-pointer"
                  style={{
                    borderBottomColor:
                      user.color,
                  }}
                />

                <div
                  className="cursor-label"
                  style={{
                    backgroundColor:
                      user.color,
                  }}
                >
                  {user.name}
                </div>

              </div>

            )
          )}

        </div>

      </main>

    </div>
  );
}

/*
 * ============================================================
 * DRAW STROKE
 * ============================================================
 */

function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke
) {
  if (stroke.points.length === 0) {
    return;
  }

  const strokeTool = stroke.tool ?? "pen";
  const first = stroke.points[0];
  const last = stroke.points[stroke.points.length - 1];

  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (
    strokeTool === "line" ||
    strokeTool === "rectangle" ||
    strokeTool === "circle" ||
    strokeTool === "arrow"
  ) {
    ctx.globalAlpha = 1;
    ctx.lineWidth = stroke.width;

    if (strokeTool === "line") {
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    } else if (strokeTool === "rectangle") {
      ctx.strokeRect(
        first.x,
        first.y,
        last.x - first.x,
        last.y - first.y
      );
    } else if (strokeTool === "circle") {
      const radiusX = Math.abs(last.x - first.x) / 2;
      const radiusY = Math.abs(last.y - first.y) / 2;
      const centerX = (first.x + last.x) / 2;
      const centerY = (first.y + last.y) / 2;

      ctx.beginPath();
      ctx.ellipse(
        centerX,
        centerY,
        radiusX,
        radiusY,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    } else {
      const angle = Math.atan2(
        last.y - first.y,
        last.x - first.x
      );
      const head = Math.max(10, stroke.width * 3);

      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      ctx.lineTo(last.x, last.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(
        last.x - head * Math.cos(angle - Math.PI / 6),
        last.y - head * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        last.x - head * Math.cos(angle + Math.PI / 6),
        last.y - head * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    return;
  }

  if (strokeTool === "text") {
    if (!stroke.text) {
      return;
    }

    ctx.globalAlpha = 1;
    ctx.font = `600 ${stroke.fontSize ?? 20}px Inter, Arial, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(stroke.text, first.x, first.y);
    return;
  }

  // Existing Pen/Pencil/Brush rendering kept intact.
  if (strokeTool === "pen") {
    ctx.globalAlpha = 1;
    ctx.lineWidth = stroke.width;
  } else if (strokeTool === "pencil") {
    ctx.globalAlpha = 0.62;
    ctx.lineWidth = Math.max(1, stroke.width * 0.55);
  } else {
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = Math.max(2, stroke.width * 1.55);
  }

  if (stroke.points.length === 1) {
    ctx.beginPath();
    ctx.arc(
      first.x,
      first.y,
      stroke.width / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }

  ctx.beginPath();
  ctx.moveTo(first.x, first.y);

  for (
    let i = 1;
    i < stroke.points.length - 1;
    i++
  ) {
    const current = stroke.points[i];
    const next = stroke.points[i + 1];

    const midX =
      (current.x + next.x) / 2;
    const midY =
      (current.y + next.y) / 2;

    ctx.quadraticCurveTo(
      current.x,
      current.y,
      midX,
      midY
    );
  }

  const secondLastPoint =
    stroke.points[stroke.points.length - 2];

  ctx.quadraticCurveTo(
    secondLastPoint.x,
    secondLastPoint.y,
    last.x,
    last.y
  );

  ctx.stroke();
  ctx.globalAlpha = 1;
}

export default App;