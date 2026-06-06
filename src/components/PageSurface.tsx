import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Article,
  ArrowBackRounded,
  CloseRounded,
  Code,
  FindInPageRounded,
  HistoryRounded,
  KeyboardArrowDownRounded,
  KeyboardArrowUpRounded,
} from "@mui/icons-material";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  BacklinkSummary,
  FileHistoryEntry,
  InstalledPluginSummary,
  PageHistorySnapshot,
} from "../api/tauriCommands";
import { resolvePluginMain } from "../api/tauriCommands";
import {
  categoriesFromMarkdown,
  markdownBodyFromMarkdown,
  updateMarkdownBodyPreservingFrontmatter,
} from "../lib/pageCategories";
import { findPageSearchMatches } from "../lib/pageSearch";
import { findPageViewPlugin, markdownContext } from "../lib/pluginHost";
import { FavoriteToggleButton } from "./FavoriteToggleButton";
import { MainContentTop } from "./MainContentTop";
import { MarkdownEditor } from "./MarkdownEditor";
import { MarkdownWysiwygEditor } from "./MarkdownWysiwygEditor";
import { SideBySideDiffView } from "./SideBySideDiffView";

export type PageMode = "view" | "history";

export type PagePluginContext = {
  namespaceId: string;
  namespaceName: string;
  path: string;
  location: string;
  title: string;
};

