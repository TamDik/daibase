import { describe, expect, it } from "vitest";

import { builtinCommands, searchCommands } from "./commandRegistry";

describe("commandRegistry", () => {
  it("空の検索では登録順に全コマンドを返す", () => {
    expect(searchCommands(builtinCommands, "")).toEqual(builtinCommands);
  });

  it("タイトル、ID、キーワードを曖昧検索する", () => {
    expect(searchCommands(builtinCommands, "sglob")[0]?.id).toBe("search.global");
    expect(searchCommands(builtinCommands, "navback")[0]?.id).toBe("navigation.back");
    expect(searchCommands(builtinCommands, "ショート")[0]?.id).toBe("shortcuts.open");
  });

  it("プラグイン由来コマンドも同じ検索対象にできる", () => {
    const pluginCommand = {
      id: "plugin:com.example.calendar/open",
      title: "Open Calendar",
      description: "カレンダーを開きます。",
      category: "Calendar",
      defaultBinding: "",
      source: "plugin:com.example.calendar" as const,
    };

    expect(searchCommands([...builtinCommands, pluginCommand], "calendar")).toContain(
      pluginCommand,
    );
  });
});
