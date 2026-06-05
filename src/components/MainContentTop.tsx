import { Box, IconButton, Stack, Tooltip } from "@mui/material";
import { ArrowBackRounded, ArrowForwardRounded } from "@mui/icons-material";
import type { ReactNode } from "react";

export function MainContentTop({
  canGoBack,
  canGoForward,
  rightSlot,
  onGoBack,
  onGoForward,
}: {
  canGoBack: boolean;
  canGoForward: boolean;
  rightSlot?: ReactNode;
  onGoBack: () => void;
  onGoForward: () => void;
}) {
  return (
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        flex: "0 0 auto",
        minHeight: 36,
        px: 1.5,
      }}
    >
      <Stack direction="row" spacing={0.25} sx={{ alignItems: "center", mr: 1 }}>
        <Tooltip title="戻る">
          <span>
            <IconButton aria-label="戻る" disabled={!canGoBack} size="small" onClick={onGoBack}>
              <ArrowBackRounded fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="進む">
          <span>
            <IconButton
              aria-label="進む"
              disabled={!canGoForward}
              size="small"
              onClick={onGoForward}
            >
              <ArrowForwardRounded fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <Box sx={{ alignItems: "center", display: "flex", flex: 1, minWidth: 0 }}>{rightSlot}</Box>
    </Box>
  );
}
