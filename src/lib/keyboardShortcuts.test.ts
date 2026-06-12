import { describe, expect, it } from "vitest";

import {
  bindingFromKeyboardEvent,
  defaultShortcutBindings,
  shortcutConflict,
} from "./keyboardShortcuts";

describe("keyboardShortcuts", () => {
  it("一般的なデフォルトキーを返す", () => {
    expect(defaultShortcutBindings()).toMatchObject({
      "search.global": "Mod+K",
      "search.page": "Mod+F",
      "navigation.back": "Alt+ArrowLeft",
      "view.reload": "Mod+R",
    });
  });

  it("キーボードイベントを正規化する", () => {
    expect(
      bindingFromKeyboardEvent({
        key: "k",
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: true,
      } as KeyboardEvent),
    ).toBe("Mod+Shift+K");
  });

  it("重複する割り当てを検出する", () => {
    expect(shortcutConflict("search.page", "Mod+K", defaultShortcutBindings())).toBe(
      "search.global",
    );
  });
});
