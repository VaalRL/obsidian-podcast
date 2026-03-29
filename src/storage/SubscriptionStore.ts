/**
 * SubscriptionStore - Manages podcast subscriptions
 *
 * V2: Stores podcast index in subscriptions.json, episodes in per-podcast files
 * under subscriptions/episodes/{podcastId}.json for reduced I/O on episode updates.
 */

import { Vault, normalizePath } from 'obsidian';
import { logger } from '../utils/Logger';
import { StorageError } from '../utils/errorUtils';
import { Podcast, Episode } from '../model';
import { DataPathManager } from './DataPathManager';
import { SingleFileStore } from './FileSystemStore';

/**
 * Subscription data structure
 */
export interface SubscriptionData {
	podcasts: Podcast[];
	version: number;
}

/**
 * Per-podcast episode file format
 */
interface EpisodeFileData {
	podcastId: string;
	episodes: Episode[];
}

/**
 * SubscriptionStore - Manages podcast subscriptions
 */
export class SubscriptionStore extends SingleFileStore<SubscriptionData> {
	private static readonly CURRENT_VERSION = 2;

	private episodesDir: string;
	private migrated = false;
	private migrationPromise: Promise<void> | null = null;

	constructor(vault: Vault, pathManager: DataPathManager) {
		const filePath = pathManager.getFilePath('subscriptions', 'subscriptions.json');
		super(vault, pathManager, filePath);
		this.episodesDir = pathManager.getStructure().subscriptionEpisodes;
	}

	/**
	 * Validate subscription data
	 */
	protected validate(data: SubscriptionData): boolean {
		if (!data || typeof data !== 'object') {
			logger.warn('Invalid subscription data: not an object');
			return false;
		}

		if (!Array.isArray(data.podcasts)) {
			logger.warn('Invalid subscription data: podcasts is not an array');
			return false;
		}

		if (typeof data.version !== 'number') {
			logger.warn('Invalid subscription data: version is not a number');
			return false;
		}

		// Validate each podcast
		for (const podcast of data.podcasts) {
			if (!this.validatePodcast(podcast)) {
				logger.warn('Invalid podcast in subscription data', podcast);
				return false;
			}
		}

		return true;
	}

	/**
	 * Validate a single podcast object
	 */
	private validatePodcast(podcast: Podcast): boolean {
		if (!podcast || typeof podcast !== 'object') {
			return false;
		}

		// Reject IDs containing path separators to prevent path traversal
		if (typeof podcast.id !== 'string' || /[\/\\.]/.test(podcast.id)) {
			logger.warn('Invalid podcast id format rejected during validation');
			return false;
		}

		const requiredFields = ['id', 'title', 'feedUrl', 'subscribedAt'];
		for (const field of requiredFields) {
			if (!(field in podcast)) {
				logger.warn(`Missing required field in podcast: ${field}`);
				return false;
			}
		}

		return true;
	}

	/**
	 * Get default subscription data
	 */
	protected getDefaultValue(): SubscriptionData {
		return {
			podcasts: [],
			version: SubscriptionStore.CURRENT_VERSION,
		};
	}

	// ---- Episode file helpers ----

	private getEpisodeFilePath(podcastId: string): string {
		return normalizePath(`${this.episodesDir}/${podcastId}.json`);
	}

	private async loadEpisodeFile(podcastId: string): Promise<Episode[]> {
		const filePath = this.getEpisodeFilePath(podcastId);
		const data = await this.readJson<EpisodeFileData>(filePath, { podcastId, episodes: [] });
		return data.episodes || [];
	}

	private async saveEpisodeFile(podcastId: string, episodes: Episode[]): Promise<void> {
		const filePath = this.getEpisodeFilePath(podcastId);
		await this.writeJson(filePath, { podcastId, episodes });
	}

	private async deleteEpisodeFile(podcastId: string): Promise<void> {
		const filePath = this.getEpisodeFilePath(podcastId);
		try {
			if (await this.fileExists(filePath)) {
				await this.deleteFile(filePath);
			}
		} catch (error) {
			logger.warn('Failed to delete episode file', error);
		}
	}

