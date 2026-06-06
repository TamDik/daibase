import { Box } from "@mui/material";
import { useRef, type UIEvent } from "react";

import type { PageSearchMatch } from "../lib/pageSearch";

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
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const lineNumberRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineCount = Math.max(1, value.split("\n").length);
  const lineHeightPx = 22;

  const syncScroll = (event: UIEvent<HTMLDivElement>) => {
    const scrollTop = event.currentTarget.scrollTop;
    const scrollLeft = event.currentTarget.scrollLeft;
    const highlight = highlightRef.current;
    if (highlight) {
      highlight.scrollTop = scrollTop;
      highlight.scrollLeft = scrollLeft;
    }

    const lineNumber = lineNumberRef.current;
    if (lineNumber) {
      lineNumber.scrollTop = scrollTop;
    }

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.scrollLeft = scrollLeft;
    }
  };
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
        onScroll={syncScroll}
        sx={{
          display: "flex",
          minHeight: 480,
          overflow: "auto",
          scrollbarColor: "#d0d7de #ffffff",
          scrollbarGutter: "stable",
        }}
      >
        <Box
          ref={lineNumberRef}
          aria-hidden
          data-testid="markdown-editor-line-numbers"
          sx={{
            color: "text.secondary",
            flex: "0 0 54px",
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            fontSize: 13,
            lineHeight: `${lineHeightPx}px`,
            overflow: "hidden",
            py: 1.25,
            textAlign: "right",
            userSelect: "none",
          }}
        >
          {Array.from({ length: lineCount }, (_, index) => (
            <Box key={index + 1} sx={{ height: lineHeightPx, pr: 1.25 }}>
              {index + 1}
            </Box>
          ))}
        </Box>
        <Box sx={{ flex: "1 1 auto", minWidth: 0, position: "relative" }}>
          <Box
            ref={highlightRef}
            aria-hidden
            data-testid="markdown-editor-highlights"
            sx={{
              ...textLayerSx,
              bottom: 0,
              color: "transparent",
              left: 0,
              minHeight: 480,
              minWidth: "max-content",
              overflow: "hidden",
              pointerEvents: "none",
              position: "absolute",
              right: 0,
              top: 0,
              "& mark": {
                color: "transparent",
              },
            }}
          >
            {highlightMarkdownSearchMatches(value, searchMatches, activeSearchMatch)}
          </Box>
          <Box
            component="textarea"
            ref={textareaRef}
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
              height: "auto",
              m: 0,
              minHeight: 480,
              minWidth: "max-content",
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
        sx={{
          bgcolor: isActive ? "#ffd33d" : "#fff0a6",
          borderRadius: 0.5,
          color: "inherit",
          outline: isActive ? "1px solid #d29922" : "none",
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
