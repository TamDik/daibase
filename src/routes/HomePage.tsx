import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { open } from "@tauri-apps/plugin-dialog";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type ContentTree,
  type NamespaceSummary,
  type PageContent,
  createNamespace,
  listNamespaces,
  openNamespace,
  readPage,
  writePage,
} from "../api/tauriCommands";

const defaultPagePath = "Pages/Main";

export function HomePage() {
  const [namespaces, setNamespaces] = useState<NamespaceSummary[]>([]);
  const [activeNamespace, setActiveNamespace] =
    useState<NamespaceSummary | null>(null);
  const [contentTree, setContentTree] = useState<ContentTree>({ pages: [] });
  const [page, setPage] = useState<PageContent | null>(null);
  const [draft, setDraft] = useState("");
  const [locationInput, setLocationInput] = useState(defaultPagePath);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [namespaceName, setNamespaceName] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const isDirty = page !== null && page.content !== draft;
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex >= 0 && historyIndex < history.length - 1;

  const openPage = useCallback(
    async (
      namespaceId: string,
      path: string,
      mode: "push" | "replace" | "history" = "push",
    ) => {
      if (isDirty && !window.confirm("未保存の変更を破棄して移動しますか？")) {
        return;
      }

      setError(null);
      setSavedMessage(null);
      const nextPage = await readPage(namespaceId, normalizePagePath(path));
      setPage(nextPage);
      setDraft(nextPage.content);
      setLocationInput(displayPagePath(nextPage.path));
      setIsEditing(false);

      if (mode === "history") {
        return;
      }

      setHistory((current) => {
        const base =
          mode === "replace" ? current.slice(0, historyIndex) : current.slice(0, historyIndex + 1);
        const last = base[base.length - 1];
        const next = last === nextPage.path ? base : [...base, nextPage.path];
        setHistoryIndex(next.length - 1);
        return next;
      });
    },
    [historyIndex, isDirty],
  );

  const loadNamespace = useCallback(async (namespaceId: string) => {
    setError(null);
    setSavedMessage(null);
    const detail = await openNamespace(namespaceId);
    const mainPage = await readPage(namespaceId, detail.namespace.default_page);

    setActiveNamespace(detail.namespace);
    setContentTree(detail.content);
    setPage(mainPage);
    setDraft(mainPage.content);
    setLocationInput(displayPagePath(mainPage.path));
    setHistory([mainPage.path]);
    setHistoryIndex(0);
    setIsEditing(false);
  }, []);

  const loadNamespaces = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listNamespaces();
      setNamespaces(result);
      if (result.length > 0) {
        await loadNamespace(result[0].id);
      } else {
        setActiveNamespace(null);
        setContentTree({ pages: [] });
        setPage(null);
        setDraft("");
      setLocationInput(defaultPagePath);
        setHistory([]);
        setHistoryIndex(-1);
        setIsEditing(false);
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }, [loadNamespace]);

  useEffect(() => {
    void loadNamespaces();
  }, [loadNamespaces]);

  const handleCreateNamespace = async () => {
    setError(null);
    setSavedMessage(null);
    try {
      const namespace = await createNamespace(namespaceName, rootPath);
      setNamespaceName("");
      setRootPath("");
      const nextNamespaces = await listNamespaces();
      setNamespaces(nextNamespaces);
      await loadNamespace(namespace.id);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const handleSelectRootPath = async () => {
    setError(null);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "ネームスペースの保存先を選択",
      });

      if (typeof selected === "string") {
        setRootPath(selected);
      }
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const handleOpenNamespace = async (namespaceId: string) => {
    try {
      await loadNamespace(namespaceId);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const handleOpenPage = async (path: string) => {
    if (!activeNamespace) {
      return;
    }

    try {
      await openPage(activeNamespace.id, path);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const handleLocationSubmit = async () => {
    if (!activeNamespace) {
      return;
    }

    try {
      await openPage(activeNamespace.id, locationInput);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const handleGoBack = async () => {
    if (!activeNamespace || !canGoBack) {
      return;
    }

    const nextIndex = historyIndex - 1;
    const nextPath = history[nextIndex];
    try {
      await openPage(activeNamespace.id, nextPath, "history");
      setHistoryIndex(nextIndex);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const handleGoForward = async () => {
    if (!activeNamespace || !canGoForward) {
      return;
    }

    const nextIndex = historyIndex + 1;
    const nextPath = history[nextIndex];
    try {
      await openPage(activeNamespace.id, nextPath, "history");
      setHistoryIndex(nextIndex);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const handleStartEditing = () => {
    setDraft(page?.content ?? "");
    setSavedMessage(null);
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    if (isDirty && !window.confirm("未保存の変更を破棄しますか？")) {
      return;
    }

    setDraft(page?.content ?? "");
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!activeNamespace || !page) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const result = await writePage(activeNamespace.id, page.path, draft);
      const nextPage = await readPage(activeNamespace.id, page.path);
      setPage(nextPage);
      setDraft(nextPage.content);
      setLocationInput(displayPagePath(nextPage.path));
      setIsEditing(false);
      setSavedMessage(`保存しました: ${result.revision_id}`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  };

  const preview = useMemo(
    () => renderPreview(isEditing ? draft : (page?.content ?? "")),
    [draft, isEditing, page?.content],
  );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f6f8fa",
        color: "#1f2328",
      }}
    >
      <Box
        component="header"
        sx={{
          borderBottom: "1px solid #d0d7de",
          bgcolor: "#ffffff",
          px: 2,
          py: 1.25,
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Typography variant="h6" component="h1" sx={{ fontWeight: 700 }}>
            Daibase
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={() => void handleGoBack()}
            disabled={!canGoBack}
            sx={{ minWidth: 40 }}
          >
            &lt;
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => void handleGoForward()}
            disabled={!canGoForward}
            sx={{ minWidth: 40 }}
          >
            &gt;
          </Button>
          <TextField
            aria-label="現在のページパス"
            size="small"
            value={locationInput}
            onChange={(event) => setLocationInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void handleLocationSubmit();
              }
            }}
            disabled={!activeNamespace}
            sx={{ flex: 1 }}
          />
          <Button
            variant="outlined"
            size="small"
            onClick={() => void handleLocationSubmit()}
            disabled={!activeNamespace}
          >
            開く
          </Button>
        </Stack>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "320px 1fr" },
          minHeight: "calc(100vh - 57px)",
        }}
      >
        <Box
          component="aside"
          sx={{
            borderRight: { md: "1px solid #d0d7de" },
            bgcolor: "#ffffff",
            p: 2,
          }}
        >
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                ネームスペース
              </Typography>
              {isLoading ? (
                <Typography variant="body2" color="text.secondary">
                  読み込み中
                </Typography>
              ) : namespaces.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  まだ作成されていません。
                </Typography>
              ) : (
                <List dense disablePadding>
                  {namespaces.map((namespace) => (
                    <ListItemButton
                      key={namespace.id}
                      selected={namespace.id === activeNamespace?.id}
                      onClick={() => void handleOpenNamespace(namespace.id)}
                      sx={{ borderRadius: 1 }}
                    >
                      <ListItemText
                        primary={namespace.name}
                        secondary={
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            noWrap
                          >
                            {namespace.root_path}
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Box>

            <Divider />

            <Stack spacing={1.5}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                新規作成
              </Typography>
              <TextField
                label="名前"
                size="small"
                value={namespaceName}
                onChange={(event) => setNamespaceName(event.target.value)}
              />
              <Stack direction="row" spacing={1}>
                <TextField
                  label="保存先フォルダ"
                  size="small"
                  value={rootPath}
                  placeholder="未選択"
                  slotProps={{
                    input: {
                      readOnly: true,
                    },
                  }}
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="outlined"
                  onClick={() => void handleSelectRootPath()}
                >
                  選択
                </Button>
              </Stack>
              <Button
                variant="contained"
                onClick={() => void handleCreateNamespace()}
                disabled={!namespaceName.trim() || !rootPath.trim()}
              >
                作成
              </Button>
            </Stack>

            {activeNamespace && (
              <>
                <Divider />
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 1, fontWeight: 700 }}
                  >
                    ページ
                  </Typography>
                  <List dense disablePadding>
                    {contentTree.pages.map((item) => (
                      <ListItemButton
                        key={item.path}
                        selected={item.path === page?.path}
                        onClick={() => void handleOpenPage(item.path)}
                        sx={{ borderRadius: 1 }}
                      >
                        <ListItemText
                          primary={pageTitle(item.path)}
                          secondary={displayPagePath(item.path)}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Box>
              </>
            )}
          </Stack>
        </Box>

        <Box component="main" sx={{ p: 3 }}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            {savedMessage && <Alert severity="success">{savedMessage}</Alert>}

            {!activeNamespace || !page ? (
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 1 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  ネームスペースを作成してください
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  最初のページは {defaultPagePath} として作成されます。
                </Typography>
              </Paper>
            ) : (
              <Paper
                variant="outlined"
                sx={{ borderRadius: 1, bgcolor: "#ffffff", overflow: "hidden" }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    flexWrap: "wrap",
                    borderBottom: "1px solid #d0d7de",
                    px: 2,
                    py: 1.5,
                  }}
                >
                  <Box>
                    <Typography variant="h5" component="h2">
                      {pageTitle(page.path)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {displayPagePath(page.path)}
                    </Typography>
                  </Box>
                  {isEditing ? (
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        onClick={handleCancelEditing}
                        disabled={isSaving}
                      >
                        キャンセル
                      </Button>
                      <Button
                        variant="contained"
                        onClick={() => void handleSave()}
                        disabled={isSaving}
                      >
                        {isSaving ? "保存中" : "保存"}
                      </Button>
                    </Stack>
                  ) : (
                    <Button variant="contained" onClick={handleStartEditing}>
                      編集
                    </Button>
                  )}
                </Box>

                <Box sx={{ p: 3 }}>
                  {isEditing ? (
                    <TextField
                      label="Markdown"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      multiline
                      minRows={24}
                      fullWidth
                      sx={{
                        "& textarea": {
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                          lineHeight: 1.6,
                        },
                      }}
                    />
                  ) : (
                    <Stack spacing={1.5}>{preview}</Stack>
                  )}
                </Box>
              </Paper>
            )}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

function normalizePagePath(path: string) {
  const trimmed = path.trim();
  const withPagesPrefix = trimmed.startsWith("Pages/")
    ? trimmed
    : `Pages/${trimmed}`;

  if (withPagesPrefix.endsWith(".md")) {
    return withPagesPrefix;
  }

  return `${withPagesPrefix}.md`;
}

function displayPagePath(path: string) {
  return path.replace(/\.md$/, "");
}

function pageTitle(path: string) {
  const parts = path
    .replace(/^Pages\//, "")
    .replace(/\.md$/, "")
    .split("/");
  return parts[parts.length - 1] ?? path;
}

function renderPreview(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  return lines.map((line, index) => {
    const key = `${index}-${line}`;

    if (line.startsWith("# ")) {
      return (
        <Typography key={key} variant="h4" component="h1">
          {line.slice(2)}
        </Typography>
      );
    }

    if (line.startsWith("## ")) {
      return (
        <Typography key={key} variant="h5" component="h2">
          {line.slice(3)}
        </Typography>
      );
    }

    if (line.startsWith("### ")) {
      return (
        <Typography key={key} variant="h6" component="h3">
          {line.slice(4)}
        </Typography>
      );
    }

    if (line.trim() === "") {
      return <Box key={key} sx={{ height: 8 }} />;
    }

    return (
      <Typography key={key} variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
        {line}
      </Typography>
    );
  });
}

function errorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "エラーが発生しました。";
}
