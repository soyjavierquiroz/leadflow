import type { IVideoProvider, ProviderLifecycleCallbacks } from './IVideoProvider';

export function subscribeProviderCallbacks(
  provider: IVideoProvider,
  callbacks: ProviderLifecycleCallbacks,
): Array<() => void> {
  const unsubscribers: Array<() => void> = [];

  if (callbacks.onReady) {
    unsubscribers.push(provider.onReady(callbacks.onReady));
  }

  if (callbacks.onPlay) {
    unsubscribers.push(provider.onPlay(callbacks.onPlay));
  }

  if (callbacks.onPause) {
    unsubscribers.push(provider.onPause(callbacks.onPause));
  }

  if (callbacks.onProgress) {
    unsubscribers.push(provider.onProgress(callbacks.onProgress));
  }

  if (callbacks.onEnded) {
    unsubscribers.push(provider.onEnded(callbacks.onEnded));
  }

  if (callbacks.onMuteChange) {
    unsubscribers.push(provider.onMuteChange(callbacks.onMuteChange));
  }

  if (callbacks.onAutoplayBlocked) {
    unsubscribers.push(provider.onAutoplayBlocked(callbacks.onAutoplayBlocked));
  }

  return unsubscribers;
}
