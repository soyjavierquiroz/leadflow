import { useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useBunnyProvider } from './useBunnyProvider';
import { useHtml5Provider } from './useHtml5Provider';
import { useUnsupportedProvider } from './useUnsupportedProvider';
import { useYouTubeProvider } from './useYouTubeProvider';
import type { IVideoProvider, ProviderHookOptions, VideoProvider } from './IVideoProvider';

type VideoController =
  | {
      surface: 'video';
      mountRef: MutableRefObject<HTMLVideoElement | null>;
      providerRef: MutableRefObject<IVideoProvider | null>;
    }
  | {
      surface: 'embed';
      mountRef: MutableRefObject<HTMLDivElement | null>;
      providerRef: MutableRefObject<IVideoProvider | null>;
    };

interface UseVideoProviderControllerOptions extends ProviderHookOptions {
  provider: VideoProvider;
}

export function useVideoProviderController({
  provider,
  ...options
}: UseVideoProviderControllerOptions): VideoController {
  const fallbackVideoRef = useRef<HTMLVideoElement | null>(null);
  const fallbackProviderRef = useRef<IVideoProvider | null>(null);

  const bunny = useBunnyProvider({
    ...options,
    enabled: options.enabled && provider === 'bunnynet',
  });

  const html5 = useHtml5Provider({
    ...options,
    enabled: options.enabled && provider === 'html5',
  });

  const youtube = useYouTubeProvider({
    ...options,
    enabled: options.enabled && provider === 'youtube',
  });

  const unsupported = useUnsupportedProvider(provider, {
    ...options,
    enabled: options.enabled && (provider === 'vimeo' || provider === 'wistia'),
  });

  switch (provider) {
    case 'bunnynet':
      return {
        surface: 'video',
        mountRef: bunny.mountRef,
        providerRef: bunny.providerRef,
      };
    case 'html5':
      return {
        surface: 'video',
        mountRef: html5.mountRef,
        providerRef: html5.providerRef,
      };
    case 'youtube':
      return {
        surface: 'embed',
        mountRef: youtube.mountRef,
        providerRef: youtube.providerRef,
      };
    case 'vimeo':
    case 'wistia':
      return {
        surface: 'embed',
        mountRef: unsupported.mountRef,
        providerRef: unsupported.providerRef,
      };
    default:
      return {
        surface: 'video',
        mountRef: fallbackVideoRef,
        providerRef: fallbackProviderRef,
      };
  }
}
