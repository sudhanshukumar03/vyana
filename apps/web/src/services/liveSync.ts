interface LiveSyncActions {
  refresh: () => void;
  reconnect: () => void;
  streaming: () => boolean;
  tick: () => void;
  insights: () => void;
}

// Socket events remain the primary transport. REST recovers missed events and
// keeps equipment updating when a network/proxy cannot carry the socket.
export function startLiveSync(actions: LiveSyncActions): () => void {
  let refreshedAt = Date.now();
  let insightsAt = refreshedAt;
  let awakenedAt = -Infinity;
  const refresh = () => { refreshedAt = Date.now(); actions.refresh(); };
  const wake = () => {
    if (document.visibilityState === 'hidden' || navigator.onLine === false) return;
    actions.tick();
    if (Date.now() - awakenedAt < 1000) return;
    awakenedAt = Date.now();
    actions.reconnect();
    refresh();
  };
  actions.reconnect();
  refresh();
  actions.insights();
  const clock = window.setInterval(() => {
    actions.tick();
    if (document.visibilityState === 'hidden' || navigator.onLine === false) return;
    const now = Date.now();
    if (now - refreshedAt >= (actions.streaming() ? 30000 : 5000)) {
      actions.reconnect();
      refresh();
    }
    if (now - insightsAt >= 30000) { insightsAt = now; actions.insights(); }
  }, 1000);
  window.addEventListener('online', wake);
  window.addEventListener('focus', wake);
  document.addEventListener('visibilitychange', wake);
  return () => {
    window.clearInterval(clock);
    window.removeEventListener('online', wake);
    window.removeEventListener('focus', wake);
    document.removeEventListener('visibilitychange', wake);
  };
}
