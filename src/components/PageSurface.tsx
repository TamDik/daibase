import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import type { PageContent } from "../api/tauriCommands";
import { MarkdownPreview } from "./MarkdownPreview";

export function PageSurface({
  draft,
  isEditing,
  isSaving,
  page,
  previewContent,
  onCancelEditing,
  onDraftChange,
  onOpenLocation,
  onResolveMarkdownLink,
  onSave,
  onStartEditing,
}: {
  draft: string;
  isEditing: boolean;
  isSaving: boolean;
  page: PageContent;
  previewContent: string;
  onCancelEditing: () => void;
  onDraftChange: (value: string) => void;
  onOpenLocation: (location: string) => void;
  onResolveMarkdownLink: (target: string) => Promise<string>;
  onSave: () => void;
  onStartEditing: () => void;
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, bgcolor: "#ffffff", overflow: "hidden" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
          borderBottom: "1px solid #d0d7de",
          px: 2,
          py: 1.5,
        }}
      >
        <Box>
          <Typography variant="h5" component="h2">
            {page.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {page.location}
          </Typography>
        </Box>
        {isEditing ? (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={onCancelEditing} disabled={isSaving}>
              キャンセル
            </Button>
            <Button variant="contained" onClick={onSave} disabled={isSaving}>
              {isSaving ? "保存中" : "保存"}
            </Button>
          </Stack>
        ) : (
          <Button variant="contained" onClick={onStartEditing}>
            編集
          </Button>
        )}
      </Box>

      <Box sx={{ p: 3 }}>
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
        ) : (
          <MarkdownPreview
            markdown={previewContent}
            onOpenLocation={onOpenLocation}
            onResolveMarkdownLink={onResolveMarkdownLink}
          />
        )}
      </Box>
    </Paper>
  );
}