	// ---- V1 -> V2 migration ----

	private async ensureMigrated(): Promise<void> {
		if (this.migrated) return;

		// Deduplicate concurrent migration calls
		if (this.migrationPromise) {
			await this.migrationPromise;
			return;
		}

		this.migrationPromise = (async () => {
			const data = await this.load();
			if (data.version < 2) {
				await this.migrateV1toV2(data);
			}
			this.migrated = true;
		})();

		try {
			await this.migrationPromise;
		} finally {
			this.migrationPromise = null;
		}
	}

	private async migrateV1toV2(data: SubscriptionData): Promise<void> {
		logger.info('Migrating subscription storage from V1 to V2');

		// Ensure episodes directory exists
		const adapter = this.vault.adapter;
		if (!(await adapter.exists(this.episodesDir))) {
			await adapter.mkdir(this.episodesDir);
		}

		// Write per-podcast episode files first (before stripping from index)
		for (const podcast of data.podcasts) {
			if (podcast.episodes && podcast.episodes.length > 0) {
				await this.saveEpisodeFile(podcast.id, podcast.episodes);
			}
		}

		// Only strip episodes after all files written successfully
		const strippedPodcasts: Podcast[] = data.podcasts.map(podcast => {
			const { episodes: _, ...rest } = podcast;
			return rest as Podcast;
		});

		// Update version and save index
		data.podcasts = strippedPodcasts;
		data.version = 2;
		await this.save(data, true);

		logger.info('Migration to V2 complete');
	}

	// ---- Public methods ----

	/**
	 * Get all subscribed podcasts
	 */
	async getAllPodcasts(): Promise<Podcast[]> {
		logger.methodEntry('SubscriptionStore', 'getAllPodcasts');
		await this.ensureMigrated();

		const data = await this.load();

		// Reassemble: load episodes for each podcast (batched)
		const podcasts = [...data.podcasts];
		const BATCH_SIZE = 10;
		for (let i = 0; i < podcasts.length; i += BATCH_SIZE) {
			const batch = podcasts.slice(i, i + BATCH_SIZE);
			const episodeResults = await Promise.all(
				batch.map(p => this.loadEpisodeFile(p.id))
			);
			for (let j = 0; j < batch.length; j++) {
				batch[j].episodes = episodeResults[j];
			}
		}

		logger.methodExit('SubscriptionStore', 'getAllPodcasts');
		return podcasts;
	}

	/**
	 * Get a podcast by ID
	 */
	async getPodcast(id: string): Promise<Podcast | null> {
		logger.methodEntry('SubscriptionStore', 'getPodcast', id);
		await this.ensureMigrated();

		const data = await this.load();
		const podcast = data.podcasts.find(p => p.id === id);
		if (!podcast) {
			logger.methodExit('SubscriptionStore', 'getPodcast');
			return null;
		}

		// Load episodes from separate file
		const result = { ...podcast };
		result.episodes = await this.loadEpisodeFile(id);

		logger.methodExit('SubscriptionStore', 'getPodcast');
		return result;
	}

	/**
	 * Get a podcast by feed URL
	 */
	async getPodcastByFeedUrl(feedUrl: string): Promise<Podcast | null> {
		logger.methodEntry('SubscriptionStore', 'getPodcastByFeedUrl', feedUrl);
		await this.ensureMigrated();

		const data = await this.load();
		const podcast = data.podcasts.find(p => p.feedUrl === feedUrl);
		if (!podcast) {
			logger.methodExit('SubscriptionStore', 'getPodcastByFeedUrl');
			return null;
		}

		const result = { ...podcast };
		result.episodes = await this.loadEpisodeFile(result.id);

		logger.methodExit('SubscriptionStore', 'getPodcastByFeedUrl');
		return result;
	}

