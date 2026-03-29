/**
 * PodcastListRenderer - Renders the podcast list and all-episodes view
 */

import { setIcon } from 'obsidian';
import { Podcast, Episode } from '../../model';
import { EpisodeStatistics } from '../../podcast/EpisodeManager';
import { logger } from '../../utils/Logger';
import {
	filterPodcasts,
	sortPodcasts,
	filterEpisodes,
	sortEpisodes,
	formatDuration,
	formatDate,
} from './SidebarUtils';
import type { SidebarContext } from './SidebarContext';

export interface PodcastListOptions {
	sortBy: 'title' | 'author' | 'date' | 'count' | 'unplayed' | 'latest';
	sortDirection: 'asc' | 'desc';
}

export interface AllEpisodesOptions {
	episodeSortBy: 'title' | 'date' | 'duration';
	episodeSortDirection: 'asc' | 'desc';
}

/**
 * Load podcasts from store
 */
async function loadPodcasts(ctx: SidebarContext): Promise<Podcast[]> {
	try {
		const subscriptionStore = ctx.plugin.getSubscriptionStore();
		return await subscriptionStore.getAllPodcasts();
	} catch (error) {
		logger.error('Failed to load podcasts', error);
		return [];
	}
}

/**
 * Load statistics for podcasts (parallel loading for performance)
 */
async function loadPodcastStats(
	podcasts: Podcast[],
	podcastStats: Map<string, EpisodeStatistics>,
	ctx: SidebarContext
): Promise<void> {
	const episodeManager = ctx.plugin.getEpisodeManager();

	const podcastsToLoad = podcasts.filter(p => !podcastStats.has(p.id));

	if (podcastsToLoad.length === 0) {
		return;
	}

	const BATCH_SIZE = 5;
	for (let i = 0; i < podcastsToLoad.length; i += BATCH_SIZE) {
		const batch = podcastsToLoad.slice(i, i + BATCH_SIZE);
		const results = await Promise.all(
			batch.map(async (podcast) => {
				try {
					const stats = await episodeManager.getPodcastStatistics(podcast.id);
					return { podcastId: podcast.id, stats };
				} catch (error) {
					logger.error(`Failed to load stats for podcast ${podcast.id}`, error);
					return { podcastId: podcast.id, stats: null };
				}
			})
		);

		for (const result of results) {
			if (result.stats) {
				podcastStats.set(result.podcastId, result.stats);
			}
		}
	}
}

/**
 * Render the list of podcasts
 */
export async function renderPodcastList(
	container: HTMLElement,
	ctx: SidebarContext,
	options: PodcastListOptions,
	signal?: AbortSignal
): Promise<void> {
	const listContainer = container.createDiv({ cls: 'podcast-list-container' });
	ctx.renderLoading(listContainer);

	let podcasts = await loadPodcasts(ctx);

	await loadPodcastStats(podcasts, ctx.podcastStats, ctx);

	if (ctx.searchQuery) {
		podcasts = filterPodcasts(podcasts, ctx.searchQuery);
	}

	podcasts = sortPodcasts(podcasts, options.sortBy, options.sortDirection, ctx.podcastStats);

	if (podcasts.length === 0) {
		const empty = listContainer.createDiv({ cls: 'empty-state' });
		if (ctx.searchQuery) {
			empty.createEl('p', { text: 'No podcasts found' });
			empty.createEl('p', {
				text: `No podcasts match "${ctx.searchQuery}"`,
				cls: 'empty-state-hint'
			});
		} else {
			empty.createEl('p', { text: 'No podcasts yet' });
			empty.createEl('p', {
				text: 'Click the + button to subscribe to a podcast',
				cls: 'empty-state-hint'
			});
		}
		return;
	}

	listContainer.empty();

	for (const podcast of podcasts) {
		if (signal?.aborted) return;
		renderPodcastItem(listContainer, podcast, ctx);
	}
}

/**
 * Render a single podcast item
 */
