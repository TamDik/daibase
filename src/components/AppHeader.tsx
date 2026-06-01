import {
  Box,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import SubdirectoryArrowLeftRoundedIcon from "@mui/icons-material/SubdirectoryArrowLeftRounded";

export function AppHeader({
  canGoBack,
  canGoForward,
  locationInput,
  onGoBack,
  onGoForward,
  onLocationChange,
  onLocationSubmit,
}: {
  canGoBack: boolean;
  canGoForward: boolean;
  locationInput: string;
  onGoBack: () => void;
  onGoForward: () => void;
  onLocationChange: (value: string) => void;
  onLocationSubmit: () => void;
}) {
  return (
    <Box
      component="header"
      sx={{
        borderBottom: "1px solid #d0d7de",
        bgcolor: "#ffffff",
        px: 2,
        py: 1.25,
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Typography variant="h6" component="h1" sx={{ fontWeight: 700 }}>
          Daibase
        </Typography>
        <Box
          sx={{
            alignItems: "center",
            bgcolor: "#ffffff",
            border: "1px solid #d0d7de",
            borderRadius: 2,
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.8)",
            display: "flex",
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            transition: "border-color 120ms ease, box-shadow 120ms ease",
            "&:focus-within": {
              borderColor: "#0969da",
              boxShadow: "0 0 0 3px rgba(9, 105, 218, 0.16)",
            },
          }}
        >
          <Stack direction="row" spacing={0.25} sx={{ px: 0.5 }}>
            <Tooltip title="戻る">
              <span>
                <IconButton aria-label="戻る" size="small" onClick={onGoBack} disabled={!canGoBack}>
                  <ArrowBackRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="進む">
              <span>
                <IconButton
                  aria-label="進む"
                  size="small"
                  onClick={onGoForward}
                  disabled={!canGoForward}
                >
                  <ArrowForwardRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
          <Divider flexItem orientation="vertical" />
          <TextField
            aria-label="現在のロケーション"
            variant="standard"
            value={locationInput}
            onChange={(event) => onLocationChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onLocationSubmit();
              }
            }}
            slotProps={{
              input: {
                disableUnderline: true,
              },
            }}
            sx={{
              flex: 1,
              minWidth: 0,
              px: 1.25,
              py: 0.5,
              "& .MuiInputBase-input": {
                fontSize: 14,
                lineHeight: 1.5,
                py: 0.25,
              },
            }}
          />
          <Divider flexItem orientation="vertical" />
          <Tooltip title="開く">
            <IconButton
              aria-label="開く"
              size="small"
              onClick={onLocationSubmit}
              sx={{ borderRadius: 0, flex: "0 0 auto", height: 38, width: 42 }}
            >
              <SubdirectoryArrowLeftRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Stack>
    </Box>
  );
}
