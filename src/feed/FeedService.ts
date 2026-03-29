/**
 * FeedService - Core service for managing podcast feeds
 *
 * Handles feed fetching, parsing, updating, and caching.
 * Automatically detects feed format (RSS or Atom) and uses the appropriate parser.
 */

import { requestUrl, RequestUrlParam } from 'obsidian';
import { logger } from '../utils/Logger';
import { NetworkError, retryWithBackoff } from '../utils/errorUtils';
import { Podcast, Episode } from '../model';
import { RSSParser } from './RSSParser';
import { AtomParser } from './AtomParser';
import { FeedCacheStore } from '../storage/CacheStore';

// Dynamic import for Node.js modules (not available on mobile)
let nodeHttps: typeof import('https') | null = null;
let nodeUrl: typeof import('url') | null = null;
try {
	nodeHttps = require('https');
	nodeUrl = require('url');
} catch {
	// Node.js modules not available (e.g., mobile platform)
}

/** Maximum allowed feed response size (10 MB) */
const MAX_FEED_RESPONSE_SIZE = 10 * 1024 * 1024;

/**
 * Feed type enumeration
 */
export enum FeedType {
	RSS = 'rss',
	ATOM = 'atom',
	UNKNOWN = 'unknown',
}

/**
 * Feed fetch options
 */
export interface FeedFetchOptions {
	/** Use cached data if available */
	useCache?: boolean;
	/** Cache TTL in milliseconds (default: 1 hour) */
	cacheTTL?: number;
	/** Timeout in milliseconds (default: 30 seconds) */
	timeout?: number;
	/** User agent string */
	userAgent?: string;
	/** ETag from previous fetch (for conditional requests) */
	etag?: string;
	/** Last-Modified from previous fetch (for conditional requests) */
	lastModified?: string;
}

/**
 * Feed Service
 */
export class FeedService {
	private rssParser: RSSParser;
	private atomParser: AtomParser;
	private cacheStore: FeedCacheStore | null = null;

	constructor(cacheStore?: FeedCacheStore) {
		this.rssParser = new RSSParser();
		this.atomParser = new AtomParser();
		this.cacheStore = cacheStore || null;
	}

	/**
	 * Fetch and parse a podcast feed
	 */
	async fetchFeed(
		feedUrl: string,
		options: FeedFetchOptions = {}
	): Promise<{ podcast: Podcast; episodes: Episode[] }> {
		logger.methodEntry('FeedService', 'fetchFeed', feedUrl);

		const {
			useCache = true,
			cacheTTL = 3600000, // 1 hour
			timeout = 30000, // 30 seconds
			// Use a browser-like user agent to avoid being blocked by some servers/CDNs (like Cloudflare)
			userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			etag,
			lastModified,
		} = options;

		// Check cache first
		if (useCache && this.cacheStore) {
			const cachedData = await this.getCachedFeed(feedUrl);
			if (cachedData) {
				logger.info('Using cached feed data');
				logger.methodExit('FeedService', 'fetchFeed', 'from cache');
				return cachedData;
			}
		}

		// Fetch feed XML
		const { xml, responseEtag, responseLastModified } = await this.fetchFeedXML(
			feedUrl,
			timeout,
			userAgent,
			etag,
			lastModified
		);

		// Detect feed type
		const feedType = this.detectFeedType(xml);

		// Parse feed
		let result: { podcast: Podcast; episodes: Episode[] };

		if (feedType === FeedType.RSS) {
			result = await this.rssParser.parseFromString(xml, feedUrl);
		} else if (feedType === FeedType.ATOM) {
			result = await this.atomParser.parseFromString(xml, feedUrl);
		} else {
			// Try RSS first, then Atom
			try {
				result = await this.rssParser.parseFromString(xml, feedUrl);
			} catch {
				result = await this.atomParser.parseFromString(xml, feedUrl);
			}
		}

		// Cache the result
		if (this.cacheStore) {
			await this.cacheFeed(feedUrl, xml, cacheTTL, {
				etag: responseEtag,
				lastModified: responseLastModified,
			});
		}

		logger.methodExit('FeedService', 'fetchFeed');
		return result;
	}

