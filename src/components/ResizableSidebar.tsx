import Box from "@mui/material/Box";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const defaultSidebarWidth = 280;
const minSidebarWidth = 220;
const maxSidebarWidth = 520;
const keyboardResizeStep = 16;

export function ResizableSidebar({ children }: { children: ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(defaultSidebarWidth);
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  const clampSidebarWidth = useCallback((width: number) => {
    return Math.min(maxSidebarWidth, Math.max(minSidebarWidth, Math.round(width)));
  }, []);

  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragState.current = {
      startX: event.clientX,
      startWidth: sidebarWidth,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handleResizeMove = (event: PointerEvent) => {
      if (!dragState.current) {
        return;
      }

      const nextWidth = dragState.current.startWidth + event.clientX - dragState.current.startX;
      setSidebarWidth(clampSidebarWidth(nextWidth));
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
  }, [clampSidebarWidth]);

  return (
    <Box
      component="aside"
      sx={{
        alignSelf: "stretch",
        bgcolor: "#ffffff",
        borderRight: "1px solid #d0d7de",
        flex: `0 0 ${sidebarWidth}px`,
        minWidth: 0,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {children}
      <Box
        aria-label="サイドバーの幅"
        aria-orientation="vertical"
        aria-valuemax={maxSidebarWidth}
        aria-valuemin={minSidebarWidth}
        aria-valuenow={sidebarWidth}
        role="separator"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            setSidebarWidth((width) => clampSidebarWidth(width - keyboardResizeStep));
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            setSidebarWidth((width) => clampSidebarWidth(width + keyboardResizeStep));
          }
        }}
        onPointerDown={handleResizeStart}
        sx={{
          bottom: 0,
          cursor: "col-resize",
          position: "absolute",
          right: -4,
          top: 0,
          width: 8,
          zIndex: 1,
          "&:focus-visible": {
            outline: "2px solid #0969da",
            outlineOffset: -2,
          },
          "&:hover": {
            bgcolor: "rgba(9, 105, 218, 0.12)",
          },
        }}
      />
    </Box>
  );
}
