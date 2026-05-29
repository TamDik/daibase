import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type ContentTree,
  type NamespaceSummary,
  type PageContent,
  type SpecialPageSummary,
  createNamespace,
  listNamespaces,
  openLocation,
  openNamespace,
  readPage,
  resolveMarkdownLink,
  writePage,
} from "../api/tauriCommands";
import { AppHeader } from "../components/AppHeader";
import { PageSurface } from "../components/PageSurface";
import {
  PagesSpecialPage,
  NamespacesSpecialPage,
  SpecialPagesIndex,
} from "../components/SpecialPages";
import { defaultPageLocation, namespacesLocation, pageLocation } from "../lib/location";

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
      kind: "specialPages";
      location: string;
      namespace: NamespaceSummary;
      pages: SpecialPageSummary[];
    }
  | {
      kind: "pages";
      location: string;
      namespace: NamespaceSummary;
      content: ContentTree;
    };

export function HomePage() {
  const [namespaces, setNamespaces] = useState<NamespaceSummary[]>([]);
  const [activeNamespace, setActiveNamespace] = useState<NamespaceSummary | null>(null);
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
      sourceNamespace = activeNamespace,
    ) => {
      if (isDirty && !window.confirm("未保存の変更を破棄して移動しますか？")) {
        return;
      }

      setError(null);
      setSavedMessage(null);
      const opened = await openLocation(rawLocation, sourceNamespace?.id ?? null);
      const nextLocation = opened.location;

      if (opened.kind === "specialNamespaces") {
        setNamespaces(opened.namespaces);
        setPageView(null);
        setSpecialView({ kind: "namespaces", location: opened.location });
        setDraft("");
        setLocationInput(opened.location);
        setIsEditing(false);
      } else if (opened.kind === "specialPages") {
        setActiveNamespace(opened.namespace);
        setPageView(null);
        setSpecialView({
          kind: "specialPages",
          location: opened.location,
          namespace: opened.namespace,
          pages: opened.pages,
        });
        setDraft("");
        setLocationInput(opened.location);
        setIsEditing(false);
      } else if (opened.kind === "specialPagesList") {
        setActiveNamespace(opened.namespace);
        setPageView(null);
        setSpecialView({
          kind: "pages",
          location: opened.location,
          namespace: opened.namespace,
          content: opened.content,
        });
        setDraft("");
        setLocationInput(opened.location);
        setIsEditing(false);
      } else {
        setActiveNamespace(opened.namespace);
        setPageView({
          kind: "page",
          namespace: opened.namespace,
          page: opened.page,
        });
        setSpecialView(null);
        setDraft(opened.page.content);
        setLocationInput(nextLocation);
        setIsEditing(false);
      }

      if (mode === "history") {
        return;
      }

      setHistory((current) => {
        const base =
          mode === "replace" ? current.slice(0, historyIndex) : current.slice(0, historyIndex + 1);
        const last = base[base.length - 1];
        const next = last === nextLocation ? base : [...base, nextLocation];
        setHistoryIndex(next.length - 1);
        return next;
      });
    },
    [activeNamespace, historyIndex, isDirty],
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
          const mainPage = await readPage(detail.namespace.id, detail.namespace.default_page);
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
      await navigate(defaultPageLocation, "push", namespace);
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
      await writePage(pageView.namespace.id, pageView.page.path, draft);
      const nextPage = await readPage(pageView.namespace.id, pageView.page.path);
      setPageView({
        kind: "page",
        namespace: pageView.namespace,
        page: nextPage,
      });
      setDraft(nextPage.content);
      setLocationInput(pageLocation(nextPage.path, pageView.namespace));
      setIsEditing(false);
      setSavedMessage("保存しました");
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
      <AppHeader
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        locationInput={locationInput}
        onGoBack={() => void handleGoBack()}
        onGoForward={() => void handleGoForward()}
        onLocationChange={setLocationInput}
        onLocationSubmit={() => void handleLocationSubmit()}
      />

      <Box component="main" sx={{ p: 3 }}>
        <Stack spacing={2}>
          {isLoading && <Alert severity="info">読み込み中</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          {page?.is_virtual && <Alert severity="info">このページはまだ作成されていません。</Alert>}

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

          {specialView?.kind === "specialPages" && (
            <SpecialPagesIndex
              location={specialView.location}
              pages={specialView.pages}
              onOpenLocation={(location) => void navigate(location)}
            />
          )}

          {specialView?.kind === "pages" && (
            <PagesSpecialPage
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
              onResolveMarkdownLink={(target) =>
                resolveMarkdownLink(pageView.namespace.id, pageView.page.path, target)
              }
              onSave={() => void handleSave()}
              onStartEditing={handleStartEditing}
            />
          )}
        </Stack>
      </Box>
      <Snackbar
        open={savedMessage !== null}
        autoHideDuration={4000}
        onClose={() => setSavedMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSavedMessage(null)}>
          {savedMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
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
