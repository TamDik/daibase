import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import type { ContentTree, NamespaceSummary } from "../api/tauriCommands";
import { pageLocation, pageTitle } from "../lib/location";

export function SpecialPagesIndex({
  namespace,
  onOpenLocation,
}: {
  namespace: NamespaceSummary;
  onOpenLocation: (location: string) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, bgcolor: "#ffffff" }}>
      <Box sx={{ borderBottom: "1px solid #d0d7de", px: 2, py: 1.5 }}>
        <Typography variant="h5" component="h2">
          Special Pages
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {namespace.name}:Special:SpecialPages
        </Typography>
      </Box>
      <Box sx={{ p: 3 }}>
        <List dense disablePadding>
          <ListItemButton
            onClick={() => onOpenLocation(`${namespace.name}:Special:SpecialPages`)}
            sx={{ borderRadius: 1 }}
          >
            <ListItemText primary="Special Pages" secondary="全ての Special ページを表示します。" />
          </ListItemButton>
          <ListItemButton
            onClick={() => onOpenLocation("Special:Namespaces")}
            sx={{ borderRadius: 1 }}
          >
            <ListItemText
              primary="Namespaces"
              secondary="登録済み namespace の確認と新規作成を行います。"
            />
          </ListItemButton>
          <ListItemButton
            onClick={() => onOpenLocation(`${namespace.name}:Special:Pages`)}
            sx={{ borderRadius: 1 }}
          >
            <ListItemText primary="Pages" secondary="namespace 内の全ページを表示します。" />
          </ListItemButton>
        </List>
      </Box>
    </Paper>
  );
}

export function NamespacesSpecialPage({
  namespaces,
  namespaceName,
  rootPath,
  onCreateNamespace,
  onNamespaceNameChange,
  onOpenLocation,
  onRootPathSelect,
}: {
  namespaces: NamespaceSummary[];
  namespaceName: string;
  rootPath: string;
  onCreateNamespace: () => void;
  onNamespaceNameChange: (value: string) => void;
  onOpenLocation: (location: string) => void;
  onRootPathSelect: () => void;
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, bgcolor: "#ffffff" }}>
      <Box sx={{ borderBottom: "1px solid #d0d7de", px: 2, py: 1.5 }}>
        <Typography variant="h5" component="h2">
          Namespaces
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Special:Namespaces
        </Typography>
      </Box>
      <Stack spacing={3} sx={{ p: 3 }}>
        <Box>
          {namespaces.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              まだ作成されていません。
            </Typography>
          ) : (
            <List dense disablePadding>
              {namespaces.map((namespace) => (
                <ListItemButton
                  key={namespace.id}
                  onClick={() => onOpenLocation(`${namespace.name}:Page:Main`)}
                  sx={{ borderRadius: 1 }}
                >
                  <ListItemText
                    primary={namespace.name}
                    secondary={`${namespace.name}:Special:Pages`}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>

        <Divider />

        <Stack spacing={1.5} sx={{ maxWidth: 560 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            新規作成
          </Typography>
          <TextField
            label="名前"
            size="small"
            value={namespaceName}
            onChange={(event) => onNamespaceNameChange(event.target.value)}
          />
          <Stack direction="row" spacing={1}>
            <TextField
              label="保存先フォルダ"
              size="small"
              value={rootPath}
              placeholder="未選択"
              slotProps={{
                input: {
                  readOnly: true,
                },
              }}
              sx={{ flex: 1 }}
            />
            <Button variant="outlined" onClick={onRootPathSelect}>
              選択
            </Button>
          </Stack>
          <Button
            variant="contained"
            onClick={onCreateNamespace}
            disabled={!namespaceName.trim() || !rootPath.trim()}
          >
            作成
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

export function PagesSpecialPage({
  namespace,
  content,
  onOpenLocation,
}: {
  namespace: NamespaceSummary;
  content: ContentTree;
  onOpenLocation: (location: string) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, bgcolor: "#ffffff" }}>
      <Box sx={{ borderBottom: "1px solid #d0d7de", px: 2, py: 1.5 }}>
        <Typography variant="h5" component="h2">
          Pages
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {namespace.name}:Special:Pages
        </Typography>
      </Box>
      <Box sx={{ p: 3 }}>
        {content.pages.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            ページはまだありません。
          </Typography>
        ) : (
          <List dense disablePadding>
            {content.pages.map((item) => (
              <ListItemButton
                key={item.path}
                onClick={() => onOpenLocation(pageLocation(item.path, namespace))}
                sx={{ borderRadius: 1 }}
              >
                <ListItemText
                  primary={pageTitle(item.path)}
                  secondary={pageLocation(item.path, namespace)}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Paper>
  );
}
