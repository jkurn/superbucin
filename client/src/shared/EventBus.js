// Minimal pub/sub event bus — singleton
// Events use domain:action naming (e.g. 'game:state', 'game:end')

const listeners = new Map();

export const EventBus = {
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
  },

  off(event, fn) {
    const set = listeners.get(event);
    if (set) set.delete(fn);
  },

  emit(event, data) {
    const set = listeners.get(event);
    if (set) set.forEach((fn) => fn(data));
  },

  clear() {
    listeners.clear();
  },
};