function renderPodcastItem(container: HTMLElement, podcast: Podcast, ctx: SidebarContext): void {
	const item = container.createDiv({ cls: 'podcast-item' });

	if (podcast.imageUrl) {
		item.createEl('img', {
			cls: 'podcast-image',
			attr: {
				src: podcast.imageUrl,
				alt: podcast.title
			}
		});
	} else {
		const placeholder = item.createDiv({ cls: 'podcast-image-placeholder' });
		setIcon(placeholder, 'mic');
	}

	const info = item.createDiv({ cls: 'podcast-info' });
	info.createEl('h3', { text: podcast.title, cls: 'podcast-title' });
	info.createEl('p', { text: podcast.author, cls: 'podcast-author' });

	const stats = ctx.podcastStats.get(podcast.id);
	if (stats) {
		const statsText = [];
		statsText.push(`${stats.totalEpisodes} eps`);
		if (stats.unplayedEpisodes > 0) {
			statsText.push(`${stats.unplayedEpisodes} new`);
		}

		info.createDiv({
			text: statsText.join(' • '),
			cls: 'podcast-episode-count'
		});
	} else {
		const episodeCount = podcast.episodes?.length || 0;
		info.createDiv({
			text: `${episodeCount} episodes`,
			cls: 'podcast-episode-count'
		});
	}

	item.addEventListener('click', () => {
		ctx.onSelectPodcast(podcast);
	});

	item.addEventListener('contextmenu', (e) => {
		e.preventDefault();
		ctx.onShowPodcastContextMenu(podcast, e);
	});
}

/**
 * Render all episodes from all podcasts in a single list
 */
export async function renderAllEpisodes(
	container: HTMLElement,
	ctx: SidebarContext,
	options: AllEpisodesOptions,
	signal?: AbortSignal
): Promise<void> {
	const listContainer = container.createDiv({ cls: 'episode-list-container' });
	ctx.renderLoading(listContainer);

	const subscriptionStore = ctx.plugin.getSubscriptionStore();
	const podcasts = await subscriptionStore.getAllPodcasts();

	let allEpisodes: Episode[] = [];
	const podcastMap = new Map<string, Podcast>();

	for (const podcast of podcasts) {
		podcastMap.set(podcast.id, podcast);
		if (podcast.episodes) {
			allEpisodes.push(...podcast.episodes);
		}
	}

	if (ctx.searchQuery) {
		allEpisodes = filterEpisodes(allEpisodes, ctx.searchQuery);
	}

	allEpisodes = sortEpisodes(allEpisodes, options.episodeSortBy, options.episodeSortDirection);

	if (allEpisodes.length === 0) {
		const empty = listContainer.createDiv({ cls: 'empty-state' });
		if (ctx.searchQuery) {
			empty.createEl('p', { text: 'No episodes found' });
			empty.createEl('p', {
				text: `No episodes match "${ctx.searchQuery}"`,
				cls: 'empty-state-hint'
			});
		} else {
			empty.createEl('p', { text: 'No episodes yet' });
			empty.createEl('p', {
				text: 'Subscribe to podcasts to see episodes here',
				cls: 'empty-state-hint'
			});
		}
		return;
	}

	listContainer.empty();

	for (const episode of allEpisodes) {
		if (signal?.aborted) return;
		const podcast = podcastMap.get(episode.podcastId);
		renderAllEpisodesItem(listContainer, episode, podcast, ctx);
	}
}

/**
 * Render a single episode item in the all episodes view
 */
function renderAllEpisodesItem(
	container: HTMLElement,
	episode: Episode,
	podcast: Podcast | undefined,
	ctx: SidebarContext
): void {
	const item = container.createDiv({ cls: 'episode-item all-episodes-item' });

	const info = item.createDiv({ cls: 'episode-info' });

	info.createEl('div', {
		text: episode.title,
		cls: 'episode-title'
	});

	const meta = info.createDiv({ cls: 'episode-meta' });
	if (podcast) {
		meta.createSpan({ text: podcast.title, cls: 'episode-podcast-name' });
		meta.createSpan({ text: ' \u2022 ', cls: 'episode-meta-separator' });
	}
	meta.createSpan({
		text: formatDate(new Date(episode.publishDate)),
		cls: 'episode-date'
	});
	if (episode.duration) {
		meta.createSpan({ text: ' \u2022 ', cls: 'episode-meta-separator' });
		meta.createSpan({
			text: formatDuration(episode.duration),
			cls: 'episode-duration'
		});
	}

	const actions = item.createDiv({ cls: 'episode-actions' });

	const playBtn = actions.createEl('button', {
		cls: 'episode-action-button clickable-icon',
		attr: { 'aria-label': 'Play episode' }
	});
	setIcon(playBtn, 'play');
	playBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		void ctx.onPlayEpisode(episode);
	});

	const addBtn = actions.createEl('button', {
		cls: 'episode-action-button clickable-icon',
		attr: { 'aria-label': 'Add to queue or playlist' }
	});
	setIcon(addBtn, 'plus');
	addBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		void ctx.onShowAddToMenu(episode, e);
	});

	item.addEventListener('click', () => ctx.onEpisodeClick(episode));

	item.addEventListener('contextmenu', (e) => {
		e.preventDefault();
		ctx.onShowEpisodeContextMenu(episode, e);
	});
}