	/**
	 * Add a new podcast subscription
	 */
	async addPodcast(podcast: Podcast): Promise<void> {
		logger.methodEntry('SubscriptionStore', 'addPodcast', podcast.id);

		if (!this.validatePodcast(podcast)) {
			throw new StorageError('Invalid podcast data', this.filePath);
		}
		await this.ensureMigrated();

		const data = await this.load();

		// Extract episodes
		const episodes = podcast.episodes || [];
		const podcastForIndex = { ...podcast };
		delete podcastForIndex.episodes;

		const existingIndex = data.podcasts.findIndex(p => p.id === podcast.id);
		if (existingIndex !== -1) {
			logger.warn('Podcast already exists, updating instead', podcast.id);
			data.podcasts[existingIndex] = podcastForIndex;
		} else {
			data.podcasts.push(podcastForIndex);
		}

		await this.save(data);

		// Save episodes separately
		if (episodes.length > 0) {
			await this.saveEpisodeFile(podcast.id, episodes);
		}

		logger.methodExit('SubscriptionStore', 'addPodcast');
	}

	/**
	 * Update an existing podcast subscription
	 */
	async updatePodcast(podcast: Podcast): Promise<void> {
		logger.methodEntry('SubscriptionStore', 'updatePodcast', podcast.id);

		if (!this.validatePodcast(podcast)) {
			throw new StorageError('Invalid podcast data', this.filePath);
		}
		await this.ensureMigrated();

		const data = await this.load();
		const index = data.podcasts.findIndex(p => p.id === podcast.id);

		if (index === -1) {
			throw new StorageError(`Podcast not found: ${podcast.id}`, this.filePath);
		}

		// Extract episodes
		const episodes = podcast.episodes || [];
		const podcastForIndex = { ...podcast };
		delete podcastForIndex.episodes;

		data.podcasts[index] = podcastForIndex;
		await this.save(data);

		// Save episodes separately
		await this.saveEpisodeFile(podcast.id, episodes);

		logger.methodExit('SubscriptionStore', 'updatePodcast');
	}

	/**
	 * Remove a podcast subscription
	 */
	async removePodcast(id: string): Promise<void> {
		logger.methodEntry('SubscriptionStore', 'removePodcast', id);
		await this.ensureMigrated();

		const data = await this.load();
		const index = data.podcasts.findIndex(p => p.id === id);

		if (index === -1) {
			logger.warn('Podcast not found, nothing to remove', id);
			return;
		}

		data.podcasts.splice(index, 1);
		await this.save(data);

		// Delete episode file
		await this.deleteEpisodeFile(id);

		logger.methodExit('SubscriptionStore', 'removePodcast');
	}

	/**
	 * Check if a podcast is subscribed
	 */
	async isSubscribed(id: string): Promise<boolean> {
		await this.ensureMigrated();
		const data = await this.load();
		return data.podcasts.some(p => p.id === id);
	}

	/**
	 * Check if a feed URL is subscribed
	 */
	async isSubscribedByFeedUrl(feedUrl: string): Promise<boolean> {
		await this.ensureMigrated();
		const data = await this.load();
		return data.podcasts.some(p => p.feedUrl === feedUrl);
	}

	/**
	 * Get subscription count
	 */
	async getSubscriptionCount(): Promise<number> {
		await this.ensureMigrated();
		const data = await this.load();
		return data.podcasts.length;
	}

	/**
	 * Update podcast episodes (without replacing the whole podcast object)
	 */
	async updatePodcastEpisodes(id: string, episodes: Podcast['episodes']): Promise<void> {
		logger.methodEntry('SubscriptionStore', 'updatePodcastEpisodes', id);
		await this.ensureMigrated();

		const data = await this.load();
		const podcast = data.podcasts.find(p => p.id === id);

		if (!podcast) {
			throw new StorageError(`Podcast not found: ${id}`, this.filePath);
		}

		// Update lastFetchedAt in index
		podcast.lastFetchedAt = new Date();
		await this.save(data);

		// Save episodes to separate file (the big I/O win)
		await this.saveEpisodeFile(id, episodes || []);

		logger.methodExit('SubscriptionStore', 'updatePodcastEpisodes');
	}

