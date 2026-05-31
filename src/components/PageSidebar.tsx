import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { RichTreeView } from "@mui/x-tree-view/RichTreeView";
import { useMemo } from "react";

import type { ContentTree, FileSummary, NamespaceSummary } from "../api/tauriCommands";

type PageTreeItem = {
  id: string;
  label: string;
  location: string | null;
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
  const treeItems = useMemo(() => buildTreeItems(pages), [pages]);
  const pageLocations = useMemo(() => new Map(pages.map((page) => [page.location, page])), [pages]);
  const itemLocations = useMemo(() => collectItemLocations(treeItems), [treeItems]);
  const selectedItem = pageLocations.has(currentLocation) ? currentLocation : null;

  return (
    <Box
      component="aside"
      sx={{
        alignSelf: "stretch",
        bgcolor: "#ffffff",
        borderRight: "1px solid #d0d7de",
        flex: "0 0 280px",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography component="div" variant="subtitle2" sx={{ fontWeight: 700 }}>
          Pages
        </Typography>
      </Box>
      <Box sx={{ maxHeight: "calc(100vh - 140px)", overflow: "auto", py: 1 }}>
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
    </Box>
  );
}

function buildTreeItems(pages: FileSummary[]) {
  const root: PageTreeItem = { id: "__root__", label: "", location: null, children: [] };

  for (const page of pages) {
    const parts = page.display_path.length > 0 ? page.display_path : [page.title];
    let current = root;
    let path = "";

    for (const part of parts) {
      path = path ? `${path}/${part}` : part;
      const children = current.children ?? [];
      let child = children.find((item) => item.label === part);
      if (!child) {
        child = { id: `folder:${path}`, label: part, location: null, children: [] };
        children.push(child);
        current.children = children;
      }
      current = child;
    }

    current.id = page.location;
    current.location = page.location;
  }

  sortTreeItems(root.children ?? []);
  return root.children ?? [];
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
