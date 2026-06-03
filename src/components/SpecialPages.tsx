import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { ExtensionOutlined, FolderOpenOutlined, RestoreOutlined } from "@mui/icons-material";

import type {
  CategoryGroupSummary,
  CategoryPageSummary,
  ContentTree,
  DeletedContentSummary,
  FavoriteContentSummary,
  InstalledPluginSummary,
  NamespaceSummary,
  SpecialPageSummary,
} from "../api/tauriCommands";

export function SpecialPagesIndex({
  location,
  pages,
  onOpenLocation,
}: {
  location: string;
  pages: SpecialPageSummary[];
  onOpenLocation: (location: string) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, bgcolor: "#ffffff" }}>
      <Box sx={{ borderBottom: "1px solid #d0d7de", px: 2, py: 1.5 }}>
        <Typography variant="h5" component="h2">
          Special Pages
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {location}
        </Typography>
      </Box>
      <Box sx={{ p: 3 }}>
        <List dense disablePadding>
          {pages.map((page) => (
            <ListItemButton
              key={page.location}
              onClick={() => onOpenLocation(page.location)}
              sx={{ borderRadius: 1 }}
            >
              <ListItemText primary={page.title} secondary={page.description} />
            </ListItemButton>
          ))}
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
                  onClick={() => onOpenLocation(namespace.default_location)}
                  sx={{ borderRadius: 1 }}
                >
                  <ListItemText primary={namespace.name} secondary={namespace.pages_location} />
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
                onClick={() => onOpenLocation(item.location)}
                sx={{ borderRadius: 1 }}
              >
                <ListItemText primary={item.title} secondary={item.location} />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Paper>
  );
}

export function DeletedPagesSpecialPage({
  items,
  namespace,
  onOpenDeletedContent,
  onRestoreDeletedContent,
}: {
  items: DeletedContentSummary[];
  namespace: NamespaceSummary;
  onOpenDeletedContent: (item: DeletedContentSummary) => void;
  onRestoreDeletedContent: (item: DeletedContentSummary) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, bgcolor: "#ffffff" }}>
      <Box sx={{ borderBottom: "1px solid #d0d7de", px: 2, py: 1.5 }}>
        <Typography variant="h5" component="h2">
          Deleted Pages
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {namespace.name}:Special:DeletedPages
        </Typography>
      </Box>
      <Box sx={{ p: 3 }}>
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            削除済みのページやファイルはありません。
          </Typography>
        ) : (
          <List dense disablePadding>
            {items.map((item) => (
              <Box
                key={`${item.file_id}:${item.latest_revision_id}`}
                sx={{
                  alignItems: "center",
                  borderRadius: 1,
                  display: "flex",
                  gap: 0.5,
                }}
              >
                <ListItemButton
                  onClick={() => onOpenDeletedContent(item)}
                  sx={{ borderRadius: 1, minWidth: 0 }}
                >
                  <ListItemText
                    primary={item.title}
                    secondary={`${item.content_kind === "page" ? "Page" : "File"} / ${item.path} / ${formatDeletedTime(item.deleted_at)}`}
                  />
                </ListItemButton>
                <Tooltip title="復活">
                  <IconButton
                    aria-label={`${item.title} を復活`}
                    size="small"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onRestoreDeletedContent(item);
                    }}
                  >
                    <RestoreOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </List>
        )}
      </Box>
    </Paper>
  );
}

