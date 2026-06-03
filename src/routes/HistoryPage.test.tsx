import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HistoryPage } from "./HistoryPage";

vi.mock("../api/tauriCommands", () => ({
  readPageHistorySnapshot: vi.fn(),
}));

const api = await import("../api/tauriCommands");

describe("HistoryPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(api.readPageHistorySnapshot).mockReset();
    vi.mocked(api.readPageHistorySnapshot).mockResolvedValue({
      entry: {
        revision_id: "rev_02",
        object_id: "sha256:1234567890abcdef",
        created_at: "2026-01-02T00:00:00Z",
        kind: "modified",
        path: "Main.md",
      },
      previous_content: "# Main\n\nBefore\n\nSame\n",
      content: "# Main\n\nAfter\n\nSame\n",
      diff_sections: [
        {
          kind: "unchanged",
          id: "unchanged-0",
          rows: [
            {
              kind: "unchanged",
              old_line_number: 1,
              old_text: "# Main",
              new_line_number: 1,
              new_text: "# Main",
            },
            {
              kind: "unchanged",
              old_line_number: 2,
              old_text: "",
              new_line_number: 2,
              new_text: "",
            },
          ],
        },
        {
          kind: "changed",
          id: "changed-1",
          rows: [
            {
              kind: "modified",
              old_line_number: 3,
              old_text: "Before",
              new_line_number: 3,
              new_text: "After",
            },
          ],
        },
        {
          kind: "unchanged",
          id: "unchanged-2",
          rows: [
            {
              kind: "unchanged",
              old_line_number: 4,
              old_text: "",
              new_line_number: 4,
              new_text: "",
            },
            {
              kind: "unchanged",
              old_line_number: 5,
              old_text: "Same",
              new_line_number: 5,
              new_text: "Same",
            },
          ],
        },
      ],
    });
  });

  it("左右分割の差分を表示し、変更なしの行を展開できる", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={["/history?namespaceId=ns-work&path=Main.md&revisionId=rev_02"]}
      >
        <Routes>
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(api.readPageHistorySnapshot).toHaveBeenCalledWith("ns-work", "Main.md", "rev_02");
    expect(await screen.findByText("古い内容")).toBeInTheDocument();
    expect(screen.getByText("新しい内容")).toBeInTheDocument();
    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /行の変更なし/ })[0]);

    expect(screen.getAllByText("# Main")).toHaveLength(2);
  });
});
