import type { ProviderEventHub } from './createProviderEventHub';
import type { IVideoProvider } from './IVideoProvider';

export function createNativeVideoProvider(videoElement: HTMLVideoElement, eventHub: ProviderEventHub): IVideoProvider {
  return {
    async play() {
      try {
        await videoElement.play();
      } catch (error) {
        eventHub.emit('autoplayblocked');
        throw error;
      }
    },
    pause() {
      videoElement.pause();
    },
    mute(muted) {
      videoElement.muted = muted;
      eventHub.emit('mutechange', videoElement.muted);
    },
    seek(seconds) {
      videoElement.currentTime = seconds;
      eventHub.emit('progress', videoElement.currentTime);
    },
    setLoop(loop) {
      videoElement.loop = loop;
    },
    destroy() {
      videoElement.pause();
      videoElement.removeAttribute('src');
      videoElement.load();
      eventHub.clear();
    },
    getCurrentTime() {
      return videoElement.currentTime || 0;
    },
    getDuration() {
      return Number.isFinite(videoElement.duration) ? videoElement.duration : 0;
    },
    isMuted() {
      return videoElement.muted;
    },
    onReady(callback) {
      return eventHub.on('ready', callback);
    },
    onPlay(callback) {
      return eventHub.on('play', callback);
    },
    onPause(callback) {
      return eventHub.on('pause', callback);
    },
    onProgress(callback) {
      return eventHub.on('progress', callback);
    },
    onEnded(callback) {
      return eventHub.on('ended', callback);
    },
    onMuteChange(callback) {
      return eventHub.on('mutechange', callback);
    },
    onAutoplayBlocked(callback) {
      return eventHub.on('autoplayblocked', callback);
    },
  };
}

export function bindNativeVideoEvents(
  videoElement: HTMLVideoElement,
  eventHub: ProviderEventHub,
  notifyReady: () => void,
) {
  const handlePlay = () => eventHub.emit('play');
  const handlePause = () => eventHub.emit('pause');
  const handleTimeUpdate = () => eventHub.emit('progress', videoElement.currentTime);
  const handleEnded = () => eventHub.emit('ended');
  const handleVolumeChange = () => eventHub.emit('mutechange', videoElement.muted);
  const handleReady = () => notifyReady();

  videoElement.addEventListener('play', handlePlay);
  videoElement.addEventListener('pause', handlePause);
  videoElement.addEventListener('timeupdate', handleTimeUpdate);
  videoElement.addEventListener('ended', handleEnded);
  videoElement.addEventListener('volumechange', handleVolumeChange);
  videoElement.addEventListener('loadedmetadata', handleReady);
  videoElement.addEventListener('canplay', handleReady);

  if (videoElement.readyState >= 1) {
    queueMicrotask(notifyReady);
  }

  return () => {
    videoElement.removeEventListener('play', handlePlay);
    videoElement.removeEventListener('pause', handlePause);
    videoElement.removeEventListener('timeupdate', handleTimeUpdate);
    videoElement.removeEventListener('ended', handleEnded);
    videoElement.removeEventListener('volumechange', handleVolumeChange);
    videoElement.removeEventListener('loadedmetadata', handleReady);
    videoElement.removeEventListener('canplay', handleReady);
  };
}
