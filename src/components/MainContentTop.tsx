import { Box, IconButton, Stack, Tooltip } from "@mui/material";
import { ArrowBackRounded, ArrowForwardRounded, TerminalRounded } from "@mui/icons-material";
import type { ReactNode } from "react";

import { CommandLauncher } from "./CommandLauncher";

export function MainContentTop({
  canGoBack,
  canGoForward,
  searchNamespaceId,
  rightSlot,
  onGoBack,
  onGoForward,
  onOpenLocation,
  onToggleTerminal,
}: {
  canGoBack: boolean;
  canGoForward: boolean;
  searchNamespaceId: string | null;
  rightSlot?: ReactNode;
  onGoBack: () => void;
  onGoForward: () => void;
  onOpenLocation: (location: string) => void;
  onToggleTerminal: () => void;
}) {
  return (
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        flex: "0 0 auto",
        px: 1.5,
        pt: 0.5,
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
        <Tooltip title="ターミナル">
          <IconButton aria-label="ターミナル" size="small" onClick={onToggleTerminal}>
            <TerminalRounded fontSize="small" />
          </IconButton>
        </Tooltip>
        <CommandLauncher namespaceId={searchNamespaceId} onOpenLocation={onOpenLocation} />
      </Stack>
      <Box sx={{ alignItems: "center", display: "flex", flex: 1, minWidth: 0 }}>{rightSlot}</Box>
    </Box>
  );
}
