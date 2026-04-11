import type { IVideoProviderEvents } from './IVideoProvider';

type ProviderEventName = keyof IVideoProviderEvents;

type ProviderListenerMap = {
  [K in ProviderEventName]: Set<IVideoProviderEvents[K]>;
};

export interface ProviderEventHub {
  on<K extends ProviderEventName>(eventName: K, listener: IVideoProviderEvents[K]): () => void;
  emit<K extends ProviderEventName>(eventName: K, ...args: Parameters<IVideoProviderEvents[K]>): void;
  clear(): void;
}

export function createProviderEventHub(): ProviderEventHub {
  const listeners: ProviderListenerMap = {
    ready: new Set(),
    play: new Set(),
    pause: new Set(),
    progress: new Set(),
    ended: new Set(),
    mutechange: new Set(),
    autoplayblocked: new Set(),
  };

  return {
    on(eventName, listener) {
      listeners[eventName].add(listener);

      return () => {
        listeners[eventName].delete(listener);
      };
    },
    emit(eventName, ...args) {
      for (const listener of listeners[eventName]) {
        (listener as (...listenerArgs: unknown[]) => void)(...args);
      }
    },
    clear() {
      for (const listenerSet of Object.values(listeners)) {
        listenerSet.clear();
      }
    },
  };
}
