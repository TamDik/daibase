import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TerminalExitEvent, TerminalOutputEvent } from "../api/tauriCommands";

let outputListener: ((event: { payload: TerminalOutputEvent }) => void) | null = null;
let exitListener: ((event: { payload: TerminalExitEvent }) => void) | null = null;
let terminalDataHandler: ((data: string) => void) | null = null;
const terminalWrite = vi.fn();
const terminalWriteln = vi.fn();
const terminalDispose = vi.fn();
const fitMock = vi.fn();
const proposeDimensions = vi.fn(() => ({ cols: 100, rows: 30 }));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((eventName, callback) => {
    if (eventName === "terminal:output") {
      outputListener = callback;
    }
    if (eventName === "terminal:exit") {
      exitListener = callback;
    }
    return Promise.resolve(vi.fn());
  }),
}));

vi.mock("@xterm/xterm", () => {
  class TerminalMock {
    dispose = terminalDispose;
    focus = vi.fn();
    loadAddon = vi.fn();
    open = vi.fn();
    write = terminalWrite;
    writeln = terminalWriteln;

    onData(handler: (data: string) => void) {
      terminalDataHandler = handler;
      return { dispose: vi.fn() };
    }
  }

  return { Terminal: TerminalMock };
});

vi.mock("@xterm/addon-fit", () => {
  class FitAddonMock {
    fit = fitMock;
    proposeDimensions = proposeDimensions;
  }

  return { FitAddon: FitAddonMock };
});

vi.mock("../api/tauriCommands", () => ({
  resizeTerminal: vi.fn(),
  startTerminal: vi.fn(),
  stopTerminal: vi.fn(),
  writeTerminal: vi.fn(),
}));

class ResizeObserverMock {
  observe = vi.fn();
  disconnect = vi.fn();
}

const api = await import("../api/tauriCommands");
const { TerminalPanel } = await import("./TerminalPanel");

describe("TerminalPanel", () => {
  afterEach(() => {
    vi.mocked(api.resizeTerminal).mockReset();
    vi.mocked(api.startTerminal).mockReset();
    vi.mocked(api.stopTerminal).mockReset();
    vi.mocked(api.writeTerminal).mockReset();
    terminalWrite.mockReset();
    terminalWriteln.mockReset();
    terminalDispose.mockReset();
    fitMock.mockClear();
    proposeDimensions.mockClear();
    outputListener = null;
    exitListener = null;
    terminalDataHandler = null;
    vi.unstubAllGlobals();
    cleanup();
  });

  it("starts a pty terminal with fitted dimensions", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.mocked(api.startTerminal).mockResolvedValue({
      id: "terminal-1",
      shell: "/bin/zsh",
    });

    render(<TerminalPanel onClose={vi.fn()} />);

    expect(await screen.findByText("/bin/zsh")).toBeInTheDocument();
    expect(api.startTerminal).toHaveBeenCalledWith(100, 30);
    expect(api.resizeTerminal).toHaveBeenCalledWith("terminal-1", 100, 30);
  });

  it("writes pty output into xterm", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.mocked(api.startTerminal).mockResolvedValue({
      id: "terminal-1",
      shell: "/bin/zsh",
    });

    render(<TerminalPanel onClose={vi.fn()} />);
    await screen.findByText("/bin/zsh");

    outputListener?.({
      payload: {
        session_id: "terminal-1",
        stream: "pty",
        text: "hello\r\n",
      },
    });

    expect(terminalWrite).toHaveBeenCalledWith("hello\r\n");
  });

  it("sends xterm input to the pty session", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.mocked(api.startTerminal).mockResolvedValue({
      id: "terminal-1",
      shell: "/bin/zsh",
    });
    vi.mocked(api.writeTerminal).mockResolvedValue();

    render(<TerminalPanel onClose={vi.fn()} />);
    await screen.findByText("/bin/zsh");

    terminalDataHandler?.("pwd\r");

    expect(api.writeTerminal).toHaveBeenCalledWith("terminal-1", "pwd\r");
  });

  it("closes the panel when the shell exits", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.mocked(api.startTerminal).mockResolvedValue({
      id: "terminal-1",
      shell: "/bin/zsh",
    });
    const onClose = vi.fn();

    render(<TerminalPanel onClose={onClose} />);
    await screen.findByText("/bin/zsh");

    exitListener?.({ payload: { session_id: "terminal-1" } });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("resizes the panel height by dragging its top edge", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.mocked(api.startTerminal).mockReturnValue(new Promise(() => {}));

    render(<TerminalPanel onClose={vi.fn()} />);

    const resizeHandle = screen.getByRole("separator", { name: "ターミナルの高さ" });
    expect(resizeHandle).toHaveAttribute("aria-valuenow", "320");

    fireEvent.pointerDown(resizeHandle, { clientY: 500 });
    fireEvent.pointerMove(window, { clientY: 420 });
    fireEvent.pointerUp(window);

    expect(resizeHandle).toHaveAttribute("aria-valuenow", "400");
  });

  it("stops the terminal session when unmounted", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.mocked(api.startTerminal).mockResolvedValue({
      id: "terminal-1",
      shell: "/bin/zsh",
    });

    const { unmount } = render(<TerminalPanel onClose={vi.fn()} />);
    await screen.findByText("/bin/zsh");

    unmount();

    await waitFor(() => expect(api.stopTerminal).toHaveBeenCalledWith("terminal-1"));
    expect(terminalDispose).toHaveBeenCalled();
  });
});
