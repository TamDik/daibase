import { Alert, Box, Snackbar, Stack } from "@mui/material";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import {
  type ContentTree,
  type FileHistoryEntry,
  type ManagedFileContent,
  type NamespaceSummary,
  type OpenLocationResult,
  type PageContent,
  type SpecialPageSummary,
  createNamespace,
  listFileHistory,
  listPageHistory,
  listNamespaces,
  openInitialLocation,
  openLocation,
  resolveMarkdownImage,
  resolveMarkdownLinkStatus,
  savePage,
  uploadFile,
  writeFileNote,
} from "../api/tauriCommands";
import { AppHeader } from "../components/AppHeader";
import { FileSurface, type FileMode } from "../components/FileSurface";
import { PageSidebar } from "../components/PageSidebar";
import { PageSurface, type PageMode } from "../components/PageSurface";
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

type FileView = {
  kind: "file";
  namespace: NamespaceSummary;
  file: ManagedFileContent;
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
  const routerNavigate = useNavigate();
  const [namespaces, setNamespaces] = useState<NamespaceSummary[]>([]);
  const [activeNamespace, setActiveNamespace] = useState<NamespaceSummary | null>(null);
  const [sidebarContent, setSidebarContent] = useState<ContentTree | null>(null);
  const [pageView, setPageView] = useState<PageView | null>(null);
  const [fileView, setFileView] = useState<FileView | null>(null);
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
  const [pageMode, setPageMode] = useState<PageMode>("view");
  const [fileMode, setFileMode] = useState<FileMode>("detail");
  const [fileNoteDraft, setFileNoteDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [isFileNoteSaving, setIsFileNoteSaving] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<FileHistoryEntry[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedHistoryRevisionId, setSelectedHistoryRevisionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const pageViewRef = useRef<PageView | null>(null);
  const draftRef = useRef("");
  const isSavingRef = useRef(false);

  const page = pageView?.page ?? null;
  const isDirty = page !== null && page.content !== draft;
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex >= 0 && historyIndex < history.length - 1;

  useEffect(() => {
    pageViewRef.current = pageView;
  }, [pageView]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  const applyOpenedLocation = useCallback((opened: OpenLocationResult) => {
    const nextLocation = opened.location;

    if (opened.kind === "specialNamespaces") {
      setNamespaces(opened.namespaces);
      setActiveNamespace(null);
      setSidebarContent(null);
      setPageView(null);
      setFileView(null);
      setSpecialView({ kind: "namespaces", location: opened.location });
      setDraft("");
      setLocationInput(opened.location);
      setPageMode("view");
      return nextLocation;
    }

    if (opened.kind === "specialPages") {
      setActiveNamespace(opened.namespace);
      setSidebarContent(opened.content);
      setPageView(null);
      setFileView(null);
      setSpecialView({
        kind: "specialPages",
        location: opened.location,
        namespace: opened.namespace,
        pages: opened.pages,
      });
      setDraft("");
      setLocationInput(opened.location);
      setPageMode("view");
      return nextLocation;
    }

    if (opened.kind === "specialPagesList") {
      setActiveNamespace(opened.namespace);
      setSidebarContent(opened.content);
      setPageView(null);
      setFileView(null);
      setSpecialView({
        kind: "pages",
        location: opened.location,
        namespace: opened.namespace,
        content: opened.content,
      });
      setDraft("");
      setLocationInput(opened.location);
      setPageMode("view");
      return nextLocation;
    }

    if (opened.kind === "file") {
      setActiveNamespace(opened.namespace);
      setSidebarContent(opened.content);
      setPageView(null);
      setFileView({
        kind: "file",
        namespace: opened.namespace,
        file: opened.file,
      });
      setSpecialView(null);
      setDraft("");
      setFileNoteDraft(opened.file.note);
      setLocationInput(nextLocation);
      setFileMode("detail");
      setHistoryEntries([]);
      setHistoryError(null);
      setSelectedHistoryRevisionId(null);
      return nextLocation;
    }

    setActiveNamespace(opened.namespace);
    setSidebarContent(opened.content);
    setPageView({
      kind: "page",
      namespace: opened.namespace,
      page: opened.page,
    });
    setFileView(null);
    setSpecialView(null);
    setDraft(opened.page.content);
    setLocationInput(nextLocation);
    setPageMode("view");
    setHistoryEntries([]);
    setHistoryError(null);
    setSelectedHistoryRevisionId(null);
    return nextLocation;
  }, []);

  const saveCurrentDraft = useCallback(
    async ({ showMessage = false }: { showMessage?: boolean } = {}) => {
      const currentPageView = pageViewRef.current;
      const nextContent = draftRef.current;

      if (!currentPageView || currentPageView.page.content === nextContent) {
        return true;
      }

      if (isSavingRef.current) {
        return false;
      }

      isSavingRef.current = true;
      setIsSaving(true);
      setError(null);
      if (showMessage) {
        setSavedMessage(null);
      }

      try {
        const saved = await savePage(
          currentPageView.namespace.id,
          currentPageView.page.path,
          nextContent,
        );
        setPageView({
          kind: "page",
          namespace: saved.namespace,
          page: saved.page,
        });
        pageViewRef.current = {
          kind: "page",
          namespace: saved.namespace,
          page: saved.page,
        };
        setActiveNamespace(saved.namespace);
        setSidebarContent(saved.content);
        setDraft(saved.page.content);
        draftRef.current = saved.page.content;
        setLocationInput(saved.location);
        if (showMessage) {
          setSavedMessage("保存しました");
        }
        if (pageMode === "history") {
          const entries = await listPageHistory(saved.namespace.id, saved.page.path);
          setHistoryEntries(entries);
          setSelectedHistoryRevisionId(null);
        }
        return true;
      } catch (caught) {
        setError(errorMessage(caught));
        return false;
      } finally {
        isSavingRef.current = false;
        setIsSaving(false);
      }
    },
    [pageMode],
  );

  const navigate = useCallback(
    async (
      rawLocation: string,
      mode: "push" | "replace" | "history" = "push",
      sourceNamespace = activeNamespace,
    ) => {
      if (!(await saveCurrentDraft())) {
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
    [activeNamespace, applyOpenedLocation, historyIndex, saveCurrentDraft],
  );

  useEffect(() => {
    if (!isDirty || pageMode !== "view") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveCurrentDraft();
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [draft, isDirty, pageMode, saveCurrentDraft]);

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

  const handleModeChange = async (mode: PageMode) => {
    if (!pageView) {
      return;
    }

    if (mode === "view") {
      setPageMode("view");
      return;
    }

    if (!(await saveCurrentDraft())) {
      return;
    }

    setPageMode("history");
    setHistoryError(null);
    if (historyEntries.length > 0) {
      return;
    }

    setIsHistoryLoading(true);
    try {
      const entries = await listPageHistory(pageView.namespace.id, pageView.page.path);
      setHistoryEntries(entries);
    } catch (caught) {
      setHistoryError(errorMessage(caught));
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleFileModeChange = async (mode: FileMode) => {
    if (!fileView) {
      return;
    }

    if (mode === "detail") {
      setFileMode("detail");
      return;
    }

    setFileMode("history");
    setHistoryError(null);
    if (historyEntries.length > 0) {
      return;
    }

    setIsHistoryLoading(true);
    try {
      const entries = await listFileHistory(fileView.namespace.id, fileView.file.path);
      setHistoryEntries(entries);
    } catch (caught) {
      setHistoryError(errorMessage(caught));
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleUploadFile = async () => {
    if (!fileView) {
      return;
    }

    setError(null);
    try {
      const selected = await open({
        multiple: false,
        title: fileView.file.is_virtual
          ? "アップロードするファイルを選択"
          : "置き換えるファイルを選択",
      });
      if (typeof selected !== "string") {
        return;
      }

      setIsFileUploading(true);
      const saved = await uploadFile(fileView.namespace.id, fileView.file.path, selected);
      setFileView({
        kind: "file",
        namespace: saved.namespace,
        file: saved.file,
      });
      setActiveNamespace(saved.namespace);
      setSidebarContent(saved.content);
      setFileNoteDraft(saved.file.note);
      setLocationInput(saved.location);
      setSavedMessage("保存しました");
      if (fileMode === "history") {
        const entries = await listFileHistory(saved.namespace.id, saved.file.path);
        setHistoryEntries(entries);
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsFileUploading(false);
    }
  };

  const handleSaveFileNote = async () => {
    if (!fileView) {
      return;
    }

    setError(null);
    setIsFileNoteSaving(true);
    try {
      const file = await writeFileNote(fileView.namespace.id, fileView.file.path, fileNoteDraft);
      setFileView({
        kind: "file",
        namespace: fileView.namespace,
        file,
      });
      setFileNoteDraft(file.note);
      setSavedMessage("保存しました");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsFileNoteSaving(false);
    }
  };

  const handleSelectHistoryEntry = (entry: FileHistoryEntry) => {
    if (!pageView && !fileView) {
      return;
    }

    setSelectedHistoryRevisionId(entry.revision_id);
    const namespaceId = pageView?.namespace.id ?? fileView?.namespace.id;
    const path = pageView?.page.path ?? fileView?.file.path;
    if (!namespaceId || !path) {
      return;
    }
    routerNavigate(
      `/history?namespaceId=${encodeURIComponent(namespaceId)}&path=${encodeURIComponent(path)}&revisionId=${encodeURIComponent(entry.revision_id)}`,
    );
  };

  const handleResolvePageMarkdownLinkStatus = useCallback(
    (target: string) => {
      if (!pageView) {
        return Promise.resolve({ location: target, exists: false, is_internal: false });
      }

      return resolveMarkdownLinkStatus(pageView.namespace.id, pageView.page.path, target);
    },
    [pageView],
  );

  const handleOpenPageMarkdownLink = useCallback(
    async (target: string) => {
      if (!pageView) {
        return;
      }

      try {
        const status = await resolveMarkdownLinkStatus(
          pageView.namespace.id,
          pageView.page.path,
          target,
        );
        if (!status.is_internal) {
          return;
        }
        await navigate(status.location);
      } catch (caught) {
        setError(errorMessage(caught));
      }
    },
    [navigate, pageView],
  );

  const handleResolvePageMarkdownImage = useCallback(
    (target: string) => {
      if (!pageView) {
        return Promise.resolve({
          content_type: null,
          data_url: null,
          exists: false,
          is_image: false,
          is_internal: false,
          location: target,
        });
      }

      return resolveMarkdownImage(pageView.namespace.id, pageView.page.path, target);
    },
    [pageView],
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
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
          alignItems: "stretch",
          display: "flex",
          flexGrow: 1,
          minHeight: 0,
          overflow: "hidden",
          p: 0,
        }}
      >
        <PageSidebar
          content={sidebarContent}
          currentLocation={locationInput}
          namespace={activeNamespace}
          onOpenLocation={(location) => void navigate(location)}
        />

        <Box
          sx={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            minHeight: 0,
            minWidth: 0,
            overflow: "auto",
          }}
        >
          <Stack spacing={2} sx={{ flexGrow: 1 }}>
            {isLoading && <Alert severity="info">読み込み中</Alert>}
            {error && <Alert severity="error">{error}</Alert>}

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
                editorKey={`${pageView.namespace.id}:${pageView.page.path}`}
                historyEntries={historyEntries}
                historyError={historyError}
                isHistoryLoading={isHistoryLoading}
                isSaving={isSaving}
                isVirtual={pageView.page.is_virtual ?? false}
                mode={pageMode}
                onDraftChange={setDraft}
                onModeChange={(mode) => void handleModeChange(mode)}
                onOpenMarkdownLink={(target) => void handleOpenPageMarkdownLink(target)}
                onResolveMarkdownImage={handleResolvePageMarkdownImage}
                onResolveMarkdownLinkStatus={handleResolvePageMarkdownLinkStatus}
                onSelectHistoryEntry={handleSelectHistoryEntry}
                selectedHistoryRevisionId={selectedHistoryRevisionId}
              />
            )}

            {fileView && (
              <FileSurface
                file={fileView.file}
                historyEntries={historyEntries}
                historyError={historyError}
                isHistoryLoading={isHistoryLoading}
                isNoteSaving={isFileNoteSaving}
                isUploading={isFileUploading}
                mode={fileMode}
                noteDraft={fileNoteDraft}
                onModeChange={(mode) => void handleFileModeChange(mode)}
                onNoteChange={setFileNoteDraft}
                onSaveNote={() => void handleSaveFileNote()}
                onSelectHistoryEntry={handleSelectHistoryEntry}
                onUpload={() => void handleUploadFile()}
                selectedHistoryRevisionId={selectedHistoryRevisionId}
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
