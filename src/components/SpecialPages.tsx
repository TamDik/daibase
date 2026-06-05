import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
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
import {
  ArticleOutlined,
  CloseOutlined,
  DeleteOutlined,
  ExtensionOutlined,
  FolderOpenOutlined,
  RestoreOutlined,
} from "@mui/icons-material";
import { useState } from "react";

import type {
  CategoryGroupSummary,
  CategoryPageSummary,
  ContentTree,
  DeletedContentSummary,
  FavoriteContentSummary,
  PluginDocumentation,
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
  onReadPluginDocumentation,
  onRemovePlugin,
  onTogglePlugin,
}: {
  plugins: InstalledPluginSummary[];
  namespace: NamespaceSummary;
  onInstallFromFolder: () => void;
  onReadPluginDocumentation: (plugin: InstalledPluginSummary) => Promise<PluginDocumentation>;
  onRemovePlugin: (plugin: InstalledPluginSummary) => void;
  onTogglePlugin: (plugin: InstalledPluginSummary, enabled: boolean) => void;
}) {
  const [documentationState, setDocumentationState] = useState<
    | { kind: "closed" }
    | { kind: "loading"; plugin: InstalledPluginSummary }
    | { kind: "loaded"; documentation: PluginDocumentation; plugin: InstalledPluginSummary }
    | { kind: "error"; message: string; plugin: InstalledPluginSummary }
  >({ kind: "closed" });

  const handleOpenDocumentation = (plugin: InstalledPluginSummary) => {
    setDocumentationState({ kind: "loading", plugin });
    onReadPluginDocumentation(plugin)
      .then((documentation) => {
        setDocumentationState({ kind: "loaded", documentation, plugin });
      })
      .catch((error: unknown) => {
        setDocumentationState({
          kind: "error",
          message: error instanceof Error ? error.message : String(error),
          plugin,
        });
      });
  };

  const documentationPlugin =
    documentationState.kind === "closed" ? null : documentationState.plugin;
  const [pluginToRemove, setPluginToRemove] = useState<InstalledPluginSummary | null>(null);

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
            フォルダを登録
          </Button>
        </Box>

        <Divider />

        {plugins.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            登録済みプラグインはありません。
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
                    {plugin.load_error && (
                      <Chip color="error" size="small" variant="outlined" label="読み込みエラー" />
                    )}
                  </Stack>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {plugin.description || plugin.id}
                  </Typography>
                  {plugin.load_error && (
                    <Typography variant="caption" color="error" component="div">
                      {plugin.load_error}
                    </Typography>
                  )}
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
                <Tooltip title="ドキュメント">
                  <span>
                    <IconButton
                      edge="end"
                      aria-label={`${plugin.name} のドキュメントを表示`}
                      onClick={() => handleOpenDocumentation(plugin)}
                    >
                      <ArticleOutlined fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="削除">
                  <span>
                    <IconButton
                      edge="end"
                      aria-label={`${plugin.name} を削除`}
                      onClick={() => setPluginToRemove(plugin)}
                    >
                      <DeleteOutlined fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
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
      <Dialog
        fullWidth
        maxWidth="md"
        open={documentationState.kind !== "closed"}
        onClose={() => setDocumentationState({ kind: "closed" })}
        slotProps={{
          paper: {
            "aria-label": documentationPlugin?.name ?? "Plugin documentation",
          },
        }}
      >
        <DialogTitle
          id="plugin-documentation-title"
          sx={{ alignItems: "center", display: "flex", gap: 1, pr: 6 }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="span" variant="h6">
              {documentationPlugin?.name ?? "Plugin documentation"}
            </Typography>
            <Typography color="text.secondary" component="div" variant="caption">
              README.md
            </Typography>
          </Box>
          <IconButton
            aria-label="ドキュメントを閉じる"
            onClick={() => setDocumentationState({ kind: "closed" })}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseOutlined fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {documentationState.kind === "loading" && (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", py: 2 }}>
              <CircularProgress size={18} />
              <Typography color="text.secondary" variant="body2">
                ドキュメントを読み込んでいます。
              </Typography>
            </Stack>
          )}
          {documentationState.kind === "error" && (
            <Typography color="text.secondary" variant="body2">
              {documentationState.message}
            </Typography>
          )}
          {documentationState.kind === "loaded" && (
            <PluginMarkdownDocument markdown={documentationState.documentation.markdown} />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={pluginToRemove !== null}
        onClose={() => setPluginToRemove(null)}
        slotProps={{
          paper: {
            "aria-label": pluginToRemove ? `${pluginToRemove.name} を削除` : "プラグインを削除",
          },
        }}
      >
        <DialogTitle>プラグインを削除</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {pluginToRemove?.name} の登録を削除します。ローカルフォルダのファイルは削除されません。
          </Typography>
        </DialogContent>
        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", px: 3, pb: 2 }}>
          <Button onClick={() => setPluginToRemove(null)}>キャンセル</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (pluginToRemove) {
                onRemovePlugin(pluginToRemove);
              }
              setPluginToRemove(null);
            }}
          >
            削除
          </Button>
        </Stack>
      </Dialog>
    </Paper>
  );
}

function PluginMarkdownDocument({ markdown }: { markdown: string }) {
  return (
    <Stack spacing={1.25} sx={{ "& pre": { overflowX: "auto" } }}>
      {markdownBlocks(markdown).map((block, index) => {
        if (block.kind === "heading") {
          return (
            <Typography
              key={index}
              component={`h${block.level}` as "h1"}
              variant={block.level === 1 ? "h5" : "h6"}
              sx={{ fontWeight: 700, mt: index === 0 ? 0 : 1 }}
            >
              {block.text}
            </Typography>
          );
        }
        if (block.kind === "list") {
          return (
            <Box key={index} component="ul" sx={{ m: 0, pl: 3 }}>
              {block.items.map((item, itemIndex) => (
                <Typography key={itemIndex} component="li" variant="body2">
                  <InlineMarkdown text={item} />
                </Typography>
              ))}
            </Box>
          );
        }
        if (block.kind === "code") {
          return (
            <Box
              key={index}
              component="pre"
              sx={{
                bgcolor: "#f6f8fa",
                border: "1px solid #d0d7de",
                borderRadius: 1,
                fontFamily: "monospace",
                fontSize: 13,
                m: 0,
                p: 1.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {block.text}
            </Box>
          );
        }
        return (
          <Typography key={index} variant="body2">
            <InlineMarkdown text={block.text} />
          </Typography>
        );
      })}
    </Stack>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("`") && part.endsWith("`") ? (
          <Box
            key={index}
            component="code"
            sx={{
              bgcolor: "#f6f8fa",
              borderRadius: 0.5,
              fontFamily: "monospace",
              fontSize: "0.9em",
              px: 0.5,
            }}
          >
            {part.slice(1, -1)}
          </Box>
        ) : (
          part
        ),
      )}
    </>
  );
}

type MarkdownBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "code"; text: string };

function markdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: string[] = [];
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push({ kind: "list", items: list });
      list = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      if (code === null) {
        code = [];
      } else {
        blocks.push({ kind: "code", text: code.join("\n") });
        code = null;
      }
      continue;
    }
    if (code !== null) {
      code.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (trimmed === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      continue;
    }

    const listMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    if (listMatch) {
      flushParagraph();
      list.push(listMatch[1]);
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  if (code !== null) {
    blocks.push({ kind: "code", text: code.join("\n") });
  }
  flushParagraph();
  flushList();

  return blocks;
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
