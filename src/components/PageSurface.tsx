import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import type { FileHistoryEntry, PageHistorySnapshot } from "../api/tauriCommands";
import { MarkdownPreview } from "./MarkdownPreview";

export type PageMode = "view" | "history" | "edit";

export function PageSurface({
  draft,
  existingPageLocations,
  historyEntries,
  historyError,
  historySnapshot,
  historySnapshotError,
  isHistoryLoading,
  isHistorySnapshotLoading,
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
  onSelectHistoryEntry,
  selectedHistoryRevisionId,
}: {
  draft: string;
  existingPageLocations: ReadonlySet<string>;
  historyEntries: FileHistoryEntry[];
  historyError: string | null;
  historySnapshot: PageHistorySnapshot | null;
  historySnapshotError: string | null;
  isHistoryLoading: boolean;
  isHistorySnapshotLoading: boolean;
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
  onSelectHistoryEntry: (entry: FileHistoryEntry) => void;
  selectedHistoryRevisionId: string | null;
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
            existingPageLocations={existingPageLocations}
            isSnapshotLoading={isHistorySnapshotLoading}
            isLoading={isHistoryLoading}
            onOpenLocation={onOpenLocation}
            onResolveMarkdownLink={onResolveMarkdownLink}
            onSelectEntry={onSelectHistoryEntry}
            selectedRevisionId={selectedHistoryRevisionId}
            snapshot={historySnapshot}
            snapshotError={historySnapshotError}
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
  existingPageLocations,
  isLoading,
  isSnapshotLoading,
  onOpenLocation,
  onResolveMarkdownLink,
  onSelectEntry,
  selectedRevisionId,
  snapshot,
  snapshotError,
}: {
  entries: FileHistoryEntry[];
  error: string | null;
  existingPageLocations: ReadonlySet<string>;
  isLoading: boolean;
  isSnapshotLoading: boolean;
  onOpenLocation: (location: string) => void;
  onResolveMarkdownLink: (target: string) => Promise<string>;
  onSelectEntry: (entry: FileHistoryEntry) => void;
  selectedRevisionId: string | null;
  snapshot: PageHistorySnapshot | null;
  snapshotError: string | null;
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
      <HistorySnapshotPanel
        existingPageLocations={existingPageLocations}
        isLoading={isSnapshotLoading}
        onOpenLocation={onOpenLocation}
        onResolveMarkdownLink={onResolveMarkdownLink}
        snapshot={snapshot}
        snapshotError={snapshotError}
      />
    </Box>
  );
}

function HistorySnapshotPanel({
  existingPageLocations,
  isLoading,
  onOpenLocation,
  onResolveMarkdownLink,
  snapshot,
  snapshotError,
}: {
  existingPageLocations: ReadonlySet<string>;
  isLoading: boolean;
  onOpenLocation: (location: string) => void;
  onResolveMarkdownLink: (target: string) => Promise<string>;
  snapshot: PageHistorySnapshot | null;
  snapshotError: string | null;
}) {
  if (isLoading) {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          履歴の内容を読み込み中
        </Typography>
      </Stack>
    );
  }

  if (snapshotError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {snapshotError}
      </Alert>
    );
  }

  if (!snapshot) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        履歴を選択すると、その時点の内容と差分を確認できます。
      </Typography>
    );
  }

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Box>
        <Typography variant="subtitle2" component="h3" sx={{ fontWeight: 700, mb: 1 }}>
          その時点の内容
        </Typography>
        <Box sx={{ border: "1px solid #d8dee4", borderRadius: 1 }}>
          <MarkdownPreview
            existingPageLocations={existingPageLocations}
            markdown={snapshot.content}
            onOpenLocation={onOpenLocation}
            onResolveMarkdownLink={onResolveMarkdownLink}
          />
        </Box>
      </Box>
      <Box>
        <Typography variant="subtitle2" component="h3" sx={{ fontWeight: 700, mb: 1 }}>
          その時の編集差分
        </Typography>
        <Stack
          component="pre"
          spacing={0}
          sx={{
            bgcolor: "#f6f8fa",
            border: "1px solid #d8dee4",
            borderRadius: 1,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            fontSize: 13,
            lineHeight: 1.6,
            m: 0,
            overflow: "auto",
            p: 1.5,
            whiteSpace: "pre-wrap",
          }}
        >
          {diffLines(snapshot.previous_content ?? "", snapshot.content).map((line, index) => (
            <Box
              component="code"
              key={`${index}-${line.kind}-${line.text}`}
              sx={{
                bgcolor:
                  line.kind === "added"
                    ? "rgba(46, 160, 67, 0.12)"
                    : line.kind === "removed"
                      ? "rgba(248, 81, 73, 0.12)"
                      : "transparent",
                color:
                  line.kind === "added"
                    ? "#1a7f37"
                    : line.kind === "removed"
                      ? "#cf222e"
                      : "text.primary",
                display: "block",
              }}
            >
              {line.prefix}
              {line.text}
            </Box>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}

function diffLines(previousContent: string, currentContent: string) {
  const previousLines = splitContentLines(previousContent);
  const currentLines = splitContentLines(currentContent);
  const matrix = Array.from({ length: previousLines.length + 1 }, () =>
    Array.from({ length: currentLines.length + 1 }, () => 0),
  );

  for (let previousIndex = previousLines.length - 1; previousIndex >= 0; previousIndex -= 1) {
    for (let currentIndex = currentLines.length - 1; currentIndex >= 0; currentIndex -= 1) {
      matrix[previousIndex][currentIndex] =
        previousLines[previousIndex] === currentLines[currentIndex]
          ? matrix[previousIndex + 1][currentIndex + 1] + 1
          : Math.max(
              matrix[previousIndex + 1][currentIndex],
              matrix[previousIndex][currentIndex + 1],
            );
    }
  }

  const diff = [];
  let previousIndex = 0;
  let currentIndex = 0;
  while (previousIndex < previousLines.length && currentIndex < currentLines.length) {
    if (previousLines[previousIndex] === currentLines[currentIndex]) {
      diff.push({ kind: "unchanged", prefix: "  ", text: previousLines[previousIndex] });
      previousIndex += 1;
      currentIndex += 1;
    } else if (matrix[previousIndex + 1][currentIndex] >= matrix[previousIndex][currentIndex + 1]) {
      diff.push({ kind: "removed", prefix: "- ", text: previousLines[previousIndex] });
      previousIndex += 1;
    } else {
      diff.push({ kind: "added", prefix: "+ ", text: currentLines[currentIndex] });
      currentIndex += 1;
    }
  }

  while (previousIndex < previousLines.length) {
    diff.push({ kind: "removed", prefix: "- ", text: previousLines[previousIndex] });
    previousIndex += 1;
  }
  while (currentIndex < currentLines.length) {
    diff.push({ kind: "added", prefix: "+ ", text: currentLines[currentIndex] });
    currentIndex += 1;
  }

  return diff;
}

function splitContentLines(content: string) {
  return content.length === 0 ? [] : content.split("\n");
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
