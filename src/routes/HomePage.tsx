import { invoke } from "@tauri-apps/api/core";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState } from "react";

export function HomePage() {
  const [message, setMessage] = useState("Click the button to call Rust.");

  const handleClick = async () => {
    const response = await invoke<string>("greet", { name: "Tauri" });
    setMessage(response);
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Stack spacing={3} sx={{ alignItems: "flex-start" }}>
        <Typography variant="h3" component="h1">
          Hello World
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Tauri v2, React, react-router v7, MUI, and TypeScript are ready.
        </Typography>
        <Button variant="contained" onClick={handleClick}>
          Call Tauri command
        </Button>
        <Typography variant="body1">{message}</Typography>
      </Stack>
    </Container>
  );
}
