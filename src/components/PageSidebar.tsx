import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import {
  ArticleOutlined,
  CreateNewFolderOutlined,
  DeleteOutlined,
  InsertDriveFileOutlined,
  FolderOutlined,
  HelpOutlined,
  NoteAddOutlined,
  PublicOutlined,
  SortByAlphaOutlined,
  Star,
  StarBorder,
  TerminalRounded,
} from "@mui/icons-material";
import { RichTreeView } from "@mui/x-tree-view/RichTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import type { TreeItemProps } from "@mui/x-tree-view/TreeItem";
import { useEffect, useMemo, useState } from "react";

import type {
  ContentTree,
  FileSummary,
  FolderSummary,
  NamespaceSummary,
} from "../api/tauriCommands";
import type { AppCommand } from "../lib/commandRegistry";
import type { ShortcutBindings } from "../lib/keyboardShortcuts";
import { CommandLauncher } from "./CommandLauncher";
import { ResizableSidebar } from "./ResizableSidebar";

type PageTreeItem = {
  id: string;
  label: string;
  location: string | null;
  path: string | null;
  kind: "page" | "folder" | "file";
  isFavorite: boolean;
  children?: PageTreeItem[];
};

type PageTreeItemMetadata = {
  kind: PageTreeItem["kind"];
  location: string | null;
  path: string | null;
  isFavorite: boolean;
};

export function PageSidebar({
  content,
  currentLocation,
  namespace,
  searchOpenRequestId = 0,
  commands,
  shortcutBindings,
  onCreateFolder,
  onCreatePage,
  onDeleteContent,
  onOpenLocation,
  onExecuteCommand,
  onToggleTerminal,
  onToggleFavorite,
}: {
  content: ContentTree | null;
  currentLocation: string;
  namespace: NamespaceSummary | null;
  searchOpenRequestId?: number;
  commands: AppCommand[];
  shortcutBindings: ShortcutBindings;
  onCreateFolder: (parentDirectory: string) => void;
  onCreatePage: (parentDirectory: string) => void;
  onDeleteContent: (path: string, kind: "page" | "folder" | "file") => void;
  onOpenLocation: (location: string) => void;
  onExecuteCommand: (commandId: string) => void;
  onToggleTerminal: () => void;
  onToggleFavorite: (path: string, isFavorite: boolean) => void;
}) {
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const folders = content?.folders ?? [];
  const pages = content?.pages ?? [];
  const files = content?.files ?? [];
  const treeItems = useMemo(
    () => buildTreeItems(folders, pages, files, sortDirection),
    [files, folders, pages, sortDirection],
  );
  const expandableItemIds = useMemo(() => collectExpandableItemIds(treeItems), [treeItems]);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const itemMetadata = useMemo(() => collectItemMetadata(treeItems), [treeItems]);
  const selectedLocationItem = useMemo(() => {
    for (const [itemId, metadata] of itemMetadata) {
      if (metadata.location === currentLocation) {
        return itemId;
      }
    }
    return null;
  }, [currentLocation, itemMetadata]);
  const selectedItem = activeItemId ?? selectedLocationItem;
  const createParentDirectory = selectedItem
    ? parentDirectoryForItem(itemMetadata.get(selectedItem) ?? null)
    : "";
  const TreeViewItem = useMemo(
    () =>
      function TreeViewItemWithActions(props: TreeItemProps) {
        return (
          <PageTreeViewItem
            {...props}
            metadata={itemMetadata.get(props.itemId) ?? null}
            onDeleteContent={onDeleteContent}
            onToggleFavorite={onToggleFavorite}
          />
        );
      },
    [itemMetadata, onDeleteContent, onToggleFavorite],
  );

  useEffect(() => {
    setExpandedItems((current) => mergeExpandedItemIds(current, expandableItemIds));
  }, [expandableItemIds]);

  useEffect(() => {
    if (selectedLocationItem) {
      setActiveItemId(selectedLocationItem);
    }
  }, [selectedLocationItem]);

  return (
    <ResizableSidebar>
      <SidebarToolbar
        canCreate={namespace !== null}
        searchNamespaceId={namespace?.id ?? null}
        searchOpenRequestId={searchOpenRequestId}
        commands={commands}
        shortcutBindings={shortcutBindings}
        sortDirection={sortDirection}
        onCreateFolder={() => onCreateFolder(createParentDirectory)}
        onCreatePage={() => onCreatePage(createParentDirectory)}
        onOpenLocation={onOpenLocation}
        onExecuteCommand={onExecuteCommand}
        onToggleTerminal={onToggleTerminal}
        onToggleSortDirection={() =>
          setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
        }
      />
      <Box sx={{ flexGrow: 1, minHeight: 0, overflow: "auto", py: 1 }}>
        {treeItems.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
            コンテンツはまだありません。
          </Typography>
        ) : (
          <RichTreeView
            aria-label="ページ一覧"
            expandedItems={expandedItems}
            expansionTrigger="iconContainer"
            itemChildrenIndentation={18}
            items={treeItems}
            selectedItems={selectedItem}
            slots={{ item: TreeViewItem }}
            onExpandedItemsChange={(_, itemIds) => setExpandedItems(itemIds)}
            onItemClick={(_, itemId) => {
              setActiveItemId(itemId);
              const location = itemMetadata.get(itemId)?.location;
              if (location) {
                onOpenLocation(location);
              }
            }}
            sx={{
              px: 1,
              "& .MuiTreeItem-content": {
                borderRadius: 1,
                minHeight: 28,
                pr: 1,
              },
              "& .MuiTreeItem-label": {
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              },
            }}
          />
        )}
      </Box>
    </ResizableSidebar>
  );
}

