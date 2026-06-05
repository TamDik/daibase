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
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
    setIsSearching(true);
    setError(null);
    searchContent(namespaceId, trimmedQuery)
      .then((nextResults) => {
        if (isActive) {
          setResults(nextResults);
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

    return () => {
      isActive = false;
    };
  }, [isOpen, namespaceId, query]);

  const resetSearch = () => {
    setQuery("");
    setResults([]);
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
  const highlightQuery = query.trim();

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
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    closeLauncher();
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
                    {results.map((result) => (
                      <ListItemButton
                        key={`${result.content_kind}:${result.location}`}
                        onClick={() => openResult(result)}
                      >
                        <ListItemText
                          primary={<HighlightedText text={result.title} query={highlightQuery} />}
                          secondary={
                            <>
                              <Typography
                                component="span"
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: "block", overflowWrap: "anywhere" }}
                              >
                                <HighlightedText text={result.path} query={highlightQuery} />
                              </Typography>
                              {result.snippet && (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: "block", overflowWrap: "anywhere" }}
                                >
                                  <HighlightedText text={result.snippet} query={highlightQuery} />
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

function HighlightedText({ text, query }: { text: string; query: string }) {
  return <>{highlightText(text, query)}</>;
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
      <Box
        key={`${matchIndex}-${matchEnd}`}
        component="mark"
        sx={{
          bgcolor: "#fff0a6",
          borderRadius: 0.75,
          color: "inherit",
          px: 0.25,
        }}
      >
        {text.slice(matchIndex, matchEnd)}
      </Box>,
    );
    cursor = matchEnd;
    matchIndex = normalizedText.indexOf(normalizedQuery, cursor);
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes.length > 0 ? nodes : [text];
}
