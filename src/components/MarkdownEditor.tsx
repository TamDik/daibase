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

  const syncScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    const highlight = highlightRef.current;
    if (!highlight) {
      return;
    }
    highlight.scrollTop = event.currentTarget.scrollTop;
    highlight.scrollLeft = event.currentTarget.scrollLeft;
  };

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: disabled ? "action.disabledBackground" : "divider",
        borderRadius: 1,
        minHeight: 480,
        position: "relative",
        "&:focus-within": {
          borderColor: "primary.main",
          boxShadow: (theme) => `0 0 0 1px ${theme.palette.primary.main}`,
        },
      }}
    >
      <Box
        ref={highlightRef}
        aria-hidden
        data-testid="markdown-editor-highlights"
        sx={{
          bottom: 0,
          color: "text.primary",
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
          fontSize: 16,
          left: 0,
          lineHeight: 1.6,
          overflow: "hidden",
          p: 1.5,
          pointerEvents: "none",
          position: "absolute",
          right: 0,
          top: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {highlightMarkdownSearchMatches(value, searchMatches, activeSearchMatch)}
      </Box>
      <Box
        component="textarea"
        aria-label={ariaLabel}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={syncScroll}
        sx={{
          bgcolor: "transparent",
          border: 0,
          boxSizing: "border-box",
          caretColor: "text.primary",
          color: "transparent",
          display: "block",
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
          fontSize: 16,
          height: "100%",
          lineHeight: 1.6,
          minHeight: 480,
          outline: 0,
          overflow: "auto",
          p: 1.5,
          position: "relative",
          resize: "vertical",
          width: "100%",
          wordBreak: "break-word",
          "&::selection": {
            bgcolor: "rgba(9, 105, 218, 0.28)",
          },
          "&:disabled": {
            cursor: "not-allowed",
            opacity: 0.72,
          },
        }}
      />
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
