import { describe, expect, it } from "vitest";

import { findPageSearchMatches } from "./pageSearch";

describe("findPageSearchMatches", () => {
  it("大文字小文字を区別せず一致位置を返す", () => {
    expect(findPageSearchMatches("Intro\nintro\nINTRO", "intro")).toEqual([
      { start: 0, end: 5 },
      { start: 6, end: 11 },
      { start: 12, end: 17 },
    ]);
  });

  it("空白だけの query は一致なしとして扱う", () => {
    expect(findPageSearchMatches("Main", "   ")).toEqual([]);
  });
});
