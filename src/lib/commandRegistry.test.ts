import { describe, expect, it } from "vitest";

import { builtinCommands, searchCommands } from "./commandRegistry";

describe("commandRegistry", () => {
  it("空の検索では登録順に全コマンドを返す", () => {
    expect(searchCommands(builtinCommands, "")).toEqual(builtinCommands);
  });

  it("タイトル、ID、キーワードを曖昧検索する", () => {
    expect(searchCommands(builtinCommands, "sglob")[0]?.id).toBe("search.global");
    expect(searchCommands(builtinCommands, "navback")[0]?.id).toBe("navigation.back");
    expect(searchCommands(builtinCommands, "refresh")[0]?.id).toBe("view.reload");
    expect(searchCommands(builtinCommands, "ショート")[0]?.id).toBe("shortcuts.open");
  });

  it("プラグイン由来コマンドも同じ検索対象にできる", () => {
    const pluginCommand = {
      id: "plugin:com.example.calendar/open",
      name: "Open Calendar",
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

  it("コマンド名のマッチを他の項目のマッチより優先する", () => {
    const descriptionMatch = {
      id: "description.match",
      name: "Unrelated",
      title: "無関係",
      description: "open",
      category: "テスト",
      defaultBinding: "",
      source: "builtin" as const,
    };
    const nameMatch = {
      id: "name.match",
      name: "Open Something With A Long Name",
      title: "名前一致",
      description: "無関係",
      category: "テスト",
      defaultBinding: "",
      source: "builtin" as const,
    };

    expect(searchCommands([descriptionMatch, nameMatch], "open")).toEqual([
      nameMatch,
      descriptionMatch,
    ]);
  });
});
