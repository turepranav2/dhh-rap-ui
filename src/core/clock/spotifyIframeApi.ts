/**
 * Typed wrapper for the Spotify iFrame Embed API
 * (developer.spotify.com/documentation/embeds/references/iframe-api).
 * Loads the script once and resolves the API. Used by the M2.1 spike and the
 * M2.2 SpotifyEmbedClock. Nothing here hides or alters the embed.
 */

export interface SpotifyPlaybackUpdate {
  playingURI: string;
  isPaused: boolean;
  isBuffering: boolean;
  /** ms */
  duration: number;
  /** ms */
  position: number;
}

export interface SpotifyEmbedController {
  loadUri(uri: string): void;
  loadEntity?(uriOrUrl: string, preferVideo?: boolean, startAtSeconds?: number): void;
  play(): void;
  pause(): void;
  resume(): void;
  togglePlay(): void;
  restart(): void;
  /** seconds */
  seek(seconds: number): void;
  destroy(): void;
  addListener(event: 'ready', cb: () => void): void;
  addListener(event: 'playback_started', cb: (e: { data: { playingURI: string } }) => void): void;
  addListener(event: 'playback_update', cb: (e: { data: SpotifyPlaybackUpdate }) => void): void;
  removeListener(event: 'ready' | 'playback_started' | 'playback_update'): void;
}

export interface SpotifyControllerOptions {
  uri?: string;
  url?: string;
  width?: number | string;
  height?: number | string;
}

export interface SpotifyIFrameAPI {
  createController(
    element: HTMLElement,
    options: SpotifyControllerOptions,
    callback: (controller: SpotifyEmbedController) => void,
  ): void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void;
  }
}

export const SPOTIFY_IFRAME_API_SRC = 'https://open.spotify.com/embed/iframe-api/v1';
export const trackUri = (trackId: string): string => `spotify:track:${trackId}`;

let apiPromise: Promise<SpotifyIFrameAPI> | null = null;

export function loadSpotifyIframeApi(): Promise<SpotifyIFrameAPI> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<SpotifyIFrameAPI>((resolve, reject) => {
    window.onSpotifyIframeApiReady = (api) => resolve(api);
    const script = document.createElement('script');
    script.src = SPOTIFY_IFRAME_API_SRC;
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error('Failed to load the Spotify iFrame API script'));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}
