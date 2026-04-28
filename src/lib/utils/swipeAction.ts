import { useSwipe, type SwipeCustomEvent } from "svelte-gestures";

export const createSwipeAction = (handler: (e: SwipeCustomEvent) => void) => {
  const gesture = useSwipe(handler, undefined, undefined, true);
  return (node: HTMLElement) => ({ destroy: gesture.swipe(node) });
};
