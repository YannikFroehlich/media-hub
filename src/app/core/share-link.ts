import { parseConfig } from './config-schema';
import { MediaHubConfig } from './models';

const HASH_KEY = 'import=';
/** Same cap as the JSON file import; also stops a crafted link from inflating without bound. */
const DECOMPRESSED_LIMIT = 1024 * 1024;

/**
 * Builds a link that carries the whole config, deflated and base64url-encoded, in the URL hash.
 * The hash never reaches a server. Liquid-glass background images are left out: a single one is
 * far larger than any link (or QR code) can hold.
 */
export async function createShareLink(config: MediaHubConfig, baseUrl: string): Promise<string> {
  const slim: MediaHubConfig = {
    ...config,
    profiles: config.profiles.map((profile) => ({
      ...profile,
      settings: { ...profile.settings, liquidGlassBackgroundImage: '' },
    })),
  };
  const deflated = new Uint8Array(
    await new Response(
      new Response(JSON.stringify(slim)).body!.pipeThrough(new CompressionStream('deflate-raw')),
    ).arrayBuffer(),
  );
  const base64 = btoa(Array.from(deflated, (byte) => String.fromCharCode(byte)).join(''));
  const url = new URL(baseUrl);
  url.hash = HASH_KEY + base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return url.toString();
}

/** `null` if the hash is not a share link; throws if it is one but does not hold a valid config. */
export async function readShareHash(hash: string): Promise<MediaHubConfig | null> {
  if (!hash.startsWith('#' + HASH_KEY)) return null;
  const base64 = hash
    .slice(HASH_KEY.length + 1)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const reader = new Response(bytes)
    .body!.pipeThrough(new DecompressionStream('deflate-raw'))
    .getReader();
  const decoder = new TextDecoder();
  let text = '';
  let total = 0;
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    total += next.value.length;
    if (total > DECOMPRESSED_LIMIT) {
      await reader.cancel();
      throw new Error('Share link too large');
    }
    text += decoder.decode(next.value, { stream: true });
  }
  return parseConfig(JSON.parse(text + decoder.decode()));
}
