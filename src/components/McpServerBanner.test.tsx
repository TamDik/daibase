import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { McpServerBanner } from "./McpServerBanner";

vi.mock("../api/tauriCommands", () => ({
  getMcpServerStatus: vi.fn(),
}));

const api = await import("../api/tauriCommands");

describe("McpServerBanner", () => {
  afterEach(() => {
    vi.mocked(api.getMcpServerStatus).mockReset();
    cleanup();
  });

  it("shows the MCP server URL when the server is enabled", async () => {
    vi.mocked(api.getMcpServerStatus).mockResolvedValue({
      enabled: true,
      transport: "Streamable HTTP",
      url: "http://127.0.0.1:17620/mcp",
    });

    render(<McpServerBanner />);

    expect(
      await screen.findByText("MCP server enabled on http://127.0.0.1:17620/mcp"),
    ).toBeInTheDocument();
  });

  it("copies the MCP server URL", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText,
      },
    });
    vi.mocked(api.getMcpServerStatus).mockResolvedValue({
      enabled: true,
      transport: "Streamable HTTP",
      url: "http://127.0.0.1:17620/mcp",
    });

    render(<McpServerBanner />);

    await userEvent.click(await screen.findByRole("button", { name: "Copy MCP server URL" }));

    expect(writeText).toHaveBeenCalledWith("http://127.0.0.1:17620/mcp");
  });

  it("does not show a banner when the MCP server is disabled", async () => {
    vi.mocked(api.getMcpServerStatus).mockResolvedValue({
      enabled: false,
      transport: "Streamable HTTP",
      url: "http://127.0.0.1:17620/mcp",
    });

    render(<McpServerBanner />);

    await waitFor(() => expect(api.getMcpServerStatus).toHaveBeenCalled());
    expect(screen.queryByText(/MCP server enabled on/)).not.toBeInTheDocument();
  });
});
