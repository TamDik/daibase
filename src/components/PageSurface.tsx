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
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { ArrowBackRounded, Article, Code, Star, StarBorder } from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";

import type {
  BacklinkSummary,
  FileHistoryEntry,
  InstalledPluginSummary,
  PageHistorySnapshot,
} from "../api/tauriCommands";
import { resolvePluginEntry } from "../api/tauriCommands";
import {
  categoriesFromMarkdown,
  markdownBodyFromMarkdown,
  updateMarkdownBodyPreservingFrontmatter,
} from "../lib/pageCategories";
import { findMarkdownRendererPlugin } from "../lib/pluginRenderers";
import { MarkdownWysiwygEditor } from "./MarkdownWysiwygEditor";
import { SideBySideDiffView } from "./SideBySideDiffView";

export type PageMode = "view" | "history";

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
  plugins,
  readOnly = false,
  onDraftChange,
  onCategoriesChange,
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
  plugins: InstalledPluginSummary[];
  readOnly?: boolean;
  onDraftChange: (value: string) => void;
  onCategoriesChange: (categories: string[]) => void;
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
  const rendererMatch =
    editorView === "wysiwyg" ? findMarkdownRendererPlugin(draft, plugins) : null;

  useEffect(() => {
    setCategoryInput("");
    setCategoryValues(categoriesFromMarkdown(draft));
  }, [editorKey]);

  useEffect(() => {
    const draftCategories = categoriesFromMarkdown(draft);
    if (!sameCategories(categoryValues, draftCategories)) {
      setCategoryValues(draftCategories);
    }
  }, [categoryValues, draft]);

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

  const viewToolbar = mode === "view" && (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        alignItems: "center",
        justifyContent: "flex-end",
        position: "absolute",
        right: 24,
        top: 52,
        zIndex: 2,
      }}
    >
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
            minWidth: 72,
          }}
        />
      )}
      <ToggleButtonGroup
        exclusive
        size="small"
        value={editorView}
        onChange={(_, value: "wysiwyg" | "source" | null) => {
          if (value) {
            setEditorView(value);
          }
        }}
      >
        <Tooltip title="WYSIWYG">
          <ToggleButton
            aria-label="WYSIWYG"
            value="wysiwyg"
            disabled={isSaving}
            sx={{ minHeight: 32, minWidth: 36, px: 1 }}
          >
            <Article fontSize="small" />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="Markdownソース">
          <ToggleButton
            aria-label="Markdownソース"
            value="source"
            disabled={isSaving}
            sx={{ minHeight: 32, minWidth: 36, px: 1 }}
          >
            <Code fontSize="small" />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>
    </Stack>
  );

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
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          flex: "0 0 auto",
          px: 1.5,
          pt: 0.5,
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: "divider", flex: 1 }}>
          <Tabs
            value={mode}
            onChange={(_, value: PageMode) => onModeChange(value)}
            sx={{ minHeight: 36 }}
          >
            <Tab label="閲覧" value="view" sx={{ minHeight: 36, px: 1.5, py: 0 }} />
            <Tab
              label="履歴"
              value="history"
              disabled={isVirtual}
              sx={{ minHeight: 36, px: 1.5, py: 0 }}
            />
          </Tabs>
        </Box>
        {!readOnly && (
          <Tooltip title={isFavorite ? "お気に入り解除" : "お気に入り"}>
            <span>
              <IconButton
                aria-label={isFavorite ? "お気に入り解除" : "お気に入り"}
                disabled={isVirtual || isSaving}
                size="small"
                onClick={onToggleFavorite}
                sx={{ ml: 0.5 }}
              >
                {isFavorite ? (
                  <Star sx={{ color: "#bf8700" }} fontSize="small" />
                ) : (
                  <StarBorder fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>
      {viewToolbar}

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
            {isVirtual && (
              <Alert severity="info" sx={{ m: 2 }}>
                {readOnly
                  ? "削除済みページの内容を表示しています。"
                  : "このページはまだ作成されていません。"}
              </Alert>
            )}
            <>
              {editorView === "source" ? (
                <TextField
                  label="Markdownソース"
                  value={draft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  disabled={isSaving || readOnly}
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
                <>
                  {rendererMatch ? (
                    <MarkdownPluginRenderer
                      content={draft}
                      plugin={rendererMatch.plugin}
                      rendererName={rendererMatch.contribution.name}
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

function MarkdownPluginRenderer({
  content,
  plugin,
  rendererName,
}: {
  content: string;
  plugin: InstalledPluginSummary;
  rendererName: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [entryHtml, setEntryHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setEntryHtml(null);
    setError(null);

    resolvePluginEntry(plugin.id)
      .then((entry) => {
        if (!isMounted) {
          return;
        }
        setEntryHtml(entry.html);
      })
      .catch((caught) => {
        if (!isMounted) {
          return;
        }
        setError(errorMessage(caught));
      });

    return () => {
      isMounted = false;
    };
  }, [plugin.id]);

  useEffect(() => {
    if (!entryHtml) {
      return;
    }
    postRenderMessage(iframeRef.current, content);
  }, [content, entryHtml]);

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        プラグインを読み込めません: {error}
      </Alert>
    );
  }

  if (!entryHtml) {
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
      title={rendererName}
      srcDoc={entryHtml}
      onLoad={() => postRenderMessage(iframeRef.current, content)}
      sx={{
        border: 0,
        display: "block",
        height: "calc(100vh - 160px)",
        minHeight: 420,
        width: "100%",
      }}
    />
  );
}

function postRenderMessage(iframe: HTMLIFrameElement | null, content: string) {
  iframe?.contentWindow?.postMessage(
    {
      type: "daibase:render",
      payload: { content },
    },
    "*",
  );
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
