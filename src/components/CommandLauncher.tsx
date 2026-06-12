import {
  Backdrop,
  Box,
  CircularProgress,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { SearchRounded } from "@mui/icons-material";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { searchContent, type SearchContentResult } from "../api/tauriCommands";

export function CommandLauncher({
  namespaceId,
  onOpenLocation,
}: {
  namespaceId: string | null;
  onOpenLocation: (location: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchContentResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!isOpen || !namespaceId || trimmedQuery.length === 0) {
      setResults([]);
      setIsSearching(false);
      setError(null);
      return;
    }

    let isActive = true;
    setError(null);
    const timeoutId = window.setTimeout(() => {
      setIsSearching(true);
      searchContent(namespaceId, trimmedQuery)
        .then((nextResults) => {
          if (isActive) {
            setResults(nextResults);
            setSelectedIndex(0);
          }
        })
        .catch((searchError) => {
          if (isActive) {
            setResults([]);
            setError(searchError instanceof Error ? searchError.message : String(searchError));
          }
        })
        .finally(() => {
          if (isActive) {
            setIsSearching(false);
          }
        });
    }, 80);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [isOpen, namespaceId, query]);

  const resetSearch = () => {
    setQuery("");
    setResults([]);
    setSelectedIndex(0);
    setError(null);
    setIsSearching(false);
  };

  const openLauncher = () => {
    resetSearch();
    setIsOpen(true);
  };

  const closeLauncher = () => {
    resetSearch();
    setIsOpen(false);
  };

  const openResult = (result: SearchContentResult) => {
    onOpenLocation(result.location);
    closeLauncher();
  };

  useEffect(() => {
    resultRefs.current[selectedIndex]?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <Box sx={{ alignItems: "center", display: "flex" }}>
      <Tooltip title="全体検索">
        <span>
          <IconButton
            aria-label="全体検索"
            disabled={!namespaceId}
            size="small"
            onClick={() => {
              if (isOpen) {
                closeLauncher();
                return;
              }
              openLauncher();
            }}
          >
            <SearchRounded fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      {isOpen && (
        <Backdrop
          open
          invisible
          sx={{ alignItems: "flex-start", zIndex: (theme) => theme.zIndex.modal }}
          onClick={closeLauncher}
        >
          <Paper
            role="dialog"
            aria-label="検索パネル"
            elevation={12}
            onClick={(event) => event.stopPropagation()}
            sx={{
              border: "1px solid #d0d7de",
              borderRadius: 3,
              mt: { xs: 7, sm: 9 },
              overflow: "hidden",
              width: "min(720px, calc(100vw - 32px))",
            }}
          >
            <Box sx={{ p: 1 }}>
              <TextField
                inputRef={inputRef}
                autoComplete="off"
                fullWidth
                placeholder="検索"
                size="medium"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    closeLauncher();
                  } else if (event.key === "ArrowDown" && results.length > 0) {
                    event.preventDefault();
                    setSelectedIndex((current) => (current + 1) % results.length);
                  } else if (event.key === "ArrowUp" && results.length > 0) {
                    event.preventDefault();
                    setSelectedIndex((current) => (current - 1 + results.length) % results.length);
                  } else if (event.key === "Enter" && results[selectedIndex]) {
                    event.preventDefault();
                    openResult(results[selectedIndex]);
                  }
                }}
                slotProps={{
                  htmlInput: {
                    "aria-label": "検索またはコマンド",
                  },
                  input: {
                    endAdornment: isSearching ? <CircularProgress size={18} /> : null,
                  },
                }}
                sx={{
                  bgcolor: "#ffffff",
                  "& .MuiInputBase-root": {
                    borderRadius: 2.5,
                    fontSize: 18,
                    gap: 1,
                    minHeight: 52,
                  },
                  "& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline": {
                    border: 0,
                  },
                  "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
                    border: 0,
                  },
                  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    border: 0,
                  },
                }}
              />
            </Box>
            {query.trim().length > 0 && (
              <Box
                sx={{
                  borderTop: "1px solid #d0d7de",
                  maxHeight: "min(480px, calc(100vh - 180px))",
                  overflow: "auto",
                }}
              >
                {error ? (
                  <Typography color="error" variant="body2" sx={{ p: 1.25 }}>
                    {error}
                  </Typography>
                ) : results.length > 0 ? (
                  <List dense disablePadding aria-label="検索結果">
                    {results.map((result, index) => (
                      <ListItemButton
                        ref={(element) => {
                          resultRefs.current[index] = element;
                        }}
                        key={`${result.content_kind}:${result.location}`}
                        aria-selected={index === selectedIndex}
                        selected={index === selectedIndex}
                        onMouseEnter={() => setSelectedIndex(index)}
                        onClick={() => openResult(result)}
                      >
                        <ListItemText
                          primary={
                            <HighlightedText
                              text={result.title}
                              matchIndices={result.title_match_indices}
                            />
                          }
                          secondary={
                            <>
                              <Typography
                                component="span"
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: "block", overflowWrap: "anywhere" }}
                              >
                                <HighlightedText
                                  text={result.path}
                                  matchIndices={result.path_match_indices}
                                />
                              </Typography>
                              {result.snippet && (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: "block", overflowWrap: "anywhere" }}
                                >
                                  <HighlightedText text={result.snippet} query={query.trim()} />
                                </Typography>
                              )}
                            </>
                          }
                        />
                      </ListItemButton>
                    ))}
                  </List>
                ) : isSearching ? (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 1.25 }}>
                    検索中
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 1.25 }}>
                    見つかりません
                  </Typography>
                )}
              </Box>
            )}
          </Paper>
        </Backdrop>
      )}
    </Box>
  );
}

function HighlightedText({
  text,
  query = "",
  matchIndices = [],
}: {
  text: string;
  query?: string;
  matchIndices?: number[];
}) {
  return (
    <>
      {matchIndices.length > 0
        ? highlightMatchIndices(text, matchIndices)
        : highlightText(text, query)}
    </>
  );
}

export function highlightMatchIndices(text: string, matchIndices: number[]): ReactNode[] {
  const characters = Array.from(text);
  const matched = new Set(matchIndices);
  const nodes: ReactNode[] = [];
  let cursor = 0;

  while (cursor < characters.length) {
    const isMatched = matched.has(cursor);
    let end = cursor + 1;
    while (end < characters.length && matched.has(end) === isMatched) {
      end += 1;
    }

    const value = characters.slice(cursor, end).join("");
    nodes.push(isMatched ? <SearchMark key={`${cursor}-${end}`}>{value}</SearchMark> : value);
    cursor = end;
  }

  return nodes;
}

export function highlightText(text: string, query: string): ReactNode[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return [text];
  }

  const normalizedText = text.toLowerCase();
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = normalizedText.indexOf(normalizedQuery);

  while (matchIndex >= 0) {
    if (matchIndex > cursor) {
      nodes.push(text.slice(cursor, matchIndex));
    }

    const matchEnd = matchIndex + normalizedQuery.length;
    nodes.push(
      <SearchMark key={`${matchIndex}-${matchEnd}`}>{text.slice(matchIndex, matchEnd)}</SearchMark>,
    );
    cursor = matchEnd;
    matchIndex = normalizedText.indexOf(normalizedQuery, cursor);
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes.length > 0 ? nodes : [text];
}

function SearchMark({ children }: { children: ReactNode }) {
  return (
    <Box
      component="mark"
      sx={{
        bgcolor: "#fff0a6",
        borderRadius: 0.75,
        color: "inherit",
        px: 0.25,
      }}
    >
      {children}
    </Box>
  );
}
