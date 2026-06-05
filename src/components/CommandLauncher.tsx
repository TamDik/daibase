import {
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
import { useEffect, useRef, useState } from "react";

import { searchContent, type SearchContentResult } from "../api/tauriCommands";

export function CommandLauncher({
  namespaceId,
  onOpenLocation,
}: {
  namespaceId: string;
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
    if (!isOpen || trimmedQuery.length === 0) {
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

  const openResult = (result: SearchContentResult) => {
    onOpenLocation(result.location);
    setIsOpen(false);
    setQuery("");
    setResults([]);
  };

  return (
    <Box sx={{ alignItems: "center", display: "flex", position: "relative" }}>
      <Tooltip title="検索">
        <IconButton aria-label="検索" size="small" onClick={() => setIsOpen((current) => !current)}>
          <SearchRounded fontSize="small" />
        </IconButton>
      </Tooltip>
      {isOpen && (
        <Box sx={{ ml: 0.5, position: "relative", width: { xs: 220, sm: 320 } }}>
          <TextField
            inputRef={inputRef}
            autoComplete="off"
            placeholder="検索"
            size="small"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setIsOpen(false);
                setQuery("");
              }
            }}
            slotProps={{
              htmlInput: {
                "aria-label": "検索またはコマンド",
              },
              input: {
                endAdornment: isSearching ? <CircularProgress size={16} /> : null,
              },
            }}
            sx={{
              bgcolor: "#ffffff",
              "& .MuiInputBase-root": {
                height: 32,
              },
            }}
          />
          {query.trim().length > 0 && (
            <Paper
              elevation={6}
              sx={{
                border: "1px solid #d0d7de",
                left: 0,
                maxHeight: 320,
                overflow: "auto",
                position: "absolute",
                right: 0,
                top: "calc(100% + 4px)",
                zIndex: 20,
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
                        primary={result.title}
                        secondary={
                          <>
                            <Typography
                              component="span"
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: "block", overflowWrap: "anywhere" }}
                            >
                              {result.path}
                            </Typography>
                            {result.snippet && (
                              <Typography
                                component="span"
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: "block", overflowWrap: "anywhere" }}
                              >
                                {result.snippet}
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
            </Paper>
          )}
        </Box>
      )}
    </Box>
  );
}
