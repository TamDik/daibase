import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

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
        <Button
          variant="outlined"
          size="small"
          onClick={onGoBack}
          disabled={!canGoBack}
          sx={{ minWidth: 40 }}
        >
          &lt;
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={onGoForward}
          disabled={!canGoForward}
          sx={{ minWidth: 40 }}
        >
          &gt;
        </Button>
        <TextField
          aria-label="現在のロケーション"
          size="small"
          value={locationInput}
          onChange={(event) => onLocationChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onLocationSubmit();
            }
          }}
          sx={{ flex: 1 }}
        />
        <Button variant="outlined" size="small" onClick={onLocationSubmit}>
          開く
        </Button>
      </Stack>
    </Box>
  );
}
