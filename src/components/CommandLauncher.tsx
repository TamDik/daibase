import {
  Backdrop,
  Box,
  CircularProgress,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ArticleOutlined,
  AutoAwesomeOutlined,
  BoltOutlined,
  InsertDriveFileOutlined,
  QuestionMark,
  SearchRounded,
} from "@mui/icons-material";
import { type ComponentType, type ReactNode, useEffect, useRef, useState } from "react";

import { searchContent, type SearchContentResult } from "../api/tauriCommands";
import { searchCommands, type AppCommand } from "../lib/commandRegistry";

export function CommandLauncher({
  namespaceId,
  openRequestId = 0,
  commands,
  onExecuteCommand,
  onOpenLocation,
}: {
  namespaceId: string | null;
  openRequestId?: number;
  commands: AppCommand[];
  onExecuteCommand: (commandId: string) => void;
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
  const previousOpenRequestId = useRef(openRequestId);
  const commandMode = query.startsWith(">");
  const commandQuery = commandMode ? query.slice(1).trimStart() : "";
  const commandResults = commandMode ? searchCommands(commands, commandQuery) : [];
  const selectableCount = commandMode ? commandResults.length : results.length;

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!isOpen || !namespaceId || trimmedQuery.length === 0 || trimmedQuery.startsWith(">")) {
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

  useEffect(() => {
    if (openRequestId !== previousOpenRequestId.current && namespaceId) {
      previousOpenRequestId.current = openRequestId;
      openLauncher();
    }
  }, [namespaceId, openRequestId]);

  const openResult = (result: SearchContentResult) => {
    onOpenLocation(result.location);
    closeLauncher();
  };

  const executeCommand = (command: AppCommand) => {
    onExecuteCommand(command.id);
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
                placeholder={commandMode ? "コマンド" : "検索"}
                size="medium"
                value={commandMode ? commandQuery : query}
                onChange={(event) => {
                  setQuery(commandMode ? `>${event.target.value}` : event.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    closeLauncher();
                  } else if (
                    event.key === "Backspace" &&
                    commandMode &&
                    commandQuery.length === 0
                  ) {
                    event.preventDefault();
                    setQuery("");
                  } else if (event.key === "Tab" && commandResults[selectedIndex]) {
                    event.preventDefault();
                    setQuery(`>${commandResults[selectedIndex].name}`);
                  } else if (event.key === "ArrowDown" && selectableCount > 0) {
                    event.preventDefault();
                    setSelectedIndex((current) => (current + 1) % selectableCount);
                  } else if (event.key === "ArrowUp" && selectableCount > 0) {
                    event.preventDefault();
                    setSelectedIndex(
                      (current) => (current - 1 + selectableCount) % selectableCount,
                    );
                  } else if (
                    event.key === "Enter" &&
                    commandMode &&
                    commandResults[selectedIndex]
                  ) {
                    event.preventDefault();
                    executeCommand(commandResults[selectedIndex]);
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
                    startAdornment: commandMode ? (
                      <InputAdornment position="start">
                        <BoltOutlined aria-label="コマンドモード" color="primary" />
                      </InputAdornment>
                    ) : null,
                    endAdornment:
                      commandMode && commandResults.length > 0 ? (
                        <InputAdornment aria-label="コマンド候補件数" position="end">
                          <Typography color="text.secondary" variant="body2" noWrap>
                            {commandResults.length}件
                          </Typography>
                        </InputAdornment>
                      ) : isSearching ? (
                        <CircularProgress size={18} />
                      ) : !commandMode && results.length > 0 ? (
                        <InputAdornment aria-label="検索結果件数" position="end">
                          <Typography color="text.secondary" variant="body2" noWrap>
                            {results.length}件
                          </Typography>
                        </InputAdornment>
                      ) : null,
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
                data-testid="search-results-panel"
                sx={{
                  borderTop: "1px solid #d0d7de",
                  bgcolor: "#f6f8fa",
                  display: "flex",
                  flexDirection: "column",
                  maxHeight: "min(640px, calc(100vh - 140px))",
                  overflow: "hidden",
                }}
              >
                {commandMode ? (
                  commandResults.length > 0 ? (
                    <>
                      <Box
                        data-testid="command-results-scroll"
                        sx={{ minHeight: 0, overflowY: "auto" }}
                      >
                        <List disablePadding aria-label="コマンド候補" sx={{ px: 0.75, pt: 0.75 }}>
                          {commandResults.map((command, index) => (
                            <CommandResultItem
                              command={command}
                              commandRef={(element) => {
                                resultRefs.current[index] = element;
                              }}
                              key={command.id}
                              selected={index === selectedIndex}
                              onMouseEnter={() => setSelectedIndex(index)}
                              onExecute={() => executeCommand(command)}
                            />
                          ))}
                        </List>
                      </Box>
                      <ResultFooter enterLabel="実行" showTab />
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 1.25 }}>
                      コマンドが見つかりません
                    </Typography>
                  )
                ) : error ? (
                  <Typography color="error" variant="body2" sx={{ p: 1.25 }}>
                    {error}
                  </Typography>
                ) : results.length > 0 ? (
                  <>
                    <Box
                      data-testid="search-results-scroll"
                      sx={{ minHeight: 0, overflowY: "auto" }}
                    >
                      <List disablePadding aria-label="検索結果" sx={{ px: 0.75, pt: 0.75 }}>
                        {results.map((result, index) => (
                          <SearchResultItem
                            resultRef={(element) => {
                              resultRefs.current[index] = element;
                            }}
                            key={`${result.content_kind}:${result.location}`}
                            result={result}
                            query={query.trim()}
                            selected={index === selectedIndex}
                            onMouseEnter={() => setSelectedIndex(index)}
                            onOpen={() => openResult(result)}
                          />
                        ))}
                      </List>
                    </Box>
                    <ResultFooter enterLabel="開く" />
                  </>
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

function CommandResultItem({
  command,
  commandRef,
  selected,
  onMouseEnter,
  onExecute,
}: {
  command: AppCommand;
  commandRef: (element: HTMLDivElement | null) => void;
  selected: boolean;
  onMouseEnter: () => void;
  onExecute: () => void;
}) {
  return (
    <ListItemButton
      ref={commandRef}
      aria-selected={selected}
      selected={selected}
      onMouseEnter={onMouseEnter}
      onClick={onExecute}
      sx={{ borderRadius: 2, gap: 1.25, mb: 0.5, px: 1.25, py: 1 }}
    >
      <BoltOutlined color="primary" fontSize="small" />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {command.name}
        </Typography>
        <Typography color="text.secondary" variant="caption">
          {command.description} · {command.id}
        </Typography>
      </Box>
    </ListItemButton>
  );
}

function ResultFooter({ enterLabel, showTab = false }: { enterLabel: string; showTab?: boolean }) {
  return (
    <Box
      data-testid="search-results-footer"
      sx={{
        alignItems: "center",
        bgcolor: "#f6f8fa",
        borderTop: "1px solid #d8dee4",
        color: "text.secondary",
        display: "flex",
        flex: "0 0 auto",
        gap: 2,
        px: 1.5,
        py: 0.75,
      }}
    >
      <KeyboardHint keys="↑↓" label="移動" />
      {showTab && <KeyboardHint keys="Tab" label="補完" />}
      <KeyboardHint keys="Enter" label={enterLabel} />
      <KeyboardHint keys="Esc" label="閉じる" />
    </Box>
  );
}

function SearchResultItem({
  resultRef,
  result,
  query,
  selected,
  onMouseEnter,
  onOpen,
}: {
  resultRef: (element: HTMLDivElement | null) => void;
  result: SearchContentResult;
  query: string;
  selected: boolean;
  onMouseEnter: () => void;
  onOpen: () => void;
}) {
  const visual = searchResultVisual(result);
  const ResultIcon = visual.icon;

  return (
    <ListItemButton
      ref={resultRef}
      aria-selected={selected}
      selected={selected}
      onMouseEnter={onMouseEnter}
      onClick={onOpen}
      sx={{
        alignItems: "flex-start",
        border: "1px solid transparent",
        borderRadius: 2,
        gap: 1.25,
        mb: 0.5,
        px: 1.25,
        py: 1.1,
        transition: "background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
        "&:hover": {
          bgcolor: "#ffffff",
          borderColor: "#d8dee4",
        },
        "&.Mui-selected": {
          bgcolor: "#eef5ff",
          borderColor: "#b6d4fe",
          boxShadow: "inset 3px 0 0 #1f6feb",
        },
        "&.Mui-selected:hover": {
          bgcolor: "#e7f1ff",
        },
      }}
    >
      <Box
        aria-label={visual.label}
        role="img"
        sx={{
          alignItems: "center",
          bgcolor: visual.background,
          borderRadius: 2,
          color: visual.color,
          display: "flex",
          flex: "0 0 auto",
          height: 38,
          justifyContent: "center",
          mt: 0.1,
          width: 38,
        }}
      >
        <ResultIcon fontSize="small" />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ alignItems: "center", display: "flex", gap: 0.75, minWidth: 0 }}>
          <Typography
            component="div"
            variant="body2"
            sx={{ fontSize: 15, fontWeight: 700, minWidth: 0, overflowWrap: "anywhere" }}
          >
            <HighlightedText text={result.title} matchIndices={result.title_match_indices} />
          </Typography>
          <Box
            component="span"
            sx={{
              bgcolor: visual.background,
              borderRadius: 10,
              color: visual.color,
              flex: "0 0 auto",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.2,
              lineHeight: 1,
              px: 0.75,
              py: 0.45,
            }}
          >
            {visual.label}
          </Box>
        </Box>
        <Typography
          component="div"
          variant="caption"
          color="text.secondary"
          sx={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            mt: 0.3,
            overflowWrap: "anywhere",
          }}
        >
          <HighlightedText text={result.path} matchIndices={result.path_match_indices} />
        </Typography>
        {result.snippet && (
          <Box
            sx={{
              alignItems: "flex-start",
              bgcolor: selected ? "rgba(255, 255, 255, 0.72)" : "#ffffff",
              border: "1px solid #d8dee4",
              borderRadius: 1.5,
              color: "text.secondary",
              display: "flex",
              gap: 0.65,
              mt: 0.8,
              px: 0.85,
              py: 0.65,
            }}
          >
            <SearchRounded sx={{ color: "#57606a", flex: "0 0 auto", fontSize: 15, mt: 0.1 }} />
            <Typography component="div" variant="caption" sx={{ overflowWrap: "anywhere" }}>
              <HighlightedText text={result.snippet} query={query} />
            </Typography>
          </Box>
        )}
      </Box>
    </ListItemButton>
  );
}

function KeyboardHint({ keys, label }: { keys: string; label: string }) {
  return (
    <Box sx={{ alignItems: "center", display: "flex", gap: 0.5 }}>
      <Box
        component="kbd"
        sx={{
          bgcolor: "#ffffff",
          border: "1px solid #d0d7de",
          borderBottomColor: "#afb8c1",
          borderRadius: 1,
          boxShadow: "0 1px 0 rgba(27, 31, 36, 0.08)",
          color: "#24292f",
          fontFamily: "inherit",
          fontSize: 10,
          lineHeight: 1,
          px: 0.55,
          py: 0.4,
        }}
      >
        {keys}
      </Box>
      <Typography variant="caption">{label}</Typography>
    </Box>
  );
}

function searchResultVisual(result: SearchContentResult): {
  label: string;
  color: string;
  background: string;
  icon: ComponentType<{ fontSize?: "small" }>;
} {
  if (result.content_kind === "page") {
    return {
      label: "ページ",
      color: "#8250df",
      background: "#f3e8ff",
      icon: ArticleOutlined,
    };
  }
  if (result.content_kind === "special" && result.location.startsWith("Special:Help/")) {
    return {
      label: "ヘルプ",
      color: "#1a7f37",
      background: "#dafbe1",
      icon: QuestionMark,
    };
  }
  if (result.content_kind === "special") {
    return {
      label: "Special",
      color: "#9a6700",
      background: "#fff8c5",
      icon: AutoAwesomeOutlined,
    };
  }
  return {
    label: "ファイル",
    color: "#0969da",
    background: "#ddf4ff",
    icon: InsertDriveFileOutlined,
  };
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
