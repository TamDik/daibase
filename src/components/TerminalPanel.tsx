import { CloseRounded } from "@mui/icons-material";
import { Box, CircularProgress, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";

import {
  resizeTerminal,
  startTerminal,
  stopTerminal,
  type TerminalExitEvent,
  type TerminalOutputEvent,
  type TerminalSessionSummary,
  writeTerminal,
} from "../api/tauriCommands";

const TERMINAL_OUTPUT_EVENT = "terminal:output";
const TERMINAL_EXIT_EVENT = "terminal:exit";
const defaultTerminalHeight = 320;
const minTerminalHeight = 160;
const keyboardResizeStep = 24;

export function TerminalPanel({ onClose }: { onClose: () => void }) {
  const [session, setSession] = useState<TerminalSessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [terminalHeight, setTerminalHeight] = useState(defaultTerminalHeight);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);
  const dragState = useRef<{ startY: number; startHeight: number } | null>(null);

  onCloseRef.current = onClose;

  const maxTerminalHeight = Math.max(minTerminalHeight, window.innerHeight - 120);
  const clampTerminalHeight = (height: number) =>
    Math.min(maxTerminalHeight, Math.max(minTerminalHeight, Math.round(height)));

  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragState.current = {
      startY: event.clientY,
      startHeight: terminalHeight,
    };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handleResizeMove = (event: PointerEvent) => {
      if (!dragState.current) {
        return;
      }

      const nextHeight = dragState.current.startHeight + dragState.current.startY - event.clientY;
      setTerminalHeight(clampTerminalHeight(nextHeight));
    };

    const handleResizeEnd = () => {
      if (!dragState.current) {
        return;
      }

      dragState.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handleResizeMove);
    window.addEventListener("pointerup", handleResizeEnd);
    window.addEventListener("pointercancel", handleResizeEnd);

    return () => {
      window.removeEventListener("pointermove", handleResizeMove);
      window.removeEventListener("pointerup", handleResizeEnd);
      window.removeEventListener("pointercancel", handleResizeEnd);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [maxTerminalHeight]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let isMounted = true;
    let unlistenOutput: UnlistenFn | null = null;
    let unlistenExit: UnlistenFn | null = null;
    let startedSessionId: string | null = null;

    const terminal = new Terminal({
      allowProposedApi: true,
      convertEol: false,
      cursorBlink: true,
      fontFamily:
        'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      scrollback: 5000,
      theme: {
        background: "#0d1117",
        black: "#484f58",
        blue: "#58a6ff",
        brightBlack: "#6e7681",
        brightBlue: "#79c0ff",
        brightCyan: "#56d4dd",
        brightGreen: "#56d364",
        brightMagenta: "#d2a8ff",
        brightRed: "#ff7b72",
        brightWhite: "#ffffff",
        brightYellow: "#e3b341",
        cyan: "#39c5cf",
        foreground: "#f0f6fc",
        green: "#3fb950",
        magenta: "#bc8cff",
        red: "#ff7b72",
        selectionBackground: "#264f78",
        white: "#b1bac4",
        yellow: "#d29922",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    fitAddon.fit();
    terminal.focus();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const dataDisposable = terminal.onData((data) => {
      const sessionId = sessionIdRef.current;
      if (sessionId) {
        void writeTerminal(sessionId, data).catch((writeError) => {
          setError(String(writeError));
        });
      }
    });

    const resizeToFit = () => {
      fitAddon.fit();
      const dimensions = fitAddon.proposeDimensions();
      const sessionId = sessionIdRef.current;
      if (!dimensions || !sessionId) {
        return dimensions;
      }
      void resizeTerminal(sessionId, dimensions.cols, dimensions.rows).catch((resizeError) => {
        setError(String(resizeError));
      });
      return dimensions;
    };

    const initialDimensions = resizeToFit();

    listen<TerminalOutputEvent>(TERMINAL_OUTPUT_EVENT, (event) => {
      if (event.payload.session_id !== sessionIdRef.current) {
        return;
      }
      terminal.write(event.payload.text);
    })
      .then((nextUnlisten) => {
        unlistenOutput = nextUnlisten;
      })
      .catch((listenError) => {
        if (isMounted) {
          setError(String(listenError));
        }
      });

    listen<TerminalExitEvent>(TERMINAL_EXIT_EVENT, (event) => {
      if (event.payload.session_id === sessionIdRef.current) {
        onCloseRef.current();
      }
    })
      .then((nextUnlisten) => {
        unlistenExit = nextUnlisten;
      })
      .catch((listenError) => {
        if (isMounted) {
          setError(String(listenError));
        }
      });

    startTerminal(initialDimensions?.cols, initialDimensions?.rows)
      .then((nextSession) => {
        if (!isMounted) {
          void stopTerminal(nextSession.id);
          return;
        }
        startedSessionId = nextSession.id;
        sessionIdRef.current = nextSession.id;
        setSession(nextSession);
        resizeToFit();
      })
      .catch((startError) => {
        if (isMounted) {
          setError(String(startError));
        }
      });

    const resizeObserver = new ResizeObserver(() => {
      resizeToFit();
    });
    resizeObserver.observe(container);

    return () => {
      isMounted = false;
      resizeObserver.disconnect();
      dataDisposable.dispose();
      unlistenOutput?.();
      unlistenExit?.();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      sessionIdRef.current = null;
      if (startedSessionId) {
        void stopTerminal(startedSessionId);
      }
    };
  }, []);

  useEffect(() => {
    if (error) {
      terminalRef.current?.writeln(`\r\nTerminal error: ${error}`);
    }
  }, [error]);

  return (
    <Box
      sx={{
        bgcolor: "#0d1117",
        borderTop: "1px solid #30363d",
        color: "#f0f6fc",
        display: "flex",
        flex: `0 0 ${terminalHeight}px`,
        flexDirection: "column",
        minHeight: minTerminalHeight,
        position: "relative",
      }}
    >
      <Box
        aria-label="ターミナルの高さ"
        aria-orientation="horizontal"
        aria-valuemax={maxTerminalHeight}
        aria-valuemin={minTerminalHeight}
        aria-valuenow={terminalHeight}
        role="separator"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setTerminalHeight((height) => clampTerminalHeight(height + keyboardResizeStep));
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setTerminalHeight((height) => clampTerminalHeight(height - keyboardResizeStep));
          }
        }}
        onPointerDown={handleResizeStart}
        sx={{
          cursor: "row-resize",
          height: 8,
          left: 0,
          position: "absolute",
          right: 0,
          top: -4,
          zIndex: 1,
          "&:focus-visible": {
            outline: "2px solid #58a6ff",
            outlineOffset: -2,
          },
          "&:hover": {
            bgcolor: "rgba(88, 166, 255, 0.2)",
          },
        }}
      />
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: "center",
          borderBottom: "1px solid #30363d",
          flex: "0 0 auto",
          minHeight: 38,
          px: 1.5,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          Terminal
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: "#8b949e",
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {session ? session.shell : "Starting PTY..."}
        </Typography>
        {!session && !error && <CircularProgress color="inherit" size={16} />}
        <Tooltip title="閉じる">
          <IconButton
            aria-label="ターミナルを閉じる"
            color="inherit"
            size="small"
            onClick={onClose}
          >
            <CloseRounded fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Box
        ref={containerRef}
        aria-label="ターミナル"
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          p: 1,
          "& .xterm": {
            height: "100%",
          },
          "& .xterm-viewport": {
            backgroundColor: "#0d1117 !important",
          },
        }}
      />
    </Box>
  );
}