type SortDirection = "asc" | "desc";

function SidebarToolbar({
  canCreate,
  searchNamespaceId,
  searchOpenRequestId,
  commands,
  shortcutBindings,
  sortDirection,
  onCreateFolder,
  onCreatePage,
  onOpenLocation,
  onExecuteCommand,
  onToggleTerminal,
  onToggleSortDirection,
}: {
  canCreate: boolean;
  searchNamespaceId: string | null;
  searchOpenRequestId: number;
  commands: AppCommand[];
  shortcutBindings: ShortcutBindings;
  sortDirection: SortDirection;
  onCreateFolder: () => void;
  onCreatePage: () => void;
  onOpenLocation: (location: string) => void;
  onExecuteCommand: (commandId: string) => void;
  onToggleTerminal: () => void;
  onToggleSortDirection: () => void;
}) {
  const sidebarActions = [
    {
      label: "フォルダー作成",
      Icon: CreateNewFolderOutlined,
      disabled: !canCreate,
      onClick: onCreateFolder,
    },
    { label: "ページ作成", Icon: NoteAddOutlined, disabled: !canCreate, onClick: onCreatePage },
    {
      label: "ソート",
      Icon: SortByAlphaOutlined,
      disabled: false,
      onClick: onToggleSortDirection,
      pressed: sortDirection === "desc",
      tooltip: sortDirection === "asc" ? "ソート: 昇順" : "ソート: 降順",
    },
  ];

  return (
    <Stack
      spacing={1}
      sx={{
        px: 1,
        py: 1,
      }}
    >
      <Typography variant="h6" component="h1" sx={{ fontSize: 16, fontWeight: 700 }}>
        Daibase
      </Typography>
      <Stack
        aria-label="サイドバーナビゲーション"
        direction="row"
        spacing={0.5}
        sx={{ alignItems: "center" }}
      >
        <CommandLauncher
          namespaceId={searchNamespaceId}
          openRequestId={searchOpenRequestId}
          commands={commands}
          shortcutBindings={shortcutBindings}
          onExecuteCommand={onExecuteCommand}
          onOpenLocation={onOpenLocation}
        />
        <Tooltip title="Favorites">
          <span>
            <IconButton
              aria-label="Favorites"
              disabled={!canCreate}
              size="small"
              onClick={() => onOpenLocation("Special:Favorites")}
            >
              <Star fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Special Pages">
          <span>
            <IconButton
              aria-label="Special Pages"
              disabled={!canCreate}
              size="small"
              onClick={() => onOpenLocation("Special:SpecialPages")}
            >
              <PublicOutlined fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="ヘルプ">
          <IconButton
            aria-label="ヘルプ"
            size="small"
            onClick={() => onOpenLocation("Special:Help")}
          >
            <HelpOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="ターミナル">
          <IconButton aria-label="ターミナル" size="small" onClick={onToggleTerminal}>
            <TerminalRounded fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Stack
        aria-label="サイドバー操作"
        direction="row"
        spacing={0.5}
        sx={{ alignItems: "center" }}
      >
        {sidebarActions.map((action) => (
          <Tooltip key={action.label} title={action.tooltip ?? action.label}>
            <span>
              <IconButton
                aria-label={action.label}
                aria-pressed={action.pressed}
                disabled={action.disabled}
                size="small"
                onClick={action.onClick}
              >
                <action.Icon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        ))}
      </Stack>
    </Stack>
  );
}

