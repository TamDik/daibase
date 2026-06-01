import {
  Alert,
  Box,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";

import type { FileHistoryEntry } from "../api/tauriCommands";
import { MarkdownWysiwygEditor } from "./MarkdownWysiwygEditor";

export type PageMode = "view" | "history";

export function PageSurface({
  draft,
  editorKey,
  historyEntries,
  historyError,
  isHistoryLoading,
  isSaving,
  isVirtual,
  mode,
  onDraftChange,
  onModeChange,
  onOpenMarkdownLink,
  onResolveMarkdownImage,
  onResolveMarkdownLinkStatus,
  onSelectHistoryEntry,
  selectedHistoryRevisionId,
}: {
  draft: string;
  editorKey: string;
  historyEntries: FileHistoryEntry[];
  historyError: string | null;
  isHistoryLoading: boolean;
  isSaving: boolean;
  isVirtual: boolean;
  mode: PageMode;
  onDraftChange: (value: string) => void;
  onModeChange: (mode: PageMode) => void;
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
  return (
    <Box sx={{ bgcolor: "#ffffff", flexGrow: 1, overflow: "visible" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
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
      </Box>

      <Box>
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
                このページはまだ作成されていません。
              </Alert>
            )}
            {isSaving && (
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  alignItems: "center",
                  bgcolor: "#f6f8fa",
                  border: "1px solid #d0d7de",
                  borderRadius: 3,
                  m: 2,
                  p: 1,
                  position: "absolute",
                  right: 0,
                  top: 0,
                  zIndex: 1,
                }}
              >
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  保存中
                </Typography>
              </Stack>
            )}
            <MarkdownWysiwygEditor
              key={editorKey}
              ariaLabel="Markdown"
              disabled={isSaving}
              value={draft}
              onChange={onDraftChange}
              onOpenMarkdownLink={onOpenMarkdownLink}
              onResolveMarkdownImage={onResolveMarkdownImage}
              onResolveMarkdownLinkStatus={onResolveMarkdownLinkStatus}
            />
          </Box>
        )}
      </Box>
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
