import { Box, Typography } from "@mui/material";
import { ArticleOutlined, InsertDriveFileOutlined, FolderOutlined } from "@mui/icons-material";
import { RichTreeView } from "@mui/x-tree-view/RichTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import type { TreeItemProps } from "@mui/x-tree-view/TreeItem";
import { useMemo } from "react";

import type {
  ContentTree,
  FileSummary,
  FolderSummary,
  NamespaceSummary,
} from "../api/tauriCommands";
import { ResizableSidebar } from "./ResizableSidebar";

type PageTreeItem = {
  id: string;
  label: string;
  location: string | null;
  kind: "page" | "folder" | "file";
  children?: PageTreeItem[];
};

export function PageSidebar({
  content,
  currentLocation,
  onOpenLocation,
}: {
  content: ContentTree | null;
  currentLocation: string;
  namespace: NamespaceSummary | null;
  onOpenLocation: (location: string) => void;
}) {
  const pages = content?.pages ?? [];
  const folders = content?.folders ?? [];
  const files = content?.files ?? [];
  const treeItems = useMemo(() => buildTreeItems(pages, folders, files), [files, folders, pages]);
  const itemLocations = useMemo(() => collectItemLocations(treeItems), [treeItems]);
  const selectedItem = useMemo(() => {
    for (const [itemId, location] of itemLocations) {
      if (location === currentLocation) {
        return itemId;
      }
    }
    return null;
  }, [currentLocation, itemLocations]);

  return (
    <ResizableSidebar>
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography component="div" variant="subtitle2" sx={{ fontWeight: 700 }}>
          Pages
        </Typography>
      </Box>
      <Box sx={{ flexGrow: 1, minHeight: 0, overflow: "auto", py: 1 }}>
        {treeItems.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
            ページはまだありません。
          </Typography>
        ) : (
          <RichTreeView
            aria-label="ページ一覧"
            defaultExpandedItems={collectExpandableItemIds(treeItems)}
            expansionTrigger="iconContainer"
            itemChildrenIndentation={18}
            items={treeItems}
            selectedItems={selectedItem}
            slots={{ item: PageTreeViewItem }}
            onItemClick={(_, itemId) => {
              const location = itemLocations.get(itemId);
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

function PageTreeViewItem(props: TreeItemProps) {
  const isFolderOnly = props.itemId.startsWith("folder:");
  const isFile = props.itemId.startsWith("file:");
  return (
    <TreeItem
      {...props}
      label={
        <Box
          component="span"
          sx={{
            alignItems: "center",
            display: "inline-flex",
            gap: 0.75,
            minWidth: 0,
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
          <Box component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
            {props.label}
          </Box>
        </Box>
      }
    />
  );
}

function buildTreeItems(pages: FileSummary[], folders: FolderSummary[], files: FileSummary[]) {
  const root: PageTreeItem = {
    id: "__root__",
    label: "",
    location: null,
    kind: "folder",
    children: [],
  };

  for (const folder of folders) {
    upsertTreeItem(root, folder.display_path, {
      id: `folder:${folder.location}`,
      label: folder.title,
      location: folder.location,
      kind: "folder",
    });
  }

  for (const page of pages) {
    upsertTreeItem(root, page.display_path.length > 0 ? page.display_path : [page.title], {
      id: page.location,
      label: page.title,
      location: page.location,
      kind: "page",
    });
  }

  for (const file of files) {
    upsertTreeItem(root, file.display_path.length > 0 ? file.display_path : [file.title], {
      id: `file:${file.location}`,
      label: file.title,
      location: file.location,
      kind: "file",
    });
  }

  sortTreeItems(root.children ?? []);
  return root.children ?? [];
}

function upsertTreeItem(
  root: PageTreeItem,
  parts: string[],
  value: Pick<PageTreeItem, "id" | "label" | "location" | "kind">,
) {
  let current = root;
  let path = "";

  for (const part of parts) {
    path = path ? `${path}/${part}` : part;
    const children = current.children ?? [];
    let child = children.find((item) => item.label === part);
    if (!child) {
      child = { id: `folder:${path}`, label: part, location: null, kind: "folder", children: [] };
      children.push(child);
      current.children = children;
    }
    current = child;
  }

  current.id = value.id;
  current.label = value.label;
  current.location = value.location;
  current.kind = value.kind;
}

function sortTreeItems(items: PageTreeItem[]) {
  items.sort((left, right) => left.label.localeCompare(right.label));
  for (const item of items) {
    if (item.children) {
      sortTreeItems(item.children);
    }
  }
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

function collectItemLocations(items: PageTreeItem[]) {
  const locations = new Map<string, string>();

  for (const item of items) {
    if (item.location) {
      locations.set(item.id, item.location);
    }
    if (item.children) {
      for (const [itemId, location] of collectItemLocations(item.children)) {
        locations.set(itemId, location);
      }
    }
  }

  return locations;
}