export function FavoritesSpecialPage({
  items,
  namespace,
  onOpenLocation,
}: {
  items: FavoriteContentSummary[];
  namespace: NamespaceSummary;
  onOpenLocation: (location: string) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, bgcolor: "#ffffff" }}>
      <Box sx={{ borderBottom: "1px solid #d0d7de", px: 2, py: 1.5 }}>
        <Typography variant="h5" component="h2">
          Favorites
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {namespace.name}:Special:Favorites
        </Typography>
      </Box>
      <Box sx={{ p: 3 }}>
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            お気に入りのページやファイルはありません。
          </Typography>
        ) : (
          <List dense disablePadding>
            {items.map((item) => (
              <ListItemButton
                key={`${item.content_kind}:${item.path}`}
                onClick={() => onOpenLocation(item.location)}
                sx={{ borderRadius: 1 }}
              >
                <ListItemText
                  primary={item.title}
                  secondary={`${item.content_kind === "page" ? "Page" : "File"} / ${item.path}`}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Paper>
  );
}

export function CategoriesSpecialPage({
  categories,
  namespace,
  uncategorizedPages,
  onOpenLocation,
}: {
  categories: CategoryGroupSummary[];
  namespace: NamespaceSummary;
  uncategorizedPages: CategoryPageSummary[];
  onOpenLocation: (location: string) => void;
}) {
  const hasPages = categories.length > 0 || uncategorizedPages.length > 0;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, bgcolor: "#ffffff" }}>
      <Box sx={{ borderBottom: "1px solid #d0d7de", px: 2, py: 1.5 }}>
        <Typography variant="h5" component="h2">
          Categories
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {namespace.name}:Special:Categories
        </Typography>
      </Box>
      <Stack spacing={3} sx={{ p: 3 }}>
        {!hasPages ? (
          <Typography variant="body2" color="text.secondary">
            カテゴリ付きのページはまだありません。
          </Typography>
        ) : (
          <>
            {categories.map((category) => (
              <Box key={category.name}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {category.name}
                </Typography>
                <CategoryPageList pages={category.pages} onOpenLocation={onOpenLocation} />
              </Box>
            ))}
            {uncategorizedPages.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  未分類
                </Typography>
                <CategoryPageList pages={uncategorizedPages} onOpenLocation={onOpenLocation} />
              </Box>
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
}

export function PluginsSpecialPage({
  plugins,
  namespace,
  onInstallFromFolder,
  onTogglePlugin,
}: {
  plugins: InstalledPluginSummary[];
  namespace: NamespaceSummary;
  onInstallFromFolder: () => void;
  onTogglePlugin: (plugin: InstalledPluginSummary, enabled: boolean) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, bgcolor: "#ffffff" }}>
      <Box sx={{ borderBottom: "1px solid #d0d7de", px: 2, py: 1.5 }}>
        <Typography variant="h5" component="h2">
          Plugins
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {namespace.name}:Special:Plugins
        </Typography>
      </Box>
      <Stack spacing={2.5} sx={{ p: 3 }}>
        <Box>
          <Button
            variant="contained"
            startIcon={<FolderOpenOutlined fontSize="small" />}
            onClick={onInstallFromFolder}
          >
            フォルダからインストール
          </Button>
        </Box>

        <Divider />

        {plugins.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            インストール済みプラグインはありません。
          </Typography>
        ) : (
          <List dense disablePadding>
            {plugins.map((plugin) => (
              <Box
                key={plugin.id}
                sx={{
                  alignItems: "center",
                  borderRadius: 1,
                  display: "flex",
                  gap: 1,
                  px: 1,
                  py: 0.75,
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <ExtensionOutlined color="action" fontSize="small" />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", flexWrap: "wrap" }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {plugin.name}
                    </Typography>
                    <Chip size="small" label={plugin.version} />
                    <Chip
                      color={plugin.enabled ? "success" : "default"}
                      size="small"
                      label={plugin.enabled ? "有効" : "無効"}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {plugin.description || plugin.id}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="div">
                    {sourceLabel(plugin)}
                  </Typography>
                  {plugin.manifest.permissions.length > 0 && (
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", mt: 0.5 }}>
                      {plugin.manifest.permissions.map((permission) => (
                        <Chip key={permission} size="small" variant="outlined" label={permission} />
                      ))}
                    </Stack>
                  )}
                </Box>
                <Switch
                  edge="end"
                  checked={plugin.enabled}
                  slotProps={{ input: { "aria-label": `${plugin.name} を有効化` } }}
                  onChange={(event) => onTogglePlugin(plugin, event.target.checked)}
                />
              </Box>
            ))}
          </List>
        )}
      </Stack>
    </Paper>
  );
}

function CategoryPageList({
  pages,
  onOpenLocation,
}: {
  pages: CategoryPageSummary[];
  onOpenLocation: (location: string) => void;
}) {
  return (
    <List dense disablePadding>
      {pages.map((page) => (
        <ListItemButton
          key={page.path}
          onClick={() => onOpenLocation(page.location)}
          sx={{ borderRadius: 1 }}
        >
          <ListItemText primary={page.title} secondary={page.location} />
        </ListItemButton>
      ))}
    </List>
  );
}

function sourceLabel(plugin: InstalledPluginSummary) {
  if (plugin.source.kind === "localFolder") {
    return `Local folder / ${plugin.source.path}`;
  }
  return plugin.source.kind;
}

function formatDeletedTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}
