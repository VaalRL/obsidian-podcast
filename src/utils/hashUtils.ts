/**
 * Hash Utilities
 *
 * Provides consistent ID generation for podcasts and episodes.
 * Uses a 53-bit hash (two 32-bit hashes combined) for lower collision probability
 * compared to a single 32-bit hash.
 */

/**
 * Generate a 53-bit hash from a string (combines two 32-bit hashes for lower collision rate).
 * Based on cyrb53 algorithm.
 */
function cyrb53(str: string, seed = 0): number {
	let h1 = 0xdeadbeef ^ seed;
	let h2 = 0x41c6ce57 ^ seed;
	for (let i = 0; i < str.length; i++) {
		const ch = str.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
	h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
	h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Generate a unique podcast ID from feed URL
 */
export function generatePodcastId(feedUrl: string): string {
	return `podcast-${cyrb53(feedUrl).toString(36)}`;
}

/**
 * Generate a unique episode ID from GUID or URL
 */
export function generateEpisodeId(guid: string): string {
	return `episode-${cyrb53(guid).toString(36)}`;
}
