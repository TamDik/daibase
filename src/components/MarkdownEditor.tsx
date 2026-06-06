import { Box } from "@mui/material";
import { useEffect, useMemo, useRef, type RefObject } from "react";

import type { PageSearchMatch } from "../lib/pageSearch";
import { getScrollIntoViewPosition } from "../lib/scrollIntoView";

export function MarkdownEditor({
  activeSearchMatch,
  ariaLabel,
  disabled,
  searchMatches,
  value,
  onChange,
}: {
  activeSearchMatch: PageSearchMatch | null;
  ariaLabel: string;
  disabled: boolean;
  searchMatches: PageSearchMatch[];
  value: string;
  onChange: (value: string) => void;
}) {
  const activeMarkRef = useRef<HTMLElement | null>(null);
  const scrollBoxRef = useRef<HTMLDivElement | null>(null);
  const lineCount = Math.max(1, value.split("\n").length);
  const lineHeightPx = 22;
  const editorWidth = useMemo(() => {
    const longestLineLength = value
      .split("\n")
      .reduce((maxLength, line) => Math.max(maxLength, Array.from(line).length), 1);
    return `max(100%, ${longestLineLength + 4}ch)`;
  }, [value]);

  useEffect(() => {
    const scrollBox = scrollBoxRef.current;
    const activeMark = activeMarkRef.current;
    if (!scrollBox || !activeSearchMatch || !activeMark) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      activeMark.scrollIntoView?.({
        block: "nearest",
        inline: "nearest",
      });

      const nextPosition = getScrollIntoViewPosition({
        containerRect: scrollBox.getBoundingClientRect(),
        scrollLeft: scrollBox.scrollLeft,
        scrollTop: scrollBox.scrollTop,
        targetRect: activeMark.getBoundingClientRect(),
      });

      if (nextPosition.top === scrollBox.scrollTop && nextPosition.left === scrollBox.scrollLeft) {
        return;
      }

      scrollBox.scrollTo(nextPosition);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [activeSearchMatch]);

  const textLayerSx = {
    boxSizing: "border-box",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    fontSize: 16,
    fontVariantLigatures: "none",
    letterSpacing: 0,
    lineHeight: `${lineHeightPx}px`,
    overflowWrap: "normal",
    px: 1.5,
    py: 1.25,
    tabSize: 4,
    whiteSpace: "pre",
    wordBreak: "normal",
  } as const;

  return (
    <Box
      sx={{
        bgcolor: "#ffffff",
        color: "text.primary",
        overflow: "hidden",
      }}
    >
      <Box
        ref={scrollBoxRef}
        sx={{
          display: "flex",
          minHeight: 480,
          overflow: "auto",
          scrollbarColor: "#d0d7de #ffffff",
          scrollbarGutter: "stable",
        }}
      >
        <Box
          aria-hidden
          data-testid="markdown-editor-line-numbers"
          sx={{
            bgcolor: "#ffffff",
            color: "text.secondary",
            flex: "0 0 54px",
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            fontSize: 13,
            lineHeight: `${lineHeightPx}px`,
            overflow: "hidden",
            position: "sticky",
            left: 0,
            py: 1.25,
            textAlign: "right",
            userSelect: "none",
            zIndex: 2,
          }}
        >
          {Array.from({ length: lineCount }, (_, index) => (
            <Box key={index + 1} sx={{ height: lineHeightPx, pr: 1.25 }}>
              {index + 1}
            </Box>
          ))}
        </Box>
        <Box
          sx={{
            display: "grid",
            flex: "1 1 auto",
            minWidth: editorWidth,
            position: "relative",
          }}
        >
          <Box
            aria-hidden
            data-testid="markdown-editor-highlights"
            sx={{
              ...textLayerSx,
              color: "transparent",
              gridArea: "1 / 1",
              minHeight: 480,
              overflow: "hidden",
              pointerEvents: "none",
              "& mark": {
                color: "transparent",
              },
            }}
          >
            {highlightMarkdownSearchMatches(value, searchMatches, activeSearchMatch, activeMarkRef)}
          </Box>
          <Box
            component="textarea"
            aria-label={ariaLabel}
            disabled={disabled}
            rows={lineCount}
            value={value}
            wrap="off"
            onChange={(event) => onChange(event.target.value)}
            sx={{
              ...textLayerSx,
              bgcolor: "transparent",
              border: 0,
              color: "text.primary",
              display: "block",
              gridArea: "1 / 1",
              height: "auto",
              m: 0,
              minHeight: 480,
              outline: 0,
              overflow: "hidden",
              position: "relative",
              resize: "none",
              width: "100%",
              "&::selection": {
                backgroundColor: "rgba(9, 105, 218, 0.28)",
              },
              "&:disabled": {
                cursor: "not-allowed",
                opacity: 0.72,
              },
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}

function highlightMarkdownSearchMatches(
  value: string,
  searchMatches: PageSearchMatch[],
  activeSearchMatch: PageSearchMatch | null,
  activeMarkRef: RefObject<HTMLElement | null>,
) {
  if (searchMatches.length === 0) {
    return value;
  }

  const nodes = [];
  let cursor = 0;

  for (const match of searchMatches) {
    if (match.start > cursor) {
      nodes.push(value.slice(cursor, match.start));
    }

    const isActive =
      activeSearchMatch?.start === match.start && activeSearchMatch.end === match.end;
    nodes.push(
      <Box
        key={`${match.start}-${match.end}`}
        component="mark"
        data-active-search-match={isActive ? "true" : undefined}
        ref={isActive ? activeMarkRef : undefined}
        sx={{
          bgcolor: isActive ? "#ffd33d" : "#fff0a6",
          borderRadius: 0.5,
          color: "inherit",
          outline: isActive ? "1px solid #d29922" : "none",
          scrollMarginBlock: "72px 24px",
          scrollMarginInline: "24px",
        }}
      >
        {value.slice(match.start, match.end)}
      </Box>,
    );
    cursor = match.end;
  }

  if (cursor < value.length) {
    nodes.push(value.slice(cursor));
  }

  return nodes;
}
