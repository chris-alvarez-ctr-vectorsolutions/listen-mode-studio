// Flags a finished job in the browser tab's title, but only when you are not looking at the tab, so several modules
// can be run side by side and the finished one stands out. The title goes back as soon as the tab is in front again.
const BASE = typeof document !== 'undefined' ? document.title : '';
let restore = null;

const away = () => document.hidden || !document.hasFocus();

export function notifyWhenAway(text) {
  if (typeof document === 'undefined' || !away()) return;
  document.title = text;
  if (restore) return;                       // already waiting to put the title back
  restore = () => {
    if (away()) return;
    document.title = BASE;
    document.removeEventListener('visibilitychange', restore);
    window.removeEventListener('focus', restore);
    restore = null;
  };
  document.addEventListener('visibilitychange', restore);
  window.addEventListener('focus', restore);
}
