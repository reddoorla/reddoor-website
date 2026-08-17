// Decides whether a parsed Vimeo postMessage event proves playback is
// GENUINELY underway — i.e. the moment VimeoEmbed may fade the video in over
// its poster. `play` (and the first timeupdate/playProgress at 0s) fire before
// the player has painted a frame, so revealing on them flashed Vimeo's own
// loading state/thumbnail over the poster. We reveal only once the playback
// clock has advanced past zero: by then frames are flowing, and the 700ms
// crossfade hides any residual decode latency.
//
// Fail-open on a progress beat with no readable `seconds` (the two protocols —
// legacy Froogaloop strings vs player.js numbers — have drifted before):
// timeupdate/playProgress only fire during playback, and a stranded poster is
// worse than a rare early fade.
export interface VimeoEventMessage {
  event?: string;
  data?: { seconds?: unknown };
}

export function isLiveBeat(msg: VimeoEventMessage): boolean {
  if (msg.event !== "playProgress" && msg.event !== "timeupdate") return false;
  const seconds = Number(msg.data?.seconds);
  return Number.isNaN(seconds) || seconds > 0;
}
