import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState } from "react";

import type { SideBySideDiffRow, SideBySideDiffSection } from "../api/tauriCommands";

export function SideBySideDiffView({ sections }: { sections: SideBySideDiffSection[] }) {
  const [expandedSections, setExpandedSections] = useState<ReadonlySet<string>>(new Set());

  return (
    <Box sx={{ border: "1px solid #d8dee4", borderRadius: 1, overflow: "hidden" }}>
      <Box
        sx={{
          bgcolor: "#f6f8fa",
          borderBottom: "1px solid #d8dee4",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        <Typography variant="subtitle2" sx={{ borderRight: "1px solid #d8dee4", px: 1.5, py: 1 }}>
          古い内容
        </Typography>
        <Typography variant="subtitle2" sx={{ px: 1.5, py: 1 }}>
          新しい内容
        </Typography>
      </Box>

      {sections.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, py: 2 }}>
          差分はありません。
        </Typography>
      ) : (
        sections.map((section) =>
          section.kind === "unchanged" && !expandedSections.has(section.id) ? (
            <CollapsedSection
              key={section.id}
              section={section}
              onExpand={() => {
                setExpandedSections((current) => new Set(current).add(section.id));
              }}
            />
          ) : (
            <Box key={section.id}>
              {section.rows.map((row, index) => (
                <DiffRow key={`${section.id}-${index}`} row={row} />
              ))}
            </Box>
          ),
        )
      )}
    </Box>
  );
}

function CollapsedSection({
  section,
  onExpand,
}: {
  section: SideBySideDiffSection;
  onExpand: () => void;
}) {
  const first = section.rows[0];
  const last = section.rows[section.rows.length - 1];
  const range =
    first && last
      ? `${first.old_line_number}-${last.old_line_number} / ${first.new_line_number}-${last.new_line_number}`
      : "";

  return (
    <Button
      fullWidth
      variant="text"
      onClick={onExpand}
      sx={{
        bgcolor: "#f6f8fa",
        borderBottom: "1px solid #d8dee4",
        borderRadius: 0,
        color: "text.secondary",
        justifyContent: "center",
        py: 0.75,
        textTransform: "none",
      }}
    >
      {section.rows.length} 行の変更なし {range}
    </Button>
  );
}

function DiffRow({ row }: { row: SideBySideDiffRow }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        minWidth: 0,
      }}
    >
      <DiffCell side="old" row={row} />
      <DiffCell side="new" row={row} />
    </Box>
  );
}

function DiffCell({ row, side }: { row: SideBySideDiffRow; side: "old" | "new" }) {
  const lineNumber = side === "old" ? row.old_line_number : row.new_line_number;
  const text = side === "old" ? row.old_text : row.new_text;
  const kind = cellKind(row, side);

  return (
    <Stack
      direction="row"
      sx={{
        bgcolor:
          kind === "added"
            ? "rgba(46, 160, 67, 0.12)"
            : kind === "removed"
              ? "rgba(248, 81, 73, 0.12)"
              : kind === "modified"
                ? "rgba(187, 128, 9, 0.12)"
                : "#ffffff",
        borderRight: side === "old" ? "1px solid #d8dee4" : undefined,
        minWidth: 0,
      }}
    >
      <Box
        component="span"
        sx={{
          color: "text.secondary",
          flex: "0 0 48px",
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
          fontSize: 12,
          px: 1,
          py: 0.25,
          textAlign: "right",
          userSelect: "none",
        }}
      >
        {lineNumber ?? ""}
      </Box>
      <Box
        component="code"
        sx={{
          display: "block",
          flex: 1,
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
          fontSize: 13,
          lineHeight: 1.6,
          minHeight: 24,
          minWidth: 0,
          overflowWrap: "anywhere",
          px: 1,
          py: 0.25,
          whiteSpace: "pre-wrap",
        }}
      >
        {text ?? ""}
      </Box>
    </Stack>
  );
}

function cellKind(row: SideBySideDiffRow, side: "old" | "new") {
  if (row.kind === "modified") {
    return "modified";
  }
  if (row.kind === "removed" && side === "old") {
    return "removed";
  }
  if (row.kind === "added" && side === "new") {
    return "added";
  }
  return "unchanged";
}
