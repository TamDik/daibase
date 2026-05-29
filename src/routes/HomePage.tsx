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

const defaultPagePath = "Pages/Main.md";

export function HomePage() {
  const [namespaces, setNamespaces] = useState<NamespaceSummary[]>([]);
  const [activeNamespace, setActiveNamespace] =
    useState<NamespaceSummary | null>(null);
  const [contentTree, setContentTree] = useState<ContentTree>({ pages: [] });
  const [page, setPage] = useState<PageContent | null>(null);
  const [draft, setDraft] = useState("");
  const [namespaceName, setNamespaceName] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const isDirty = page !== null && page.content !== draft;

  const loadNamespace = useCallback(async (namespaceId: string) => {
    setError(null);
    setSavedMessage(null);
    const detail = await openNamespace(namespaceId);
    setActiveNamespace(detail.namespace);
    setContentTree(detail.content);
    const mainPage = await readPage(namespaceId, detail.namespace.default_page);
    setPage(mainPage);
    setDraft(mainPage.content);
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

    setError(null);
    setSavedMessage(null);
    try {
      const nextPage = await readPage(activeNamespace.id, path);
      setPage(nextPage);
      setDraft(nextPage.content);
    } catch (caught) {
      setError(errorMessage(caught));
    }
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
      setSavedMessage(`保存しました: ${result.revision_id}`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  };

  const preview = useMemo(() => renderPreview(draft), [draft]);

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
          px: 3,
          py: 2,
        }}
      >
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          Daibase
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "320px 1fr" },
          minHeight: "calc(100vh - 65px)",
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
                          secondary={item.path}
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
              <Stack spacing={2}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    flexWrap: "wrap",
                  }}
                >
                  <Box>
                    <Typography variant="h5" component="h2">
                      {pageTitle(page.path)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {page.path}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    onClick={() => void handleSave()}
                    disabled={isSaving}
                  >
                    {isSaving ? "保存中" : isDirty ? "保存" : "リビジョン作成"}
                  </Button>
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
                    gap: 2,
                  }}
                >
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
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      minHeight: 520,
                      bgcolor: "#ffffff",
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{ mb: 2 }}
                    >
                      プレビュー
                    </Typography>
                    <Stack spacing={1.5}>{preview}</Stack>
                  </Paper>
                </Box>
              </Stack>
            )}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
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