	/**
	 * Update an existing podcast feed
	 * Returns updated podcast with all episodes and information about new episodes
	 */
	async updateFeed(podcast: Podcast): Promise<{
		podcast: Podcast;
		episodes: Episode[];
		newEpisodes: Episode[];
	}> {
		logger.methodEntry('FeedService', 'updateFeed', podcast.id);

		const { podcast: updatedPodcast, episodes } = await this.fetchFeed(podcast.feedUrl, {
			useCache: false, // Force fresh fetch for updates
		});

		// Compare episodes to find new ones
		const existingEpisodeIds = new Set(podcast.episodes?.map(e => e.id) || []);
		const newEpisodes = episodes.filter(e => !existingEpisodeIds.has(e.id));

		logger.info(`Feed updated: ${newEpisodes.length} new episodes`);
		logger.methodExit('FeedService', 'updateFeed');

		return {
			podcast: updatedPodcast,
			episodes,
			newEpisodes,
		};
	}

	/**
	 * Fetch feed XML from URL
	 */
	private async fetchFeedXML(
		feedUrl: string,
		timeout: number,
		userAgent: string,
		etag?: string,
		lastModified?: string
	): Promise<{ xml: string; responseEtag?: string; responseLastModified?: string }> {
		logger.debug('Fetching feed XML', feedUrl);

		// SSRF protection: validate URL before fetching
		if (!FeedService.validateFeedUrl(feedUrl)) {
			throw new NetworkError('Invalid or blocked feed URL', feedUrl);
		}

		try {
			const response = await retryWithBackoff(
				async () => {
					const headers: Record<string, string> = {
						Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
						'Accept-Language': 'en-US,en;q=0.9',
					};

					// Add User-Agent only if explicitly provided (and not the default problematic one)
					// We rely on Obsidian's default or no UA to avoid blocking
					if (userAgent && userAgent !== 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36') {
						headers['User-Agent'] = userAgent;
					}

					// Add conditional request headers
					if (etag) {
						headers['If-None-Match'] = etag;
					}
					if (lastModified) {
						headers['If-Modified-Since'] = lastModified;
					}

					const requestParam: RequestUrlParam = {
						url: feedUrl,
						method: 'GET',
						headers,
						throw: false,
					};

					const response = await requestUrl(requestParam);

					if (response.status === 304) {
						throw new Error('NOT_MODIFIED');
					}

					if (response.status >= 400) {
						throw new NetworkError(
							`HTTP ${response.status}: Failed to fetch feed`,
							feedUrl
						);
					}

					return response;
				},
				{
					maxRetries: 3,
					initialDelay: 1000,
					maxDelay: 10000,
				}
			);

			const xml = response.text;

			// Enforce response size limit
			if (xml.length > MAX_FEED_RESPONSE_SIZE) {
				throw new NetworkError(`Feed response too large (${xml.length} bytes, max ${MAX_FEED_RESPONSE_SIZE})`, feedUrl);
			}

			const responseEtag = response.headers['etag'];
			const responseLastModified = response.headers['last-modified'];

			return {
				xml,
				responseEtag,
				responseLastModified,
			};
		} catch (error) {
			if (error instanceof Error && error.message === 'NOT_MODIFIED') {
				throw error;
			}

			logger.warn(`requestUrl failed for ${feedUrl}, trying fallback to fetch`, error);

			// Fallback to native fetch
			try {
				const fetchResponse = await fetch(feedUrl);
				if (!fetchResponse.ok) {
					throw new Error(`Fetch returned status ${fetchResponse.status}`);
				}
				const xml = await fetchResponse.text();

				// Enforce response size limit
				if (xml.length > MAX_FEED_RESPONSE_SIZE) {
					throw new NetworkError(`Feed response too large (${xml.length} bytes)`, feedUrl);
				}

				const responseEtag = fetchResponse.headers.get('etag') || undefined;
				const responseLastModified = fetchResponse.headers.get('last-modified') || undefined;

				return {
					xml,
					responseEtag,
					responseLastModified
				};
			} catch (fetchErr) {
				// Final fallback: Node.js native https module (desktop only)
				if (!nodeHttps || !nodeUrl) {
					logger.error('All fetch methods failed (Node.js modules not available)', fetchErr);
					throw new NetworkError('Failed to fetch feed', feedUrl, fetchErr);
				}

				logger.warn('fetch fallback failed, trying Node https', fetchErr);

				try {
					return await new Promise((resolve, reject) => {
						const urlObj = new nodeUrl!.URL(feedUrl);
						const options = {
							hostname: urlObj.hostname,
							path: urlObj.pathname + urlObj.search,
							method: 'GET',
							headers: {
								'User-Agent': userAgent || 'Obsidian/1.0.0',
								'Accept': '*/*',
							},
						};

						const req = nodeHttps!.request(options, (res: any) => {
							let data = '';

							res.on('data', (chunk: any) => {
								data += chunk;
								// Enforce response size limit
								if (data.length > MAX_FEED_RESPONSE_SIZE) {
									req.destroy();
									reject(new NetworkError('Feed response too large', feedUrl));
								}
							});

							res.on('end', () => {
								if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
									resolve({
										xml: data,
										responseEtag: res.headers.etag,
										responseLastModified: res.headers['last-modified']
									});
								} else {
									reject(new Error(`HTTPS Node request returned status ${res.statusCode}`));
								}
							});
						});

						req.on('error', (e: any) => {
							reject(e);
						});

						req.end();
					});

				} catch (nodeErr) {
					logger.error('All fetch methods failed', nodeErr);
					throw new NetworkError('Failed to fetch feed', feedUrl, nodeErr);
				}
			}
		}
	}

	/**
	 * Detect feed type from XML content
	 */
	private detectFeedType(xml: string): FeedType {
		const trimmed = xml.trim().toLowerCase();

		// Check for RSS
		if (trimmed.includes('<rss')) {
			return FeedType.RSS;
		}

		// Check for Atom
		if (trimmed.includes('<feed') && trimmed.includes('xmlns="http://www.w3.org/2005/atom"')) {
			return FeedType.ATOM;
		}

		// Try to validate with specific parsers
		if (RSSParser.validateXML(xml)) {
			return FeedType.RSS;
		}

		if (AtomParser.validateXML(xml)) {
			return FeedType.ATOM;
		}

		return FeedType.UNKNOWN;
	}

	/**
	 * Get cached feed data
	 */
	private async getCachedFeed(
		feedUrl: string
	): Promise<{ podcast: Podcast; episodes: Episode[] } | null> {
		if (!this.cacheStore) {
			return null;
		}

		try {
			const cachedEntry = await this.cacheStore.getCacheEntry(feedUrl);

			if (!cachedEntry) {
				return null;
			}

			// Parse cached XML
			const feedType = this.detectFeedType(cachedEntry.data);

			if (feedType === FeedType.RSS) {
				return await this.rssParser.parseFromString(cachedEntry.data, feedUrl);
			} else if (feedType === FeedType.ATOM) {
				return await this.atomParser.parseFromString(cachedEntry.data, feedUrl);
			}

			return null;
		} catch (error) {
			logger.warn('Failed to get cached feed', error);
			return null;
		}
	}

	/**
	 * Cache feed XML
	 */
	private async cacheFeed(
		feedUrl: string,
		xml: string,
		ttl: number,
		metadata?: { etag?: string; lastModified?: string }
	): Promise<void> {
		if (!this.cacheStore) {
			return;
		}

		try {
			await this.cacheStore.setCacheEntry(feedUrl, xml, ttl, metadata);
			logger.debug('Feed cached successfully');
		} catch (error) {
			logger.warn('Failed to cache feed', error);
			// Don't throw - caching failure should not prevent feed fetching
		}
	}

	/**
	 * Clear feed cache
	 */
	async clearCache(feedUrl?: string): Promise<void> {
		if (!this.cacheStore) {
			return;
		}

		if (feedUrl) {
			await this.cacheStore.removeCacheEntry(feedUrl);
			logger.info('Feed cache cleared', feedUrl);
		} else {
			await this.cacheStore.clear();
			logger.info('All feed caches cleared');
		}
	}

	/**
	 * Validate feed URL
	 */
	static validateFeedUrl(feedUrl: string): boolean {
		try {
			const urlObj = new URL(feedUrl);
			if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
				return false;
			}
			// Block private/internal network addresses (SSRF protection)
			if (FeedService.isPrivateHost(urlObj.hostname)) {
				return false;
			}
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Check if a hostname resolves to a private/internal network address
	 */
	private static isPrivateHost(hostname: string): boolean {
		// Block localhost variants
		if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
			return true;
		}

		// Block private IP ranges (RFC 1918 + link-local)
		const privateRanges = [
			/^10\./,                          // 10.0.0.0/8
			/^172\.(1[6-9]|2\d|3[01])\./,    // 172.16.0.0/12
			/^192\.168\./,                     // 192.168.0.0/16
			/^169\.254\./,                     // Link-local
			/^fc00:/i,                         // IPv6 unique local
			/^fe80:/i,                         // IPv6 link-local
		];

		return privateRanges.some(r => r.test(hostname));
	}
}