function PageTreeViewItem({
  metadata,
  onDeleteContent,
  onToggleFavorite,
  ...props
}: TreeItemProps & {
  metadata: PageTreeItemMetadata | null;
  onDeleteContent: (path: string, kind: "page" | "folder" | "file") => void;
  onToggleFavorite: (path: string, isFavorite: boolean) => void;
}) {
  const isFolderOnly = props.itemId.startsWith("folder:");
  const isFile = props.itemId.startsWith("file:");
  const canDelete =
    metadata?.path &&
    (metadata.kind === "page" || metadata.kind === "folder" || metadata.kind === "file");
  const canFavorite = metadata?.path && (metadata.kind === "page" || metadata.kind === "file");
  return (
    <TreeItem
      {...props}
      label={
        <Box
          component="span"
          sx={{
            alignItems: "center",
            display: "flex",
            gap: 0.75,
            minWidth: 0,
            width: "100%",
            "& .sidebar-row-action": {
              opacity: 0,
            },
            "&:hover .sidebar-row-action, &:focus-within .sidebar-row-action": {
              opacity: 1,
            },
          }}
        >
          <Box
            aria-hidden
            component="span"
            sx={{
              color: isFolderOnly ? "#9a6700" : isFile ? "#0969da" : "text.secondary",
              flex: "0 0 auto",
              height: 16,
              width: 16,
              "& svg": {
                display: "block",
                fontSize: 16,
              },
            }}
          >
            {isFolderOnly ? (
              <FolderOutlined />
            ) : isFile ? (
              <InsertDriveFileOutlined />
            ) : (
              <ArticleOutlined />
            )}
          </Box>
          <Box
            component="span"
            sx={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {props.label}
          </Box>
          {canFavorite && (
            <Tooltip title={metadata.isFavorite ? "お気に入り解除" : "お気に入り"}>
              <IconButton
                aria-label={metadata.isFavorite ? "お気に入り解除" : "お気に入り"}
                className="sidebar-row-action"
                size="small"
                sx={{
                  flex: "0 0 auto",
                  height: 22,
                  opacity: metadata.isFavorite ? 1 : undefined,
                  transition: "opacity 120ms ease",
                  width: 22,
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!metadata?.path || (metadata.kind !== "page" && metadata.kind !== "file")) {
                    return;
                  }
                  onToggleFavorite(metadata.path, !metadata.isFavorite);
                }}
              >
                {metadata.isFavorite ? (
                  <Star sx={{ color: "#bf8700", fontSize: 16 }} />
                ) : (
                  <StarBorder sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip title="削除">
              <IconButton
                aria-label="削除"
                className="sidebar-row-action"
                size="small"
                sx={{
                  flex: "0 0 auto",
                  height: 22,
                  transition: "opacity 120ms ease",
                  width: 22,
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (
                    !metadata?.path ||
                    (metadata.kind !== "page" &&
                      metadata.kind !== "folder" &&
                      metadata.kind !== "file")
                  ) {
                    return;
                  }
                  onDeleteContent(metadata.path, metadata.kind);
                }}
              >
                <DeleteOutlined sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      }
    />
  );
}

function buildTreeItems(
  folders: FolderSummary[],
  pages: FileSummary[],
  files: FileSummary[],
  sortDirection: SortDirection,
) {
  const root: PageTreeItem = {
    id: "__root__",
    label: "",
    location: null,
    path: null,
    kind: "folder",
    isFavorite: false,
    children: [],
  };

  for (const folder of folders) {
    insertTreeItem(root, folder.display_path.length > 0 ? folder.display_path : [folder.title], {
      id: `folder:${folder.path}`,
      label: folder.title,
      location: null,
      path: folder.path,
      kind: "folder",
      isFavorite: false,
    });
  }

  for (const page of pages) {
    insertTreeItem(root, page.display_path.length > 0 ? page.display_path : [page.title], {
      id: `page:${page.location}`,
      label: page.title,
      location: page.location,
      path: page.path,
      kind: "page",
      isFavorite: page.is_favorite,
    });
  }

  for (const file of files) {
    insertTreeItem(root, file.display_path.length > 0 ? file.display_path : [file.title], {
      id: `file:${file.location}`,
      label: file.title,
      location: file.location,
      path: file.path,
      kind: "file",
      isFavorite: file.is_favorite,
    });
  }

  sortTreeItems(root.children ?? [], sortDirection);
  return root.children ?? [];
}

function insertTreeItem(
  root: PageTreeItem,
  parts: string[],
  value: Pick<PageTreeItem, "id" | "label" | "location" | "path" | "kind" | "isFavorite">,
) {
  let current = root;
  let path = "";

  for (const part of parts.slice(0, -1)) {
    path = path ? `${path}/${part}` : part;
    const children = current.children ?? [];
    let child = children.find((item) => item.kind === "folder" && item.label === part);
    if (!child) {
      child = {
        id: `folder:${path}`,
        label: part,
        location: null,
        path,
        kind: "folder",
        isFavorite: false,
        children: [],
      };
      children.push(child);
      current.children = children;
    }
    current = child;
  }

  const children = current.children ?? [];
  const existing = children.find((item) => item.id === value.id);
  if (existing) {
    existing.label = value.label;
    existing.location = value.location;
    existing.path = value.path;
    existing.kind = value.kind;
    existing.isFavorite = value.isFavorite;
  } else {
    children.push({ ...value });
    current.children = children;
  }
}

function sortTreeItems(items: PageTreeItem[], sortDirection: SortDirection) {
  items.sort((left, right) => {
    const kindComparison = itemKindOrder(left.kind) - itemKindOrder(right.kind);
    if (kindComparison !== 0) {
      return kindComparison;
    }

    const labelComparison = left.label.localeCompare(right.label);
    return sortDirection === "asc" ? labelComparison : -labelComparison;
  });
  for (const item of items) {
    if (item.children) {
      sortTreeItems(item.children, sortDirection);
    }
  }
}

function itemKindOrder(kind: PageTreeItem["kind"]) {
  if (kind === "folder") {
    return 0;
  }
  if (kind === "page") {
    return 1;
  }
  return 2;
}

function collectExpandableItemIds(items: PageTreeItem[]) {
  const ids: string[] = [];

  for (const item of items) {
    if (item.children && item.children.length > 0) {
      ids.push(item.id);
      ids.push(...collectExpandableItemIds(item.children));
    }
  }

  return ids;
}

function mergeExpandedItemIds(current: string[], expandableItemIds: string[]) {
  const expandableSet = new Set(expandableItemIds);
  const next = [
    ...current.filter((itemId) => expandableSet.has(itemId)),
    ...expandableItemIds.filter((itemId) => !current.includes(itemId)),
  ];

  if (next.length === current.length && next.every((itemId, index) => itemId === current[index])) {
    return current;
  }

  return next;
}

function collectItemMetadata(items: PageTreeItem[]) {
  const metadata = new Map<string, PageTreeItemMetadata>();

  for (const item of items) {
    metadata.set(item.id, {
      kind: item.kind,
      isFavorite: item.isFavorite,
      location: item.location,
      path: item.path,
    });
    if (item.children) {
      for (const [itemId, itemMetadata] of collectItemMetadata(item.children)) {
        metadata.set(itemId, itemMetadata);
      }
    }
  }

  return metadata;
}

function parentDirectoryForItem(metadata: PageTreeItemMetadata | null) {
  if (!metadata?.path) {
    return "";
  }
  if (metadata.kind === "folder") {
    return metadata.path;
  }

  return directoryName(metadata.path);
}

function directoryName(path: string) {
  const separatorIndex = path.lastIndexOf("/");
  return separatorIndex === -1 ? "" : path.slice(0, separatorIndex);
}
