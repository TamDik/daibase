import {
  Alert,
  Box,
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
import { Article, Code, Star, StarBorder } from "@mui/icons-material";
import { useState } from "react";

import type { BacklinkSummary, FileHistoryEntry } from "../api/tauriCommands";
import { MarkdownWysiwygEditor } from "./MarkdownWysiwygEditor";

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
  readOnly = false,
  onDraftChange,
  onModeChange,
  onToggleFavorite,
  onOpenLocation,
  onOpenMarkdownLink,
  onResolveMarkdownImage,
  onResolveMarkdownLinkStatus,
  onSelectHistoryEntry,
  selectedHistoryRevisionId,
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
  readOnly?: boolean;
  onDraftChange: (value: string) => void;
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
  selectedHistoryRevisionId: string | null;
}) {
  const [editorView, setEditorView] = useState<"wysiwyg" | "source">("wysiwyg");

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
            selectedRevisionId={selectedHistoryRevisionId}
          />
        ) : (
          <Box sx={{ position: "relative" }}>
            {isVirtual && (
              <Alert severity="info" sx={{ m: 2 }}>
                {readOnly ? "削除済みページの内容を表示しています。" : "このページはまだ作成されていません。"}
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
                <MarkdownWysiwygEditor
                  key={editorKey}
                  ariaLabel="Markdown"
                  disabled={isSaving || readOnly}
                  value={draft}
                  onChange={onDraftChange}
                  onOpenMarkdownLink={onOpenMarkdownLink}
                  onResolveMarkdownImage={onResolveMarkdownImage}
                  onResolveMarkdownLinkStatus={onResolveMarkdownLinkStatus}
                />
              )}
              <BacklinksPanel backlinks={backlinks} onOpenLocation={onOpenLocation} />
            </>
          </Box>
        )}
      </Box>
    </Box>
  );
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
  selectedRevisionId,
}: {
  entries: FileHistoryEntry[];
  error: string | null;
  isLoading: boolean;
  onSelectEntry: (entry: FileHistoryEntry) => void;
  selectedRevisionId: string | null;
}) {
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
