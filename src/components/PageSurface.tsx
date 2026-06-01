import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import { MarkdownPreview } from "./MarkdownPreview";

export function PageSurface({
  draft,
  existingPageLocations,
  isEditing,
  isSaving,
  isVirtual,
  previewContent,
  onCancelEditing,
  onDraftChange,
  onOpenLocation,
  onResolveMarkdownLink,
  onSave,
  onStartEditing,
}: {
  draft: string;
  existingPageLocations: ReadonlySet<string>;
  isEditing: boolean;
  isSaving: boolean;
  isVirtual: boolean;
  previewContent: string;
  onCancelEditing: () => void;
  onDraftChange: (value: string) => void;
  onOpenLocation: (location: string) => void;
  onResolveMarkdownLink: (target: string) => Promise<string>;
  onSave: () => void;
  onStartEditing: () => void;
}) {
  return (
    <Box sx={{ bgcolor: "#ffffff", minHeight: "calc(100vh - 57px)", overflow: "hidden" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 2,
          flexWrap: "wrap",
          borderBottom: "1px solid #d0d7de",
          px: 2,
          py: 0.75,
        }}
      >
        {isEditing ? (
          <Stack direction="row" spacing={0.5}>
            <Button variant="text" size="small" onClick={onCancelEditing} disabled={isSaving}>
              キャンセル
            </Button>
            <Button variant="text" size="small" onClick={onSave} disabled={isSaving}>
              {isSaving ? "保存中" : "保存"}
            </Button>
          </Stack>
        ) : (
          <Button variant="text" size="small" onClick={onStartEditing}>
            編集
          </Button>
        )}
      </Box>

      <Box>
        {isEditing ? (
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
        ) : isVirtual ? (
          <Box sx={{ p: 2 }}>
            <Alert severity="info">このページはまだ作成されていません。</Alert>
          </Box>
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
