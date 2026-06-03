import { ContentCopy as ContentCopyIcon } from "@mui/icons-material";
import { Box, IconButton, Snackbar, Tooltip, Typography } from "@mui/material";
import { useEffect, useState } from "react";

import { getMcpServerStatus, type McpServerStatus } from "../api/tauriCommands";

const MCP_BANNER_DURATION_MS = 8000;

export function McpServerBanner() {
  const [status, setStatus] = useState<McpServerStatus | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getMcpServerStatus()
      .then((nextStatus) => {
        if (!isMounted || !nextStatus.enabled) {
          return;
        }
        setStatus(nextStatus);
        setOpen(true);
      })
      .catch(() => {
        // MCP は補助機能なので、状態取得に失敗しても通常の画面表示は続けます。
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopyUrl = () => {
    if (!status?.url) {
      return;
    }
    void navigator.clipboard?.writeText(status.url);
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={MCP_BANNER_DURATION_MS}
      onClose={() => setOpen(false)}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Box
        role="status"
        sx={{
          alignItems: "center",
          bgcolor: "#0d1117",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 1,
          boxShadow: "0 10px 30px rgba(0,0,0,0.28)",
          color: "#f0f6fc",
          display: "flex",
          gap: 1.5,
          maxWidth: "calc(100vw - 32px)",
          minHeight: 40,
          px: 1.5,
          py: 0.75,
          whiteSpace: "nowrap",
        }}
      >
        <Typography
          component="span"
          variant="body2"
          sx={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          MCP server enabled on {status?.url}
        </Typography>
        <Tooltip title="Copy URL">
          <IconButton
            aria-label="Copy MCP server URL"
            color="inherit"
            size="small"
            onClick={handleCopyUrl}
            sx={{
              flex: "0 0 auto",
              height: 28,
              width: 28,
            }}
          >
            <ContentCopyIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      </Box>
    </Snackbar>
  );
}
