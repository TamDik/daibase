import {
  Alert,
  Box,
  Button,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { CloudUploadOutlined, SaveOutlined } from "@mui/icons-material";

import type { FileHistoryEntry, ManagedFileContent } from "../api/tauriCommands";

export type FileMode = "detail" | "history";

export function FileSurface({
  file,
  historyEntries,
  historyError,
  isHistoryLoading,
  isNoteSaving,
  isUploading,
  mode,
  noteDraft,
  onModeChange,
  onNoteChange,
  onSaveNote,
  onSelectHistoryEntry,
  onUpload,
  selectedHistoryRevisionId,
}: {
  file: ManagedFileContent;
  historyEntries: FileHistoryEntry[];
  historyError: string | null;
  isHistoryLoading: boolean;
  isNoteSaving: boolean;
  isUploading: boolean;
  mode: FileMode;
  noteDraft: string;
  onModeChange: (mode: FileMode) => void;
  onNoteChange: (value: string) => void;
  onSaveNote: () => void;
  onSelectHistoryEntry: (entry: FileHistoryEntry) => void;
  onUpload: () => void;
  selectedHistoryRevisionId: string | null;
}) {
  const isVirtual = file.is_virtual ?? false;
  const isNoteDirty = file.note !== noteDraft;
  const previewSrc = !isVirtual ? file.data_url : null;
  const textContent = file.text_content;

  return (
    <Box sx={{ bgcolor: "#ffffff", flexGrow: 1, overflow: "visible" }}>
      <Box sx={{ alignItems: "center", display: "flex", px: 1.5, pt: 0.5 }}>
        <Box sx={{ borderBottom: 1, borderColor: "divider", flex: 1 }}>
          <Tabs
            value={mode}
            onChange={(_, value: FileMode) => onModeChange(value)}
            sx={{ minHeight: 36 }}
          >
            <Tab label="ファイル" value="detail" sx={{ minHeight: 36, px: 1.5, py: 0 }} />
            <Tab
              label="履歴"
              value="history"
              disabled={isVirtual}
              sx={{ minHeight: 36, px: 1.5, py: 0 }}
            />
          </Tabs>
        </Box>
      </Box>

      {mode === "history" ? (
        <HistoryPanel
          entries={historyEntries}
          error={historyError}
          isLoading={isHistoryLoading}
          onSelectEntry={onSelectHistoryEntry}
          selectedRevisionId={selectedHistoryRevisionId}
        />
      ) : (
        <Stack spacing={2} sx={{ maxWidth: 920, p: 2 }}>
          {isVirtual && (
            <Alert severity="info">このファイルはまだアップロードされていません。</Alert>
          )}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ alignItems: { xs: "stretch", sm: "center" } }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h5" component="h2" sx={{ overflowWrap: "anywhere" }}>
                {file.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                {file.path}
              </Typography>
            </Box>
            <Button
              startIcon={isUploading ? <CircularProgress size={16} /> : <CloudUploadOutlined />}
              variant="contained"
              disabled={isUploading}
              onClick={onUpload}
            >
              {isVirtual ? "アップロード" : "置き換え"}
            </Button>
          </Stack>

          <Box
            sx={{
              border: "1px solid #d0d7de",
              borderRadius: 1,
              display: "grid",
              gap: 1,
              gridTemplateColumns: { xs: "1fr", sm: "160px 1fr" },
              p: 1.5,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              種類
            </Typography>
            <Typography variant="body2">{file.content_type}</Typography>
            <Typography variant="body2" color="text.secondary">
              サイズ
            </Typography>
            <Typography variant="body2">{formatSize(file.size)}</Typography>
            <Typography variant="body2" color="text.secondary">
              最新 revision
            </Typography>
            <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
              {file.latest_revision_id ?? "-"}
            </Typography>
          </Box>

          {!isVirtual && (
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                内容
              </Typography>
              {previewSrc && file.content_type.startsWith("image/") ? (
                <Box
                  sx={{
                    alignItems: "center",
                    bgcolor: "#f6f8fa",
                    border: "1px solid #d0d7de",
                    borderRadius: 1,
                    display: "flex",
                    justifyContent: "center",
                    minHeight: 220,
                    overflow: "hidden",
                    p: 1,
                  }}
                >
                  <Box
                    component="img"
                    alt={file.title}
                    src={previewSrc}
                    sx={{
                      display: "block",
                      maxHeight: 520,
                      maxWidth: "100%",
                      objectFit: "contain",
                    }}
                  />
                </Box>
              ) : previewSrc && file.content_type === "application/pdf" ? (
                <Box
                  component="iframe"
                  title={file.title}
                  src={previewSrc}
                  sx={{
                    border: "1px solid #d0d7de",
                    borderRadius: 1,
                    height: "70vh",
                    width: "100%",
                  }}
                />
              ) : textContent !== null ? (
                <Box
                  component="pre"
                  sx={{
                    bgcolor: "#f6f8fa",
                    border: "1px solid #d0d7de",
                    borderRadius: 1,
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                    fontSize: 13,
                    lineHeight: 1.6,
                    m: 0,
                    maxHeight: "70vh",
                    overflow: "auto",
                    p: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {textContent}
                </Box>
              ) : (
                <Alert severity="info">このファイル形式の内容表示にはまだ対応していません。</Alert>
              )}
            </Stack>
          )}

          <Stack spacing={1}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              説明
            </Typography>
            <TextField
              multiline
              minRows={8}
              value={noteDraft}
              disabled={isVirtual || isNoteSaving}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder={isVirtual ? "アップロード後に説明を書けます。" : ""}
              slotProps={{
                htmlInput: {
                  "aria-label": "ファイル説明",
                },
              }}
            />
            <Box>
              <Button
                startIcon={isNoteSaving ? <CircularProgress size={16} /> : <SaveOutlined />}
                variant="outlined"
                disabled={isVirtual || isNoteSaving || !isNoteDirty}
                onClick={onSaveNote}
              >
                説明を保存
              </Button>
            </Box>
          </Stack>
        </Stack>
      )}
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
        ファイル履歴
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
              sx={{ borderTop: "1px solid #d8dee4", px: 1, py: 1 }}
            >
              <ListItemText primary={formatHistoryTime(entry.created_at)} secondary={entry.path} />
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  );
}

function formatSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
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
