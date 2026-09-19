import { useSyncExternalStore } from 'react';
import { ui } from './store.js';
import type { UiSnapshot } from './store.js';

export function useUi(): UiSnapshot {
  return useSyncExternalStore(
    (listener) => ui().subscribe(listener),
    () => ui().getSnapshot(),
  );
}
