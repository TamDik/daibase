import { describe, expect, it } from "vitest";

import { getScrollIntoViewPosition } from "./scrollIntoView";

const containerRect = {
  bottom: 300,
  left: 0,
  right: 500,
  top: 100,
};

describe("getScrollIntoViewPosition", () => {
  it("表示範囲内の target ではスクロール位置を変えない", () => {
    expect(
      getScrollIntoViewPosition({
        containerRect,
        scrollLeft: 20,
        scrollTop: 40,
        targetRect: { bottom: 180, left: 80, right: 180, top: 140 },
      }),
    ).toEqual({ left: 20, top: 40 });
  });

  it("target が下に見切れている場合は下へスクロールする", () => {
    expect(
      getScrollIntoViewPosition({
        containerRect,
        scrollLeft: 0,
        scrollTop: 120,
        targetRect: { bottom: 340, left: 80, right: 180, top: 318 },
      }),
    ).toEqual({ left: 0, top: 184 });
  });

  it("target が上に見切れている場合は上へスクロールする", () => {
    expect(
      getScrollIntoViewPosition({
        containerRect,
        scrollLeft: 0,
        scrollTop: 120,
        targetRect: { bottom: 110, left: 80, right: 180, top: 88 },
      }),
    ).toEqual({ left: 0, top: 84 });
  });

  it("target が横に見切れている場合は横へスクロールする", () => {
    expect(
      getScrollIntoViewPosition({
        containerRect,
        scrollLeft: 30,
        scrollTop: 0,
        targetRect: { bottom: 180, left: 480, right: 560, top: 140 },
      }),
    ).toEqual({ left: 114, top: 0 });
  });
});