export function PageSurface({
  backlinks,
  draft,
  editorKey,
  historyEntries,
  historyError,
  isHistoryLoading,
  isDirty,
  isSaving,
  isVirtual,
  isFavorite,
  mode,
  pageContext,
  plugins,
  readOnly = false,
  canGoBack,
  canGoForward,
  onDraftChange,
  onCategoriesChange,
  onGoBack,
  onGoForward,
  onModeChange,
  onToggleFavorite,
  onOpenLocation,
  onOpenMarkdownLink,
  onResolveMarkdownImage,
  onResolveMarkdownLinkStatus,
  onSelectHistoryEntry,
  onCloseHistorySnapshot,
  selectedHistoryRevisionId,
  selectedHistorySnapshot,
  selectedHistoryError,
  isSelectedHistoryLoading,
}: {
  backlinks: BacklinkSummary[];
  draft: string;
  editorKey: string;
  historyEntries: FileHistoryEntry[];
  historyError: string | null;
  isHistoryLoading: boolean;
  isDirty: boolean;
  isSaving: boolean;
  isVirtual: boolean;
  isFavorite: boolean;
  mode: PageMode;
  pageContext: PagePluginContext;
  plugins: InstalledPluginSummary[];
  readOnly?: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onDraftChange: (value: string) => void;
  onCategoriesChange: (categories: string[]) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onModeChange: (mode: PageMode) => void;
  onToggleFavorite: () => void;
  onOpenLocation: (location: string) => void;
  onOpenMarkdownLink: (target: string) => void;
  onResolveMarkdownImage: (target: string) => Promise<{
    content_type: string | null;
    data_url: string | null;
    exists: boolean;
    is_image: boolean;
    is_internal: boolean;
    location: string;
  }>;
  onResolveMarkdownLinkStatus: (target: string) => Promise<{
    exists: boolean;
    is_internal: boolean;
    location: string;
  }>;
  onSelectHistoryEntry: (entry: FileHistoryEntry) => void;
  onCloseHistorySnapshot: () => void;
  selectedHistoryRevisionId: string | null;
  selectedHistorySnapshot: PageHistorySnapshot | null;
  selectedHistoryError: string | null;
  isSelectedHistoryLoading: boolean;
}) {
  const [editorView, setEditorView] = useState<"wysiwyg" | "source">("wysiwyg");
  const [categoryInput, setCategoryInput] = useState("");
  const [categoryValues, setCategoryValues] = useState<string[]>([]);
  const [pageSearchOpen, setPageSearchOpen] = useState(false);
  const [pageSearchQuery, setPageSearchQuery] = useState("");
  const [pageSearchIndex, setPageSearchIndex] = useState(0);
  const pluginViewMatch = editorView === "wysiwyg" ? findPageViewPlugin(draft, plugins) : null;
  const activeTool = mode === "history" ? "history" : editorView;
  const pageSearchMatches = useMemo(
    () => findPageSearchMatches(draft, pageSearchQuery),
    [draft, pageSearchQuery],
  );
  const activePageSearchMatch = pageSearchMatches[pageSearchIndex] ?? null;

  useEffect(() => {
    setCategoryInput("");
    setCategoryValues(categoriesFromMarkdown(draft));
    setPageSearchOpen(false);
    setPageSearchQuery("");
    setPageSearchIndex(0);
  }, [editorKey]);

  useEffect(() => {
    const draftCategories = categoriesFromMarkdown(draft);
    if (!sameCategories(categoryValues, draftCategories)) {
      setCategoryValues(draftCategories);
    }
  }, [categoryValues, draft]);

  useEffect(() => {
    setPageSearchIndex(0);
  }, [pageSearchQuery]);

  useEffect(() => {
    if (pageSearchIndex >= pageSearchMatches.length) {
      setPageSearchIndex(Math.max(0, pageSearchMatches.length - 1));
    }
  }, [pageSearchIndex, pageSearchMatches.length]);

  const openPageSearch = () => {
    setPageSearchOpen(true);
  };

  const closePageSearch = () => {
    setPageSearchOpen(false);
    setPageSearchQuery("");
    setPageSearchIndex(0);
  };

  const goToPreviousPageSearchMatch = () => {
    if (pageSearchMatches.length === 0) {
      return;
    }
    setPageSearchIndex((current) => (current <= 0 ? pageSearchMatches.length - 1 : current - 1));
  };

  const goToNextPageSearchMatch = () => {
    if (pageSearchMatches.length === 0) {
      return;
    }
    setPageSearchIndex((current) => (current + 1) % pageSearchMatches.length);
  };

  const updateCategories = (categories: string[]) => {
    const nextCategories = uniqueCategories(categories);
    setCategoryValues(nextCategories);
    onCategoriesChange(nextCategories);
  };

  const commitCategoryInput = () => {
    const inputCategories = splitCategoryInput(categoryInput);
    if (inputCategories.length === 0) {
      setCategoryInput("");
      return;
    }
    setCategoryInput("");
    updateCategories([...categoryValues, ...inputCategories]);
  };

  return (
    <Box
      sx={{
        bgcolor: "#ffffff",
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <MainContentTop
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onGoBack={onGoBack}
        onGoForward={onGoForward}
        rightSlot={
          <>
            <Box sx={{ flex: 1, minWidth: 0 }} />
            {isDirty && (
              <Chip
                aria-label="未保存"
                label="未保存"
                size="small"
                variant="outlined"
                sx={{
                  bgcolor: "#ffffff",
                  borderColor: "#cf222e",
                  color: "#a40e26",
                  fontWeight: 600,
                  mr: 1,
                  minWidth: 72,
                }}
              />
            )}
            <Tooltip title="ページ内検索">
              <IconButton
                aria-label="ページ内検索"
                aria-pressed={pageSearchOpen}
                size="small"
                onClick={pageSearchOpen ? closePageSearch : openPageSearch}
              >
                <FindInPageRounded fontSize="small" />
              </IconButton>
            </Tooltip>
            {!readOnly && (
              <FavoriteToggleButton
                disabled={isVirtual || isSaving}
                isFavorite={isFavorite}
                onToggleFavorite={onToggleFavorite}
              />
            )}
            <ToggleButtonGroup
              exclusive
              size="small"
              value={activeTool}
              sx={{ flex: "0 0 auto" }}
              onChange={(_, value: "wysiwyg" | "source" | "history" | null) => {
                if (!value) {
                  return;
                }
                if (value === "history") {
                  onModeChange("history");
                  return;
                }
                setEditorView(value);
                onModeChange("view");
              }}
            >
              <Tooltip title="Milkdown">
                <ToggleButton
                  aria-label="Milkdown"
                  value="wysiwyg"
                  disabled={isSaving}
                  sx={{ minHeight: 32, minWidth: 36, px: 1 }}
                >
                  <Article fontSize="small" />
                </ToggleButton>
              </Tooltip>
              <Tooltip title="Markdown">
                <ToggleButton
                  aria-label="Markdown"
                  value="source"
                  disabled={isSaving}
                  sx={{ minHeight: 32, minWidth: 36, px: 1 }}
                >
                  <Code fontSize="small" />
                </ToggleButton>
              </Tooltip>
              <Tooltip title="履歴">
                <ToggleButton
                  aria-label="履歴"
                  value="history"
                  disabled={isVirtual}
                  sx={{ minHeight: 32, minWidth: 36, px: 1 }}
                >
                  <HistoryRounded fontSize="small" />
                </ToggleButton>
              </Tooltip>
            </ToggleButtonGroup>
          </>
        }
      />
      <Box sx={{ flex: "1 1 auto", minHeight: 0, overflow: "auto" }}>
        {mode === "history" ? (
          <HistoryPanel
            entries={historyEntries}
            error={historyError}
            isLoading={isHistoryLoading}
            onSelectEntry={onSelectHistoryEntry}
            onCloseSnapshot={onCloseHistorySnapshot}
            selectedRevisionId={selectedHistoryRevisionId}
            selectedSnapshot={selectedHistorySnapshot}
            selectedError={selectedHistoryError}
            isSelectedLoading={isSelectedHistoryLoading}
          />
        ) : (
          <Box sx={{ position: "relative" }}>
            {pageSearchOpen && (
              <PageSearchBar
                currentIndex={pageSearchIndex}
                matchCount={pageSearchMatches.length}
                query={pageSearchQuery}
                onClose={closePageSearch}
                onNext={goToNextPageSearchMatch}
                onPrevious={goToPreviousPageSearchMatch}
                onQueryChange={setPageSearchQuery}
              />
            )}
            {isVirtual && (
              <Alert severity="info" sx={{ m: 2 }}>
                {readOnly
                  ? "削除済みページの内容を表示しています。"
                  : "このページはまだ作成されていません。"}
              </Alert>
            )}
            <>
              {editorView === "source" ? (
                <Box sx={{ p: 0 }}>
                  <MarkdownEditor
                    activeSearchMatch={activePageSearchMatch}
                    ariaLabel="Markdownソース"
                    disabled={isSaving || readOnly}
                    searchMatches={pageSearchMatches}
                    value={draft}
                    onChange={onDraftChange}
                  />
                </Box>
              ) : (
                <>
                  {pluginViewMatch ? (
                    <PluginHostView
                      content={draft}
                      contribution={pluginViewMatch.contribution}
                      pageContext={pageContext}
                      plugin={pluginViewMatch.plugin}
                      readOnly={readOnly}
                    />
                  ) : (
                    <MarkdownWysiwygEditor
                      key={editorKey}
                      ariaLabel="Markdown"
                      disabled={isSaving || readOnly}
                      value={markdownBodyFromMarkdown(draft)}
                      onChange={(value) =>
                        onDraftChange(updateMarkdownBodyPreservingFrontmatter(draft, value))
                      }
                      onOpenMarkdownLink={onOpenMarkdownLink}
                      onResolveMarkdownImage={onResolveMarkdownImage}
                      onResolveMarkdownLinkStatus={onResolveMarkdownLinkStatus}
                    />
                  )}
                </>
              )}
              <BacklinksPanel backlinks={backlinks} onOpenLocation={onOpenLocation} />
              <Box sx={{ px: 2, pb: 2, pt: 1 }}>
                <Autocomplete
                  disabled={isSaving || readOnly}
                  freeSolo
                  fullWidth
                  multiple
                  options={[]}
                  size="small"
                  value={categoryValues}
                  inputValue={categoryInput}
                  onBlur={commitCategoryInput}
                  onChange={(_, value) => updateCategories(value)}
                  onInputChange={(_, value, reason) => {
                    if (reason !== "input") {
                      setCategoryInput(value);
                      return;
                    }
                    if (value.includes(",")) {
                      const inputCategories = splitCategoryInput(value);
                      setCategoryInput("");
                      updateCategories([...categoryValues, ...inputCategories]);
                      return;
                    }
                    setCategoryInput(value);
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="カテゴリ" placeholder="カテゴリを追加" />
                  )}
                />
              </Box>
            </>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function PageSearchBar({
  currentIndex,
  matchCount,
  query,
  onClose,
  onNext,
  onPrevious,
  onQueryChange,
}: {
  currentIndex: number;
  matchCount: number;
  query: string;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onQueryChange: (query: string) => void;
}) {
  const hasQuery = query.trim().length > 0;
  const hasMatches = matchCount > 0;
  const countLabel = hasQuery && hasMatches ? `${currentIndex + 1}/${matchCount}` : "0/0";

  return (
    <Paper
      elevation={8}
      role="search"
      aria-label="ページ内検索"
      sx={{
        alignItems: "center",
        bgcolor: "#ffffff",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1.5,
        boxShadow: "0 8px 24px rgba(31, 35, 40, 0.16)",
        display: "flex",
        gap: 0.75,
        maxWidth: "calc(100% - 32px)",
        position: "absolute",
        px: 1,
        py: 0.75,
        right: 16,
        top: 16,
        width: { xs: "calc(100% - 32px)", sm: 430 },
        zIndex: (theme) => theme.zIndex.appBar,
      }}
    >
      <TextField
        autoComplete="off"
        autoFocus
        size="small"
        value={query}
        placeholder="ページ内検索"
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onClose();
          }
          if (event.key === "Enter") {
            event.preventDefault();
            if (event.shiftKey) {
              onPrevious();
              return;
            }
            onNext();
          }
        }}
        slotProps={{
          htmlInput: {
            "aria-label": "ページ内検索キーワード",
          },
        }}
        sx={{ flex: "1 1 auto", minWidth: 0 }}
      />
      <Typography
        aria-label="ページ内検索の一致数"
        variant="body2"
        color="text.secondary"
        sx={{ flex: "0 0 auto", minWidth: 44, textAlign: "right" }}
      >
        {countLabel}
      </Typography>
      <Tooltip title="前へ">
        <span>
          <IconButton
            aria-label="前の一致"
            disabled={!hasMatches}
            size="small"
            onClick={onPrevious}
          >
            <KeyboardArrowUpRounded fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="次へ">
        <span>
          <IconButton aria-label="次の一致" disabled={!hasMatches} size="small" onClick={onNext}>
            <KeyboardArrowDownRounded fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="閉じる">
        <IconButton aria-label="ページ内検索を閉じる" size="small" onClick={onClose}>
          <CloseRounded fontSize="small" />
        </IconButton>
      </Tooltip>
    </Paper>
  );
}

function PluginHostView({
  content,
  contribution,
  pageContext,
  plugin,
  readOnly,
}: {
  content: string;
  contribution: InstalledPluginSummary["manifest"]["contributions"][number];
  pageContext: PagePluginContext;
  plugin: InstalledPluginSummary;
  readOnly: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const iframeResizeCleanupRef = useRef<(() => void) | null>(null);
  const [pluginHtml, setPluginHtml] = useState<string | null>(null);
  const [iframeHeight, setIframeHeight] = useState(420);
  const [error, setError] = useState<string | null>(null);
  const parsedMarkdown = useMemo(() => markdownContext(content), [content]);

  useEffect(() => {
    let isMounted = true;
    setPluginHtml(null);
    setError(null);

    resolvePluginMain(plugin.id)
      .then((entry) => {
        if (!isMounted) {
          return;
        }
        setPluginHtml(entry.html);
      })
      .catch((caught) => {
        if (!isMounted) {
          return;
        }
        setError(errorMessage(caught));
      });

    return () => {
      isMounted = false;
      iframeResizeCleanupRef.current?.();
      iframeResizeCleanupRef.current = null;
    };
  }, [plugin.id]);

  useEffect(() => {
    if (!pluginHtml) {
      return;
    }
    postRenderMessage(iframeRef.current, {
      contributionId: contribution.id,
      content,
      isReadOnly: readOnly,
      pageContext,
      parsedMarkdown,
      pluginId: plugin.id,
    });
    window.setTimeout(() => updateIframeHeight(iframeRef.current, setIframeHeight), 0);
    window.setTimeout(() => updateIframeHeight(iframeRef.current, setIframeHeight), 50);
  }, [content, contribution.id, pageContext, parsedMarkdown, plugin.id, pluginHtml, readOnly]);

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        プラグインを読み込めません: {error}
      </Alert>
    );
  }

  if (!pluginHtml) {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", p: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          プラグインを読み込み中
        </Typography>
      </Stack>
    );
  }

  return (
    <Box
      component="iframe"
      ref={iframeRef}
      title={contribution.name}
      srcDoc={pluginHtml}
      scrolling="no"
      onLoad={() => {
        iframeResizeCleanupRef.current?.();
        iframeResizeCleanupRef.current = observeIframeHeight(iframeRef.current, setIframeHeight);
        postRenderMessage(iframeRef.current, {
          contributionId: contribution.id,
          content,
          isReadOnly: readOnly,
          pageContext,
          parsedMarkdown,
          pluginId: plugin.id,
        });
      }}
      sx={{
        border: 0,
        display: "block",
        height: iframeHeight,
        minHeight: 420,
        overflow: "hidden",
        width: "100%",
      }}
    />
  );
}

function observeIframeHeight(
  iframe: HTMLIFrameElement | null,
  setIframeHeight: (height: number) => void,
) {
  updateIframeHeight(iframe, setIframeHeight);

  const document = iframe?.contentDocument;
  if (!document || typeof ResizeObserver === "undefined") {
    return null;
  }

  const observer = new ResizeObserver(() => updateIframeHeight(iframe, setIframeHeight));
  if (document.documentElement) {
    observer.observe(document.documentElement);
  }
  if (document.body) {
    observer.observe(document.body);
  }

  return () => observer.disconnect();
}

function updateIframeHeight(
  iframe: HTMLIFrameElement | null,
  setIframeHeight: (height: number) => void,
) {
  const document = iframe?.contentDocument;
  if (!document) {
    return;
  }

  const body = document.body;
  const documentElement = document.documentElement;
  const contentHeight = Math.max(
    body?.scrollHeight ?? 0,
    body?.offsetHeight ?? 0,
    documentElement?.scrollHeight ?? 0,
    documentElement?.offsetHeight ?? 0,
  );
  setIframeHeight(Math.max(420, Math.ceil(contentHeight)));
}

function postRenderMessage(
  iframe: HTMLIFrameElement | null,
  payload: {
    contributionId: string;
    content: string;
    isReadOnly: boolean;
    pageContext: PagePluginContext;
    parsedMarkdown: ReturnType<typeof markdownContext>;
    pluginId: string;
  },
) {
  iframe?.contentWindow?.postMessage(
    {
      type: "daibase:render",
      requestId: requestId(),
      context: {
        namespace: {
          id: payload.pageContext.namespaceId,
          name: payload.pageContext.namespaceName,
        },
        page: {
          namespaceId: payload.pageContext.namespaceId,
          path: payload.pageContext.path,
          location: payload.pageContext.location,
          title: payload.pageContext.title,
          content: payload.content,
          frontmatter: payload.parsedMarkdown.frontmatter,
          body: payload.parsedMarkdown.body,
          isDirty: false,
          isReadOnly: payload.isReadOnly,
        },
        view: {
          contributionId: payload.contributionId,
          pluginId: payload.pluginId,
        },
      },
    },
    "*",
  );
}

function requestId() {
  return globalThis.crypto?.randomUUID?.() ?? `request-${Date.now()}-${Math.random()}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function splitCategoryInput(value: string) {
  return value
    .split(",")
    .map((category) => category.trim())
    .filter((category) => category.length > 0);
}

function uniqueCategories(categories: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const category of categories.map((value) => value.trim())) {
    if (!category || seen.has(category)) {
      continue;
    }
    seen.add(category);
    result.push(category);
  }
  return result;
}

function sameCategories(left: string[], right: string[]) {
  return left.length === right.length && left.every((category, index) => category === right[index]);
}

function BacklinksPanel({
  backlinks,
  onOpenLocation,
}: {
  backlinks: BacklinkSummary[];
  onOpenLocation: (location: string) => void;
}) {
  if (backlinks.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        mx: 2,
        pb: 2,
        pt: 1,
      }}
    >
      <Typography variant="caption" component="h2" color="text.secondary">
        このページへのリンク
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mt: 0.5, rowGap: 0.5 }}>
        {backlinks.map((backlink) => (
          <Link
            key={backlink.location}
            component="button"
            type="button"
            underline="hover"
            variant="body2"
            onClick={() => onOpenLocation(backlink.location)}
            sx={{ cursor: "pointer" }}
          >
            {backlink.title}
          </Link>
        ))}
      </Stack>
    </Box>
  );
}

function HistoryPanel({
  entries,
  error,
  isLoading,
  onSelectEntry,
  onCloseSnapshot,
  selectedRevisionId,
  selectedSnapshot,
  selectedError,
  isSelectedLoading,
}: {
  entries: FileHistoryEntry[];
  error: string | null;
  isLoading: boolean;
  onSelectEntry: (entry: FileHistoryEntry) => void;
  onCloseSnapshot: () => void;
  selectedRevisionId: string | null;
  selectedSnapshot: PageHistorySnapshot | null;
  selectedError: string | null;
  isSelectedLoading: boolean;
}) {
  if (selectedRevisionId) {
    return (
      <Box sx={{ px: 2, py: 1.5 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1.5 }}>
          <Button
            startIcon={<ArrowBackRounded />}
            variant="text"
            onClick={onCloseSnapshot}
            sx={{ flex: "0 0 auto" }}
          >
            一覧へ戻る
          </Button>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" component="h2" sx={{ fontWeight: 700 }}>
              編集履歴
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {selectedRevisionId}
            </Typography>
          </Box>
        </Stack>
        {isSelectedLoading ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              読み込み中
            </Typography>
          </Stack>
        ) : selectedError ? (
          <Alert severity="error">{selectedError}</Alert>
        ) : selectedSnapshot ? (
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {formatHistoryTime(selectedSnapshot.entry.created_at)} /{" "}
              {shortenHash(selectedSnapshot.entry.object_id)}
            </Typography>
            <SideBySideDiffView sections={selectedSnapshot.diff_sections} />
          </Stack>
        ) : null}
      </Box>
    );
  }

  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Typography variant="subtitle2" component="h2" sx={{ fontWeight: 700 }}>
        編集履歴
      </Typography>
      {isLoading ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            読み込み中
          </Typography>
        </Stack>
      ) : error ? (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      ) : entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          履歴はまだありません。
        </Typography>
      ) : (
        <List dense disablePadding sx={{ mt: 1 }}>
          {entries.map((entry) => (
            <ListItemButton
              key={entry.revision_id}
              selected={entry.revision_id === selectedRevisionId}
              onClick={() => onSelectEntry(entry)}
              sx={{
                borderTop: "1px solid #d8dee4",
                display: "flex",
                gap: 2,
                px: 1,
                py: 1,
              }}
            >
              <ListItemText
                primary={formatHistoryTime(entry.created_at)}
                secondary={`${entry.kind} / ${entry.path}`}
              />
              <Typography
                variant="caption"
                title={entry.object_id}
                sx={{
                  alignSelf: "center",
                  color: "text.secondary",
                  flex: "0 0 auto",
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                }}
              >
                {shortenHash(entry.object_id)}
              </Typography>
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  );
}

function shortenHash(value: string) {
  const parts = value.split(":");
  const hash = value.includes(":") ? parts[parts.length - 1] : value;
  if (!hash) {
    return value;
  }

  return hash.length > 12 ? hash.slice(0, 12) : hash;
}

function formatHistoryTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