	/**
	 * Update podcast settings
	 */
	async updatePodcastSettings(id: string, settings: Podcast['settings']): Promise<void> {
		logger.methodEntry('SubscriptionStore', 'updatePodcastSettings', id);

		const data = await this.load();
		const podcast = data.podcasts.find(p => p.id === id);

		if (!podcast) {
			throw new StorageError(`Podcast not found: ${id}`, this.filePath);
		}

		podcast.settings = settings;

		await this.save(data);
		logger.methodExit('SubscriptionStore', 'updatePodcastSettings');
	}

	/**
	 * Get podcasts that need feed updates
	 * (based on lastFetchedAt and update interval)
	 */
	async getPodcastsNeedingUpdate(updateIntervalMs: number): Promise<Podcast[]> {
		const data = await this.load();
		const now = Date.now();

		return data.podcasts.filter(podcast => {
			if (!podcast.lastFetchedAt) {
				return true; // Never fetched
			}

			const lastFetched = new Date(podcast.lastFetchedAt).getTime();
			return now - lastFetched >= updateIntervalMs;
		});
	}

	/**
	 * Search podcasts by title or author
	 */
	async searchPodcasts(query: string): Promise<Podcast[]> {
		const data = await this.load();
		const lowercaseQuery = query.toLowerCase();

		return data.podcasts.filter(podcast => {
			const titleMatch = podcast.title.toLowerCase().includes(lowercaseQuery);
			const authorMatch = podcast.author?.toLowerCase().includes(lowercaseQuery);
			return titleMatch || authorMatch;
		});
	}

	/**
	 * Export all subscriptions (for backup or migration)
	 */
	async exportSubscriptions(): Promise<SubscriptionData> {
		logger.methodEntry('SubscriptionStore', 'exportSubscriptions');

		// Export with episodes inline for portability
		const podcasts = await this.getAllPodcasts();

		logger.methodExit('SubscriptionStore', 'exportSubscriptions');
		return {
			podcasts,
			version: SubscriptionStore.CURRENT_VERSION,
		};
	}

	/**
	 * Import subscriptions (for restore or migration)
	 * Merges with existing subscriptions by default
	 */
	async importSubscriptions(importData: SubscriptionData, replace = false): Promise<void> {
		logger.methodEntry('SubscriptionStore', 'importSubscriptions', `replace=${replace}`);

		if (!this.validate(importData)) {
			throw new StorageError('Invalid import data', this.filePath);
		}

		if (replace) {
			// Delete all existing episode files
			const currentData = await this.load();
			for (const podcast of currentData.podcasts) {
				await this.deleteEpisodeFile(podcast.id);
			}

			// Save new data split
			const indexPodcasts: Podcast[] = [];
			for (const podcast of importData.podcasts) {
				const episodes = podcast.episodes || [];
				const podcastForIndex = { ...podcast };
				delete podcastForIndex.episodes;
				indexPodcasts.push(podcastForIndex);

				if (episodes.length > 0) {
					await this.saveEpisodeFile(podcast.id, episodes);
				}
			}

			await this.save({
				podcasts: indexPodcasts,
				version: SubscriptionStore.CURRENT_VERSION,
			});
		} else {
			// Merge
			await this.ensureMigrated();
			const currentData = await this.load();
			const mergedPodcasts = [...currentData.podcasts];

			for (const importedPodcast of importData.podcasts) {
				const episodes = importedPodcast.episodes || [];
				const podcastForIndex = { ...importedPodcast };
				delete podcastForIndex.episodes;

				const existingIndex = mergedPodcasts.findIndex(p => p.id === importedPodcast.id);
				if (existingIndex !== -1) {
					mergedPodcasts[existingIndex] = podcastForIndex;
				} else {
					mergedPodcasts.push(podcastForIndex);
				}

				// Save episode file
				if (episodes.length > 0) {
					await this.saveEpisodeFile(importedPodcast.id, episodes);
				}
			}

			await this.save({
				podcasts: mergedPodcasts,
				version: SubscriptionStore.CURRENT_VERSION,
			});
		}

		logger.methodExit('SubscriptionStore', 'importSubscriptions');
	}
}
