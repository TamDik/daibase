export type RectLike = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export function getScrollIntoViewPosition({
  containerRect,
  padding = 24,
  scrollLeft,
  scrollTop,
  targetRect,
}: {
  containerRect: RectLike;
  padding?: number;
  scrollLeft: number;
  scrollTop: number;
  targetRect: RectLike;
}) {
  let nextScrollTop = scrollTop;
  let nextScrollLeft = scrollLeft;
  const visibleTop = containerRect.top + padding;
  const visibleBottom = containerRect.bottom - padding;
  const visibleLeft = containerRect.left + padding;
  const visibleRight = containerRect.right - padding;

  if (targetRect.top < visibleTop) {
    nextScrollTop -= visibleTop - targetRect.top;
  } else if (targetRect.bottom > visibleBottom) {
    nextScrollTop += targetRect.bottom - visibleBottom;
  }

  if (targetRect.left < visibleLeft) {
    nextScrollLeft -= visibleLeft - targetRect.left;
  } else if (targetRect.right > visibleRight) {
    nextScrollLeft += targetRect.right - visibleRight;
  }

  return {
    left: Math.max(0, nextScrollLeft),
    top: Math.max(0, nextScrollTop),
  };
}
