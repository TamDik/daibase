import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type ContentTree,
  type NamespaceSummary,
  type OpenLocationResult,
  type PageContent,
  type SpecialPageSummary,
  createNamespace,
  listNamespaces,
  openInitialLocation,
  openLocation,
  resolveMarkdownLink,
  savePage,
} from "../api/tauriCommands";
import { AppHeader } from "../components/AppHeader";
import { PageSidebar } from "../components/PageSidebar";
import { PageSurface } from "../components/PageSurface";
import {
  PagesSpecialPage,
  NamespacesSpecialPage,
  SpecialPagesIndex,
} from "../components/SpecialPages";
import { defaultPageLocation, namespacesLocation } from "../lib/location";

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
  const [sidebarContent, setSidebarContent] = useState<ContentTree | null>(null);
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
  const existingPageLocations = useMemo(
    () => new Set(sidebarContent?.pages.map((item) => item.location) ?? []),
    [sidebarContent],
  );

  const applyOpenedLocation = useCallback((opened: OpenLocationResult) => {
    const nextLocation = opened.location;

    if (opened.kind === "specialNamespaces") {
      setNamespaces(opened.namespaces);
      setActiveNamespace(null);
      setSidebarContent(null);
      setPageView(null);
      setSpecialView({ kind: "namespaces", location: opened.location });
      setDraft("");
      setLocationInput(opened.location);
      setIsEditing(false);
      return nextLocation;
    }

    if (opened.kind === "specialPages") {
      setActiveNamespace(opened.namespace);
      setSidebarContent(opened.content);
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
      return nextLocation;
    }

    if (opened.kind === "specialPagesList") {
      setActiveNamespace(opened.namespace);
      setSidebarContent(opened.content);
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
      return nextLocation;
    }

    setActiveNamespace(opened.namespace);
    setSidebarContent(opened.content);
    setPageView({
      kind: "page",
      namespace: opened.namespace,
      page: opened.page,
    });
    setSpecialView(null);
    setDraft(opened.page.content);
    setLocationInput(nextLocation);
    setIsEditing(false);
    return nextLocation;
  }, []);

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
      const nextLocation = applyOpenedLocation(opened);

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
    [activeNamespace, applyOpenedLocation, historyIndex, isDirty],
  );

  useEffect(() => {
    const loadInitialState = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const opened = await openInitialLocation();
        const location = applyOpenedLocation(opened);
        setHistory([location]);
        setHistoryIndex(0);
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setIsLoading(false);
      }
    };

    void loadInitialState();
  }, [applyOpenedLocation]);

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
      const saved = await savePage(pageView.namespace.id, pageView.page.path, draft);
      setPageView({
        kind: "page",
        namespace: saved.namespace,
        page: saved.page,
      });
      setActiveNamespace(saved.namespace);
      setSidebarContent(saved.content);
      setDraft(saved.page.content);
      setLocationInput(saved.location);
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
  const handleResolvePageMarkdownLink = useCallback(
    (target: string) => {
      if (!pageView) {
        return Promise.resolve(target);
      }

      return resolveMarkdownLink(pageView.namespace.id, pageView.page.path, target);
    },
    [pageView],
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

      <Box
        component="main"
        sx={{
          alignItems: "flex-start",
          display: "flex",
          p: 0,
        }}
      >
        <PageSidebar
          content={sidebarContent}
          currentLocation={locationInput}
          namespace={activeNamespace}
          onOpenLocation={(location) => void navigate(location)}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
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
                draft={draft}
                existingPageLocations={existingPageLocations}
                isEditing={isEditing}
                isSaving={isSaving}
                previewContent={previewContent}
                onCancelEditing={handleCancelEditing}
                onDraftChange={setDraft}
                onOpenLocation={(location) => void navigate(location)}
                onResolveMarkdownLink={handleResolvePageMarkdownLink}
                onSave={() => void handleSave()}
                onStartEditing={handleStartEditing}
              />
            )}
          </Stack>
        </Box>
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
