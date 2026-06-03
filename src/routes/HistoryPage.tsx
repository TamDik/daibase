import { ArrowBackRounded } from "@mui/icons-material";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { type PageHistorySnapshot, readPageHistorySnapshot } from "../api/tauriCommands";
import { SideBySideDiffView } from "../components/SideBySideDiffView";

export function HistoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const namespaceId = searchParams.get("namespaceId") ?? "";
  const path = searchParams.get("path") ?? "";
  const revisionId = searchParams.get("revisionId") ?? "";
  const [snapshot, setSnapshot] = useState<PageHistorySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSnapshot = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (!namespaceId || !path || !revisionId) {
          throw new Error("履歴の表示に必要な情報が足りません。");
        }

        setSnapshot(await readPageHistorySnapshot(namespaceId, path, revisionId));
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setIsLoading(false);
      }
    };

    void loadSnapshot();
  }, [namespaceId, path, revisionId]);

  return (
    <Box sx={{ bgcolor: "#ffffff", minHeight: "100vh" }}>
      <Box
        component="header"
        sx={{
          borderBottom: "1px solid #d0d7de",
          px: 2,
          py: 1,
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Button startIcon={<ArrowBackRounded />} variant="text" onClick={() => navigate(-1)}>
            戻る
          </Button>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" component="h1" sx={{ fontWeight: 700 }}>
              編集履歴
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {path}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box component="main" sx={{ px: 2, py: 2 }}>
        {isLoading ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              読み込み中
            </Typography>
          </Stack>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : snapshot ? (
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {formatHistoryTime(snapshot.entry.created_at)} /{" "}
              {shortenHash(snapshot.entry.object_id)}
            </Typography>
            <SideBySideDiffView sections={snapshot.diff_sections} />
          </Stack>
        ) : null}
      </Box>
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

function errorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "エラーが発生しました。";
}
