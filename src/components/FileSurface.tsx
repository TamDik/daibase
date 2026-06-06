import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CloudUploadOutlined,
  HistoryRounded,
  InsertDriveFileOutlined,
  SaveOutlined,
} from "@mui/icons-material";

import type { BacklinkSummary, FileHistoryEntry, ManagedFileContent } from "../api/tauriCommands";
import { FavoriteToggleButton } from "./FavoriteToggleButton";
import { MainContentTop } from "./MainContentTop";

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
  readOnly = false,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  onModeChange,
  onNoteChange,
  onOpenLocation,
  onSaveNote,
  onSelectHistoryEntry,
  onToggleFavorite,
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
  readOnly?: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onModeChange: (mode: FileMode) => void;
  onNoteChange: (value: string) => void;
  onOpenLocation: (location: string) => void;
  onSaveNote: () => void;
  onSelectHistoryEntry: (entry: FileHistoryEntry) => void;
  onToggleFavorite: () => void;
  onUpload: () => void;
  selectedHistoryRevisionId: string | null;
}) {
  const isVirtual = file.is_virtual ?? false;
  const isNoteDirty = file.note !== noteDraft;
  const previewSrc = !isVirtual || readOnly ? file.data_url : null;
  const textContent = file.text_content;

  return (
    <Box
      sx={{
        bgcolor: "#ffffff",
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
        overflow: "hidden",
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
            {!readOnly && (
              <FavoriteToggleButton
                disabled={isVirtual || isUploading}
                isFavorite={file.is_favorite ?? false}
                onToggleFavorite={onToggleFavorite}
              />
            )}
            <ToggleButtonGroup
              exclusive
              size="small"
              value={mode}
              sx={{ flex: "0 0 auto" }}
              onChange={(_, value: FileMode | null) => {
                if (value) {
                  onModeChange(value);
                }
              }}
            >
              <Tooltip title="ファイル">
                <ToggleButton
                  aria-label="ファイル"
                  value="detail"
                  sx={{ minHeight: 32, minWidth: 36, px: 1 }}
                >
                  <InsertDriveFileOutlined fontSize="small" />
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
            selectedRevisionId={selectedHistoryRevisionId}
          />
        ) : (
          <Stack spacing={2} sx={{ maxWidth: 920, p: 2 }}>
            {isVirtual && (
              <Alert severity="info">
                {readOnly
                  ? "削除済みファイルの内容を表示しています。"
                  : "このファイルはまだアップロードされていません。"}
              </Alert>
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
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ overflowWrap: "anywhere" }}
                >
                  {file.path}
                </Typography>
              </Box>
              {!readOnly && (
                <Button
                  startIcon={isUploading ? <CircularProgress size={16} /> : <CloudUploadOutlined />}
                  variant="contained"
                  disabled={isUploading}
                  onClick={onUpload}
                >
                  {isVirtual ? "アップロード" : "置き換え"}
                </Button>
              )}
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

            {(!isVirtual || readOnly) && (
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
                  <Alert severity="info">
                    このファイル形式の内容表示にはまだ対応していません。
                  </Alert>
                )}
              </Stack>
            )}

            {!readOnly && (
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
            )}
            <BacklinksPanel backlinks={file.backlinks} onOpenLocation={onOpenLocation} />
          </Stack>
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
    <Box sx={{ pt: 0.5 }}>
      <Typography variant="caption" component="h2" color="text.secondary">
        このファイルへのリンク
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
