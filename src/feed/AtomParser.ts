/**
 * AtomParser - Parses Atom 1.0 podcast feeds
 *
 * Supports Atom 1.0 format with podcast extensions.
 * Converts Atom feed data into our Podcast and Episode data models.
 */

import Parser from 'rss-parser';
import { logger } from '../utils/Logger';
import { FeedParseError } from '../utils/errorUtils';
import { Podcast, Episode } from '../model';
import { generatePodcastId, generateEpisodeId } from '../utils/hashUtils';
import { ChapterParser } from './ChapterParser';

/**
 * Extended Atom feed parser with custom fields
 */
interface AtomFeed {
	title?: string;
	subtitle?: string;
	link?: string;
	language?: string;
	image?: {
		url?: string;
		title?: string;
		link?: string;
	};
	author?: string;
	items: AtomItem[];
}

interface AtomItem {
	title?: string;
	summary?: string;
	content?: string;
	link?: string;
	pubDate?: string;
	id?: string;
	enclosure?: {
		url: string;
		length?: string;
		type?: string;
	};
	author?: string;
	'podcast:chapters'?: string | { $?: { url?: string; type?: string } };
	'psc:chapters'?: { 'psc:chapter'?: unknown[] } | unknown;
}

/**
 * Atom Parser for podcast feeds
 */
export class AtomParser {
	private parser: Parser<AtomFeed, AtomItem>;

	constructor() {
		this.parser = new Parser<AtomFeed, AtomItem>({
			customFields: {
				feed: [
					'subtitle',
					'author',
				],
				item: [
					'summary',
					'author',
					'podcast:chapters',
					'psc:chapters',
				],
			},
		});
	}

	/**
	 * Parse Atom feed from XML string
	 */
	async parseFromString(xml: string, feedUrl: string): Promise<{ podcast: Podcast; episodes: Episode[] }> {
		logger.methodEntry('AtomParser', 'parseFromString', feedUrl);

		try {
			const feed = await this.parser.parseString(xml);
			const podcast = this.extractPodcastData(feed, feedUrl);
			const episodes = this.extractEpisodesData(feed, podcast.id);

			logger.info(`Parsed Atom feed: ${podcast.title}, ${episodes.length} episodes`);
			logger.methodExit('AtomParser', 'parseFromString');

			return { podcast, episodes };
		} catch (error) {
			logger.error('Failed to parse Atom feed', error);
			throw new FeedParseError('Failed to parse Atom feed', feedUrl, error);
		}
	}

	/**
	 * Parse Atom feed from URL
	 */
	async parseFromUrl(feedUrl: string): Promise<{ podcast: Podcast; episodes: Episode[] }> {
		logger.methodEntry('AtomParser', 'parseFromUrl', feedUrl);

		try {
			const feed = await this.parser.parseURL(feedUrl);
			const podcast = this.extractPodcastData(feed, feedUrl);
			const episodes = this.extractEpisodesData(feed, podcast.id);

			logger.info(`Parsed Atom feed: ${podcast.title}, ${episodes.length} episodes`);
			logger.methodExit('AtomParser', 'parseFromUrl');

			return { podcast, episodes };
		} catch (error) {
			logger.error('Failed to parse Atom feed from URL', error);
			throw new FeedParseError('Failed to parse Atom feed from URL', feedUrl, error);
		}
	}

	/**
	 * Extract podcast metadata from Atom feed
	 */
	private extractPodcastData(feed: AtomFeed, feedUrl: string): Podcast {
		const id = generatePodcastId(feedUrl);

		// Get title
		const title = feed.title?.trim() || 'Untitled Podcast';

		// Get author
		const author = feed.author?.trim() || 'Unknown Author';

		// Get description (subtitle or summary)
		const description = feed.subtitle?.trim() || 'No description available';

		// Get image URL
		const imageUrl = feed.image?.url?.trim();

		// Get website URL
		const websiteUrl = feed.link?.trim();

		// Get language
		const language = feed.language?.trim();

		const podcast: Podcast = {
			id,
			title,
			author,
			description,
			feedUrl,
			imageUrl,
			websiteUrl,
			language,
			subscribedAt: new Date(),
			lastFetchedAt: new Date(),
		};

		return podcast;
	}

	/**
	 * Extract episodes from Atom feed
	 */
	private extractEpisodesData(feed: AtomFeed, podcastId: string): Episode[] {
		if (!feed.items || feed.items.length === 0) {
			logger.warn('No episodes found in Atom feed');
			return [];
		}

		const episodes: Episode[] = [];

		for (const item of feed.items) {
			try {
				const episode = this.extractEpisodeData(item, podcastId);
				if (episode) {
					episodes.push(episode);
				}
			} catch (error) {
				logger.warn('Failed to parse episode, skipping', error);
				// Continue parsing other episodes
			}
		}

		return episodes;
	}

	/**
	 * Extract episode data from Atom entry
	 */
	private extractEpisodeData(item: AtomItem, podcastId: string): Episode | null {
		// Audio URL is required
		if (!item.enclosure?.url) {
			logger.warn('Episode missing audio URL, skipping');
			return null;
		}

		const audioUrl = item.enclosure.url.trim();

		// Generate episode ID from entry ID or audio URL
		const id = generateEpisodeId(item.id || audioUrl);

		// Get title
		const title = item.title?.trim() || 'Untitled Episode';

		// Get description (prefer content over summary)
		const description =
			item.content?.trim() ||
			item.summary?.trim() ||
			'No description available';

		// Duration not typically available in Atom feeds
		const duration = 0;

		// Get publish date
		const publishDate = item.pubDate ? new Date(item.pubDate) : new Date();

		// Get file size
		const fileSize = item.enclosure.length ? parseInt(item.enclosure.length, 10) : undefined;

		// Get MIME type
		const mimeType = item.enclosure.type?.trim();

		const episode: Episode = {
			id,
			podcastId,
			title,
			description,
			audioUrl,
			duration,
			publishDate,
			fileSize,
			mimeType,
			guid: item.id?.trim(),
		};

		// Extract chapter data
		if (item['podcast:chapters']) {
			const chaptersData = item['podcast:chapters'];
			if (typeof chaptersData === 'string') {
				episode.chaptersUrl = chaptersData;
			} else if (chaptersData && typeof chaptersData === 'object' && '$' in chaptersData) {
				const attrs = (chaptersData as { $?: { url?: string } }).$;
				if (attrs?.url) {
					episode.chaptersUrl = attrs.url;
				}
			}
		}

		if (item['psc:chapters']) {
			const pscData = item['psc:chapters'];
			if (pscData && typeof pscData === 'object' && 'psc:chapter' in (pscData as Record<string, unknown>)) {
				const chapterParser = new ChapterParser();
				const chapters = chapterParser.parseInlineChapters(
					(pscData as { 'psc:chapter'?: unknown })['psc:chapter']
				);
				if (chapters.length > 0) {
					episode.chapters = chapterParser.normalizeChapters(chapters, duration);
				}
			}
		}

		return episode;
	}

	/**
	 * Validate Atom feed XML
	 */
	static validateXML(xml: string): boolean {
		if (!xml || typeof xml !== 'string') {
			return false;
		}

		const trimmed = xml.trim();

		// Check if it starts with XML declaration or feed tag
		if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<feed')) {
			return false;
		}

		// Check if it contains feed tag with Atom namespace
		if (!trimmed.includes('<feed') || !trimmed.includes('xmlns="http://www.w3.org/2005/Atom"')) {
			return false;
		}

		return true;
	}
}
