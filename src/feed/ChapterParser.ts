/**
 * ChapterParser - Parses podcast chapter markers from RSS feeds
 *
 * Supports two chapter formats:
 * 1. Podcasting 2.0 external JSON (podcast:chapters)
 * 2. Podlove Simple Chapters (psc:chapters) inline XML
 */

import { requestUrl } from 'obsidian';
import { Chapter } from '../model';
import { logger } from '../utils/Logger';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_SIZE = 1_048_576; // 1 MB

export class ChapterParser {
	/**
	 * Fetch and parse Podcasting 2.0 external chapters JSON
	 */
	async parseExternalChapters(chaptersUrl: string): Promise<Chapter[]> {
		try {
			const response = await requestUrl({
				url: chaptersUrl,
				method: 'GET',
				headers: { 'Accept': 'application/json' },
			});

			if (response.status !== 200) {
				logger.warn(`ChapterParser: HTTP ${response.status} fetching chapters from ${chaptersUrl}`);
				return [];
			}

			const text = typeof response.text === 'string' ? response.text : '';
			if (text.length > MAX_RESPONSE_SIZE) {
				logger.warn(`ChapterParser: Response too large (${text.length} bytes)`);
				return [];
			}

			const json = JSON.parse(text) as unknown;
			if (!json || typeof json !== 'object') return [];

			const data = json as Record<string, unknown>;
			if (!Array.isArray(data.chapters)) return [];

			const chapters: Chapter[] = [];
			for (const entry of data.chapters as unknown[]) {
				if (!entry || typeof entry !== 'object') continue;
				const ch = entry as Record<string, unknown>;

				const startTime = typeof ch.startTime === 'number' ? ch.startTime : NaN;
				const title = typeof ch.title === 'string' ? ch.title : '';

				if (!isFinite(startTime) || startTime < 0 || !title) continue;

				chapters.push({
					title,
					startTime,
					endTime: typeof ch.endTime === 'number' && isFinite(ch.endTime) ? ch.endTime : undefined,
					imageUrl: typeof ch.img === 'string' ? ch.img : undefined,
					url: typeof ch.url === 'string' ? ch.url : undefined,
				});
			}

			return chapters;
		} catch (error) {
			logger.warn('ChapterParser: Failed to fetch external chapters', error);
			return [];
		}
	}

	/**
	 * Parse inline Podlove Simple Chapters (PSC) data
	 * Expects rss-parser extracted data in the form of an array of objects with $ attributes
	 */
	parseInlineChapters(pscData: unknown): Chapter[] {
		if (!Array.isArray(pscData)) return [];

		const chapters: Chapter[] = [];
		for (const item of pscData) {
			if (!item || typeof item !== 'object') continue;

			const attrs = (item as Record<string, unknown>).$ as Record<string, unknown> | undefined;
			if (!attrs) continue;

			const startStr = typeof attrs.start === 'string' ? attrs.start : '';
			const title = typeof attrs.title === 'string' ? attrs.title : '';

			if (!startStr || !title) continue;

			const startTime = this.parseISO8601Duration(startStr);
			if (!isFinite(startTime) || startTime < 0) continue;

			chapters.push({
				title,
				startTime,
				imageUrl: typeof attrs.image === 'string' ? attrs.image : undefined,
				url: typeof attrs.href === 'string' ? attrs.href : undefined,
			});
		}

		return chapters;
	}

	/**
	 * Parse ISO 8601 duration string to seconds
	 * Handles: PT1H2M30S, PT30M, PT45S, PT1H, and also HH:MM:SS / MM:SS / plain seconds
	 */
	parseISO8601Duration(duration: string): number {
		if (!duration) return NaN;

		const trimmed = duration.trim();

		// Plain number → treat as seconds
		const asNum = Number(trimmed);
		if (!isNaN(asNum) && trimmed === String(asNum)) return asNum;

		// HH:MM:SS or MM:SS format
		if (trimmed.includes(':')) {
			const parts = trimmed.split(':').map(p => parseInt(p, 10));
			if (parts.some(isNaN)) return NaN;
			if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
			if (parts.length === 2) return parts[0] * 60 + parts[1];
			return NaN;
		}

		// ISO 8601 duration: PT1H2M30S
		const match = trimmed.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
		if (!match) return NaN;

		const hours = match[1] ? parseInt(match[1], 10) : 0;
		const minutes = match[2] ? parseInt(match[2], 10) : 0;
		const seconds = match[3] ? parseFloat(match[3]) : 0;

		return hours * 3600 + minutes * 60 + seconds;
	}

	/**
	 * Sort chapters by startTime and infer endTime from next chapter
	 */
	normalizeChapters(chapters: Chapter[], episodeDuration?: number): Chapter[] {
		if (chapters.length === 0) return [];

		// Sort by startTime
		const sorted = [...chapters].sort((a, b) => a.startTime - b.startTime);

		// Infer endTime from next chapter's startTime
		for (let i = 0; i < sorted.length; i++) {
			if (i < sorted.length - 1) {
				sorted[i].endTime = sorted[i].endTime ?? sorted[i + 1].startTime;
			} else if (episodeDuration !== undefined && episodeDuration > 0) {
				sorted[i].endTime = sorted[i].endTime ?? episodeDuration;
			}
		}

		return sorted;
	}
}
