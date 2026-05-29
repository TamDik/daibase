import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { open } from "@tauri-apps/plugin-dialog";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

const defaultPageLocation = "Page:Main";
const namespacesLocation = "Special:Namespaces";

type PageView = {
  kind: "page";
  namespace: NamespaceSummary;
  page: PageContent;
};

type SpecialView =
  | {
      kind: "namespaces";
      location: string;
    }
  | {
      kind: "allPages";
      location: string;
      namespace: NamespaceSummary;
      content: ContentTree;
    };

type ResolvedLocation =
  | {
      kind: "page";
      namespace: NamespaceSummary;
      pagePath: string;
      location: string;
    }
  | {
      kind: "specialNamespaces";
      location: string;
    }
  | {
      kind: "specialAllPages";
      namespace: NamespaceSummary;
      location: string;
    };

export function HomePage() {
  const [namespaces, setNamespaces] = useState<NamespaceSummary[]>([]);
  const [activeNamespace, setActiveNamespace] =
    useState<NamespaceSummary | null>(null);
  const [pageView, setPageView] = useState<PageView | null>(null);
  const [specialView, setSpecialView] = useState<SpecialView | null>({
    kind: "namespaces",
    location: namespacesLocation,
  });
  const [draft, setDraft] = useState("");
  const [locationInput, setLocationInput] = useState(namespacesLocation);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [namespaceName, setNamespaceName] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const page = pageView?.page ?? null;
  const isDirty = page !== null && page.content !== draft;
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex >= 0 && historyIndex < history.length - 1;

  const navigate = useCallback(
    async (
      rawLocation: string,
      mode: "push" | "replace" | "history" = "push",
      namespaceCandidates = namespaces,
      sourceNamespace = activeNamespace,
    ) => {
      if (isDirty && !window.confirm("未保存の変更を破棄して移動しますか？")) {
        return;
      }

      setError(null);
      setSavedMessage(null);
      const resolved = resolveLocation(
        rawLocation,
        namespaceCandidates,
        sourceNamespace,
      );
      const nextLocation =
        resolved.kind === "page"
          ? pageLocation(resolved.pagePath, resolved.namespace)
          : resolved.location;

      if (resolved.kind === "specialNamespaces") {
        setPageView(null);
        setSpecialView({ kind: "namespaces", location: resolved.location });
        setDraft("");
        setLocationInput(resolved.location);
        setIsEditing(false);
      } else if (resolved.kind === "specialAllPages") {
        const detail = await openNamespace(resolved.namespace.id);
        setActiveNamespace(detail.namespace);
        setPageView(null);
        setSpecialView({
          kind: "allPages",
          location: resolved.location,
          namespace: detail.namespace,
          content: detail.content,
        });
        setDraft("");
        setLocationInput(resolved.location);
        setIsEditing(false);
      } else {
        const detail = await openNamespace(resolved.namespace.id);
        const nextPage = await readPageOrVirtual(
          detail.namespace.id,
          resolved.pagePath,
        );
        setActiveNamespace(detail.namespace);
        setPageView({
          kind: "page",
          namespace: detail.namespace,
          page: nextPage,
        });
        setSpecialView(null);
        setDraft(nextPage.content);
        setLocationInput(nextLocation);
        setIsEditing(false);
      }

      if (mode === "history") {
        return;
      }

      setHistory((current) => {
        const base =
          mode === "replace"
            ? current.slice(0, historyIndex)
            : current.slice(0, historyIndex + 1);
        const last = base[base.length - 1];
        const next = last === nextLocation ? base : [...base, nextLocation];
        setHistoryIndex(next.length - 1);
        return next;
      });
    },
    [activeNamespace, historyIndex, isDirty, namespaces],
  );

  useEffect(() => {
    const loadInitialState = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await listNamespaces();
        setNamespaces(result);
        if (result.length > 0) {
          const detail = await openNamespace(result[0].id);
          const mainPage = await readPage(
            detail.namespace.id,
            detail.namespace.default_page,
          );
          const location = pageLocation(mainPage.path, detail.namespace);
          setActiveNamespace(detail.namespace);
          setPageView({
            kind: "page",
            namespace: detail.namespace,
            page: mainPage,
          });
          setSpecialView(null);
          setDraft(mainPage.content);
          setLocationInput(location);
          setHistory([location]);
          setHistoryIndex(0);
          setIsEditing(false);
        } else {
          setActiveNamespace(null);
          setPageView(null);
          setSpecialView({ kind: "namespaces", location: namespacesLocation });
          setDraft("");
          setLocationInput(namespacesLocation);
          setHistory([namespacesLocation]);
          setHistoryIndex(0);
          setIsEditing(false);
        }
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setIsLoading(false);
      }
    };

    void loadInitialState();
  }, []);

  const handleCreateNamespace = async () => {
    setError(null);
    setSavedMessage(null);
    try {
      const namespace = await createNamespace(namespaceName, rootPath);
      setNamespaceName("");
      setRootPath("");
      const nextNamespaces = await listNamespaces();
      setNamespaces(nextNamespaces);
      await navigate(defaultPageLocation, "push", nextNamespaces, namespace);
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

  const handleLocationSubmit = async () => {
    try {
      await navigate(locationInput);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const handleGoBack = async () => {
    if (!canGoBack) {
      return;
    }

    const nextIndex = historyIndex - 1;
    const nextLocation = history[nextIndex];
    try {
      await navigate(nextLocation, "history");
      setHistoryIndex(nextIndex);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const handleGoForward = async () => {
    if (!canGoForward) {
      return;
    }

    const nextIndex = historyIndex + 1;
    const nextLocation = history[nextIndex];
    try {
      await navigate(nextLocation, "history");
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
    if (!pageView) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const result = await writePage(
        pageView.namespace.id,
        pageView.page.path,
        draft,
      );
      const nextPage = await readPage(pageView.namespace.id, pageView.page.path);
      setPageView({
        kind: "page",
        namespace: pageView.namespace,
        page: nextPage,
      });
      setDraft(nextPage.content);
      setLocationInput(pageLocation(nextPage.path, pageView.namespace));
      setIsEditing(false);
      setSavedMessage(`保存しました: ${result.revision_id}`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  };

  const previewContent = useMemo(
    () => (isEditing ? draft : (page?.content ?? "")),
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
            aria-label="現在のロケーション"
            size="small"
            value={locationInput}
            onChange={(event) => setLocationInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void handleLocationSubmit();
              }
            }}
            sx={{ flex: 1 }}
          />
          <Button
            variant="outlined"
            size="small"
            onClick={() => void handleLocationSubmit()}
          >
            開く
          </Button>
        </Stack>
      </Box>

      <Box component="main" sx={{ p: 3 }}>
        <Stack spacing={2}>
          {isLoading && <Alert severity="info">読み込み中</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          {savedMessage && <Alert severity="success">{savedMessage}</Alert>}
          {page?.is_virtual && (
            <Alert severity="info">このページはまだ作成されていません。</Alert>
          )}

          {specialView?.kind === "namespaces" && (
            <NamespacesSpecialPage
              namespaceName={namespaceName}
              namespaces={namespaces}
              rootPath={rootPath}
              onCreateNamespace={handleCreateNamespace}
              onNamespaceNameChange={setNamespaceName}
              onOpenLocation={(location) => void navigate(location)}
              onRootPathSelect={() => void handleSelectRootPath()}
            />
          )}

          {specialView?.kind === "allPages" && (
            <AllPagesSpecialPage
              content={specialView.content}
              namespace={specialView.namespace}
              onOpenLocation={(location) => void navigate(location)}
            />
          )}

          {pageView && (
            <PageSurface
              currentNamespace={pageView.namespace}
              draft={draft}
              isEditing={isEditing}
              isSaving={isSaving}
              page={pageView.page}
              previewContent={previewContent}
              onCancelEditing={handleCancelEditing}
              onDraftChange={setDraft}
              onOpenLocation={(location) => void navigate(location)}
              onSave={() => void handleSave()}
              onStartEditing={handleStartEditing}
            />
          )}
        </Stack>
      </Box>
    </Box>
  );
}

function NamespacesSpecialPage({
  namespaces,
  namespaceName,
  rootPath,
  onCreateNamespace,
  onNamespaceNameChange,
  onOpenLocation,
  onRootPathSelect,
}: {
  namespaces: NamespaceSummary[];
  namespaceName: string;
  rootPath: string;
  onCreateNamespace: () => void;
  onNamespaceNameChange: (value: string) => void;
  onOpenLocation: (location: string) => void;
  onRootPathSelect: () => void;
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, bgcolor: "#ffffff" }}>
      <Box sx={{ borderBottom: "1px solid #d0d7de", px: 2, py: 1.5 }}>
        <Typography variant="h5" component="h2">
          Namespaces
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Special:Namespaces
        </Typography>
      </Box>
      <Stack spacing={3} sx={{ p: 3 }}>
        <Box>
          {namespaces.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              まだ作成されていません。
            </Typography>
          ) : (
            <List dense disablePadding>
              {namespaces.map((namespace) => (
                <ListItemButton
                  key={namespace.id}
                  onClick={() => onOpenLocation(`${namespace.name}:Page:Main`)}
                  sx={{ borderRadius: 1 }}
                >
                  <ListItemText
                    primary={namespace.name}
                    secondary={`${namespace.name}:Special:AllPages`}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>

        <Divider />

        <Stack spacing={1.5} sx={{ maxWidth: 560 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            新規作成
          </Typography>
          <TextField
            label="名前"
            size="small"
            value={namespaceName}
            onChange={(event) => onNamespaceNameChange(event.target.value)}
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
            <Button variant="outlined" onClick={onRootPathSelect}>
              選択
            </Button>
          </Stack>
          <Button
            variant="contained"
            onClick={onCreateNamespace}
            disabled={!namespaceName.trim() || !rootPath.trim()}
          >
            作成
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

function AllPagesSpecialPage({
  namespace,
  content,
  onOpenLocation,
}: {
  namespace: NamespaceSummary;
  content: ContentTree;
  onOpenLocation: (location: string) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, bgcolor: "#ffffff" }}>
      <Box sx={{ borderBottom: "1px solid #d0d7de", px: 2, py: 1.5 }}>
        <Typography variant="h5" component="h2">
          All Pages
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {namespace.name}:Special:AllPages
        </Typography>
      </Box>
      <Box sx={{ p: 3 }}>
        {content.pages.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            ページはまだありません。
          </Typography>
        ) : (
          <List dense disablePadding>
            {content.pages.map((item) => (
              <ListItemButton
                key={item.path}
                onClick={() => onOpenLocation(pageLocation(item.path, namespace))}
                sx={{ borderRadius: 1 }}
              >
                <ListItemText
                  primary={pageTitle(item.path)}
                  secondary={pageLocation(item.path, namespace)}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Paper>
  );
}

function PageSurface({
  currentNamespace,
  draft,
  isEditing,
  isSaving,
  page,
  previewContent,
  onCancelEditing,
  onDraftChange,
  onOpenLocation,
  onSave,
  onStartEditing,
}: {
  currentNamespace: NamespaceSummary;
  draft: string;
  isEditing: boolean;
  isSaving: boolean;
  page: PageContent;
  previewContent: string;
  onCancelEditing: () => void;
  onDraftChange: (value: string) => void;
  onOpenLocation: (location: string) => void;
  onSave: () => void;
  onStartEditing: () => void;
}) {
  return (
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
            {pageLocation(page.path, currentNamespace)}
          </Typography>
        </Box>
        {isEditing ? (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={onCancelEditing} disabled={isSaving}>
              キャンセル
            </Button>
            <Button variant="contained" onClick={onSave} disabled={isSaving}>
              {isSaving ? "保存中" : "保存"}
            </Button>
          </Stack>
        ) : (
          <Button variant="contained" onClick={onStartEditing}>
            編集
          </Button>
        )}
      </Box>

      <Box sx={{ p: 3 }}>
        {isEditing ? (
          <TextField
            label="Markdown"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
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
          <MarkdownPreview
            currentNamespace={currentNamespace}
            currentPath={page.path}
            markdown={previewContent}
            onOpenLocation={onOpenLocation}
          />
        )}
      </Box>
    </Paper>
  );
}

function resolveLocation(
  rawLocation: string,
  namespaces: NamespaceSummary[],
  sourceNamespace: NamespaceSummary | null,
): ResolvedLocation {
  const location = rawLocation.trim();
  if (location === "Special:Namespaces") {
    return {
      kind: "specialNamespaces",
      location: namespacesLocation,
    };
  }

  const parts = location.split(":");
  if (parts.length < 2) {
    return {
      kind: "page",
      namespace: requireNamespace(sourceNamespace),
      pagePath: normalizePagePath(location),
      location: pageLocationFromName(location, requireNamespace(sourceNamespace)),
    };
  }

  const first = parts[0];
  const second = parts[1];
  const hasNamespace = first !== "Page" && first !== "Special";
  const namespace = hasNamespace
    ? findNamespaceByName(namespaces, first)
    : sourceNamespace;
  const kind = hasNamespace ? second : first;
  const name = parts.slice(hasNamespace ? 2 : 1).join(":");

  if (kind === "Special" && name === "Namespaces") {
    return {
      kind: "specialNamespaces",
      location: namespacesLocation,
    };
  }

  if (kind === "Special" && name === "AllPages") {
    const resolvedNamespace = requireNamespace(namespace);
    return {
      kind: "specialAllPages",
      namespace: resolvedNamespace,
      location: `${resolvedNamespace.name}:Special:AllPages`,
    };
  }

  if (kind === "Page") {
    const resolvedNamespace = requireNamespace(namespace);
    return {
      kind: "page",
      namespace: resolvedNamespace,
      pagePath: normalizePagePath(name),
      location: pageLocationFromName(name, resolvedNamespace),
    };
  }

  throw new Error(`未対応のロケーションです: ${location}`);
}

function normalizePagePath(pageName: string) {
  const withoutPrefix = pageName.startsWith("Page:")
    ? pageName.slice("Page:".length)
    : pageName;
  const withoutExtension = withoutPrefix.trim().replace(/\.md$/, "");
  return `Pages/${withoutExtension}.md`;
}

function pageLocation(path: string, namespace: NamespaceSummary) {
  const name = path.replace(/^Pages\//, "").replace(/\.md$/, "");
  return pageLocationFromName(name, namespace);
}

function pageLocationFromName(
  pageName: string,
  namespace: NamespaceSummary,
) {
  const normalizedName = pageName.replace(/^Pages\//, "").replace(/\.md$/, "");
  return `${namespace.name}:Page:${normalizedName}`;
}

function pageTitle(path: string) {
  const parts = path
    .replace(/^Pages\//, "")
    .replace(/\.md$/, "")
    .split("/");
  return parts[parts.length - 1] ?? path;
}

async function readPageOrVirtual(namespaceId: string, path: string) {
  try {
    return await readPage(namespaceId, path);
  } catch (caught) {
    if (!isMissingPageError(caught)) {
      throw caught;
    }

    return {
      namespace_id: namespaceId,
      file_id: "",
      path,
      content: "",
      latest_revision_id: null,
      is_virtual: true,
    } satisfies PageContent;
  }
}

function MarkdownPreview({
  currentNamespace,
  currentPath,
  markdown,
  onOpenLocation,
}: {
  currentNamespace: NamespaceSummary;
  currentPath: string;
  markdown: string;
  onOpenLocation: (location: string) => void;
}) {
  return (
    <Box
      sx={{
        "& > :first-of-type": { mt: 0 },
        "& > :last-child": { mb: 0 },
        "& table": {
          borderCollapse: "collapse",
          width: "100%",
        },
        "& th, & td": {
          border: "1px solid #d0d7de",
          p: 1,
        },
        "& code": {
          bgcolor: "#f6f8fa",
          borderRadius: 0.5,
          px: 0.5,
        },
        "& pre": {
          bgcolor: "#f6f8fa",
          borderRadius: 1,
          overflow: "auto",
          p: 2,
        },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            const linkTarget = href ?? "";
            const isExternal = /^https?:\/\//.test(linkTarget);
            return (
              <Link
                href={isExternal ? linkTarget : "#"}
                onClick={(event) => {
                  if (isExternal) {
                    return;
                  }

                  event.preventDefault();
                  onOpenLocation(
                    resolveMarkdownLink(
                      currentNamespace,
                      currentPath,
                      linkTarget,
                    ),
                  );
                }}
              >
                {children}
              </Link>
            );
          },
          h1({ children }) {
            return (
              <Typography variant="h4" component="h1" sx={{ mt: 3, mb: 1.5 }}>
                {children}
              </Typography>
            );
          },
          h2({ children }) {
            return (
              <Typography variant="h5" component="h2" sx={{ mt: 2.5, mb: 1 }}>
                {children}
              </Typography>
            );
          },
          h3({ children }) {
            return (
              <Typography variant="h6" component="h3" sx={{ mt: 2, mb: 1 }}>
                {children}
              </Typography>
            );
          },
          p({ children }) {
            return (
              <Typography variant="body1" sx={{ mb: 1.5 }}>
                {children}
              </Typography>
            );
          },
          li({ children }) {
            return (
              <Typography component="li" variant="body1" sx={{ mb: 0.5 }}>
                {children}
              </Typography>
            );
          },
          img({ alt }) {
            return (
              <Typography variant="body2" color="text.secondary">
                {alt}
              </Typography>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </Box>
  );
}

function resolveMarkdownLink(
  currentNamespace: NamespaceSummary,
  currentPath: string,
  target: string,
) {
  const [pathWithoutFragment] = target.split("#");
  const pathWithoutQuery = pathWithoutFragment.split("?")[0];
  const parts = pathWithoutQuery.split(":");

  if (
    parts.length >= 2 &&
    (parts[0] === "Page" || parts[0] === "Special" || parts[1] === "Page" || parts[1] === "Special")
  ) {
    return pathWithoutQuery;
  }

  const currentParts = currentPath
    .replace(/^Pages\//, "")
    .replace(/\.md$/, "")
    .split("/");
  currentParts.pop();
  const resolvedParts = [...currentParts, pathWithoutQuery].flatMap((part) =>
    part.split("/"),
  );
  const normalizedParts: string[] = [];

  for (const part of resolvedParts) {
    if (part === "" || part === ".") {
      continue;
    }

    if (part === "..") {
      normalizedParts.pop();
      continue;
    }

    normalizedParts.push(part);
  }

  return pageLocationFromName(normalizedParts.join("/"), currentNamespace);
}

function requireNamespace(namespace: NamespaceSummary | null) {
  if (!namespace) {
    throw new Error("ネームスペースを選択してください。");
  }

  return namespace;
}

function findNamespaceByName(namespaces: NamespaceSummary[], name: string) {
  const namespace = namespaces.find((item) => item.name === name);
  if (!namespace) {
    throw new Error(`ネームスペースが見つかりません: ${name}`);
  }

  return namespace;
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

function isMissingPageError(error: unknown) {
  return errorMessage(error).includes("ページが見つかりません");
}
