/**
 * BookmarkStore - Manages timestamped bookmarks for episodes
 *
 * Stores all bookmarks in a single JSON file keyed by episode ID.
 */

import { Vault } from 'obsidian';
import { logger } from '../utils/Logger';
import { Bookmark } from '../model';
import { DataPathManager } from './DataPathManager';
import { SingleFileStore } from './FileSystemStore';

/**
 * Bookmark data structure
 */
export interface BookmarkData {
	bookmarks: Record<string, Bookmark[]>;
	version: number;
}

/**
 * BookmarkStore - Manages episode bookmarks
 */
export class BookmarkStore extends SingleFileStore<BookmarkData> {
	private static readonly CURRENT_VERSION = 1;
	private static readonly MAX_LABEL_LENGTH = 500;
	private static readonly UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

	constructor(vault: Vault, pathManager: DataPathManager) {
		const filePath = pathManager.getFilePath('progress', 'bookmarks.json');
		super(vault, pathManager, filePath);
	}

	protected validate(data: BookmarkData): boolean {
		if (!data || typeof data !== 'object') return false;
		if (typeof data.bookmarks !== 'object' || data.bookmarks === null) return false;
		if (typeof data.version !== 'number') return false;

		for (const episodeId of Object.keys(data.bookmarks)) {
			if (BookmarkStore.UNSAFE_KEYS.has(episodeId)) return false;
			const bookmarks = data.bookmarks[episodeId];
			if (!Array.isArray(bookmarks)) return false;
			for (const b of bookmarks) {
				if (!b || typeof b.id !== 'string' || typeof b.episodeId !== 'string' ||
					typeof b.position !== 'number' || !isFinite(b.position) || b.position < 0) {
					return false;
				}
				if (b.label !== undefined && typeof b.label !== 'string') return false;
			}
		}

		return true;
	}

	/**
	 * Validate episodeId key is safe to use as object property
	 */
	private assertSafeKey(key: string): void {
		if (!key || BookmarkStore.UNSAFE_KEYS.has(key)) {
			throw new Error(`Invalid episodeId key: ${key}`);
		}
	}

	/**
	 * Sanitize and cap label length
	 */
	private sanitizeLabel(label?: string): string | undefined {
		if (!label) return undefined;
		return label.trim().slice(0, BookmarkStore.MAX_LABEL_LENGTH);
	}

	protected getDefaultValue(): BookmarkData {
		return {
			bookmarks: {},
			version: BookmarkStore.CURRENT_VERSION,
		};
	}

	/**
	 * Get all bookmarks for an episode
	 */
	async getBookmarks(episodeId: string): Promise<Bookmark[]> {
		this.assertSafeKey(episodeId);
		const data = await this.load();
		const bookmarks = data.bookmarks[episodeId] || [];
		return bookmarks.sort((a, b) => a.position - b.position);
	}

	/**
	 * Add a bookmark to an episode
	 */
	async addBookmark(episodeId: string, position: number, label?: string): Promise<Bookmark> {
		logger.methodEntry('BookmarkStore', 'addBookmark', `${episodeId} @ ${position}`);
		this.assertSafeKey(episodeId);

		const data = await this.load();
		if (!data.bookmarks[episodeId]) {
			data.bookmarks[episodeId] = [];
		}

		const bookmark: Bookmark = {
			id: crypto.randomUUID(),
			episodeId,
			position,
			label: this.sanitizeLabel(label),
			createdAt: new Date(),
		};

		data.bookmarks[episodeId].push(bookmark);
		await this.save(data);

		logger.methodExit('BookmarkStore', 'addBookmark');
		return bookmark;
	}

	/**
	 * Remove a bookmark
	 */
	async removeBookmark(episodeId: string, bookmarkId: string): Promise<void> {
		logger.methodEntry('BookmarkStore', 'removeBookmark', bookmarkId);
		this.assertSafeKey(episodeId);

		const data = await this.load();
		const bookmarks = data.bookmarks[episodeId];
		if (!bookmarks) return;

		data.bookmarks[episodeId] = bookmarks.filter(b => b.id !== bookmarkId);
		if (data.bookmarks[episodeId].length === 0) {
			delete data.bookmarks[episodeId];
		}

		await this.save(data);
		logger.methodExit('BookmarkStore', 'removeBookmark');
	}

	/**
	 * Update a bookmark's label
	 */
	async updateBookmarkLabel(episodeId: string, bookmarkId: string, label: string): Promise<void> {
		this.assertSafeKey(episodeId);
		const data = await this.load();
		const bookmarks = data.bookmarks[episodeId];
		if (!bookmarks) return;

		const bookmark = bookmarks.find(b => b.id === bookmarkId);
		if (bookmark) {
			bookmark.label = this.sanitizeLabel(label);
			await this.save(data);
		}
	}

	/**
	 * Remove all bookmarks for an episode
	 */
	async removeEpisodeBookmarks(episodeId: string): Promise<void> {
		this.assertSafeKey(episodeId);
		const data = await this.load();
		if (data.bookmarks[episodeId]) {
			delete data.bookmarks[episodeId];
			await this.save(data);
		}
	}
}
