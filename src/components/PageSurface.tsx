import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import List from "@mui/material/List";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import type { FileHistoryEntry } from "../api/tauriCommands";
import { MarkdownPreview } from "./MarkdownPreview";

export type PageMode = "view" | "history" | "edit";

export function PageSurface({
  draft,
  existingPageLocations,
  historyEntries,
  historyError,
  isHistoryLoading,
  isSaving,
  isVirtual,
  mode,
  previewContent,
  onCancelEditing,
  onDraftChange,
  onModeChange,
  onOpenLocation,
  onResolveMarkdownLink,
  onSave,
}: {
  draft: string;
  existingPageLocations: ReadonlySet<string>;
  historyEntries: FileHistoryEntry[];
  historyError: string | null;
  isHistoryLoading: boolean;
  isSaving: boolean;
  isVirtual: boolean;
  mode: PageMode;
  previewContent: string;
  onCancelEditing: () => void;
  onDraftChange: (value: string) => void;
  onModeChange: (mode: PageMode) => void;
  onOpenLocation: (location: string) => void;
  onResolveMarkdownLink: (target: string) => Promise<string>;
  onSave: () => void;
}) {
  return (
    <Box sx={{ bgcolor: "#ffffff", flexGrow: 1, overflow: "hidden" }}>
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
            <Tab label="編集" value="edit" sx={{ minHeight: 36, px: 1.5, py: 0 }} />
          </Tabs>
        </Box>
      </Box>

      <Box>
        {mode === "edit" ? (
          <Box>
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ justifyContent: "flex-end", px: 1.5, py: 0.5 }}
            >
              <Button variant="text" size="small" onClick={onCancelEditing} disabled={isSaving}>
                キャンセル
              </Button>
              <Button variant="text" size="small" onClick={onSave} disabled={isSaving}>
                {isSaving ? "保存中" : "保存"}
              </Button>
            </Stack>
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
          </Box>
        ) : isVirtual ? (
          <Box sx={{ p: 2 }}>
            <Alert severity="info">このページはまだ作成されていません。</Alert>
          </Box>
        ) : mode === "history" ? (
          <HistoryPanel
            entries={historyEntries}
            error={historyError}
            isLoading={isHistoryLoading}
          />
        ) : (
          <MarkdownPreview
            existingPageLocations={existingPageLocations}
            markdown={previewContent}
            onOpenLocation={onOpenLocation}
            onResolveMarkdownLink={onResolveMarkdownLink}
          />
        )}
      </Box>
    </Box>
  );
}

function HistoryPanel({
  entries,
  error,
  isLoading,
}: {
  entries: FileHistoryEntry[];
  error: string | null;
  isLoading: boolean;
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
            <Box
              component="li"
              key={entry.revision_id}
              sx={{
                borderTop: "1px solid #d8dee4",
                py: 1,
              }}
            >
              <ListItemText
                primary={formatHistoryTime(entry.created_at)}
                secondary={`${entry.kind} / ${entry.path}`}
              />
            </Box>
          ))}
        </List>
      )}
    </Box>
  );
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
