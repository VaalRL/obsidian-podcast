/**
 * EpisodeListRenderer - Renders the episode list for a selected podcast
 */

import { setIcon } from 'obsidian';
import { Episode } from '../../model';
import { filterEpisodes, sortEpisodes, formatDuration } from './SidebarUtils';
import type { SidebarContext } from './SidebarContext';

export interface EpisodeListOptions {
	podcastId: string;
	sortBy: 'title' | 'date' | 'duration';
	sortDirection: 'asc' | 'desc';
}

/**
 * Render the list of episodes for the selected podcast
 */
export async function renderEpisodeList(
	container: HTMLElement,
	ctx: SidebarContext,
	options: EpisodeListOptions,
	signal?: AbortSignal
): Promise<void> {
	const listContainer = container.createDiv({ cls: 'episode-list-container' });
	ctx.renderLoading(listContainer);

	const subscriptionStore = ctx.plugin.getSubscriptionStore();
	const podcast = await subscriptionStore.getPodcast(options.podcastId);
	let episodes = podcast?.episodes || [];

	if (ctx.searchQuery) {
		episodes = filterEpisodes(episodes, ctx.searchQuery);
	}

	episodes = sortEpisodes(episodes, options.sortBy, options.sortDirection);

	if (episodes.length === 0) {
		const empty = listContainer.createDiv({ cls: 'empty-state' });
		if (ctx.searchQuery) {
			empty.createEl('p', { text: 'No episodes found' });
			empty.createEl('p', {
				text: `No episodes match "${ctx.searchQuery}"`,
				cls: 'empty-state-hint'
			});
		} else {
			empty.createEl('p', { text: 'No episodes available' });
			empty.createEl('p', {
				text: 'Try refreshing the feed',
				cls: 'empty-state-hint'
			});
		}
		return;
	}

	listContainer.empty();

	for (const episode of episodes) {
		if (signal?.aborted) return;
		renderEpisodeItem(listContainer, episode, ctx);
	}
}

/**
 * Render a single episode item
 */
function renderEpisodeItem(container: HTMLElement, episode: Episode, ctx: SidebarContext): void {
	const item = container.createDiv({ cls: 'episode-item' });

	const info = item.createDiv({ cls: 'episode-info' });
	info.createEl('h4', { text: episode.title, cls: 'episode-title' });

	const metadata = info.createDiv({ cls: 'episode-metadata' });

	const date = new Date(episode.publishDate);
	metadata.createSpan({
		text: date.toLocaleDateString(),
		cls: 'episode-date'
	});

	if (episode.duration) {
		metadata.createSpan({
			text: ` \u2022 ${formatDuration(episode.duration)}`,
			cls: 'episode-duration'
		});
	}

	const actions = item.createDiv({ cls: 'episode-item-actions' });

	const playBtn = actions.createEl('button', {
		cls: 'episode-action-button clickable-icon',
		attr: { 'aria-label': 'Play' }
	});
	setIcon(playBtn, 'play');
	playBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		void ctx.onPlayEpisode(episode, true);
	});

	const addBtn = actions.createEl('button', {
		cls: 'episode-action-button clickable-icon',
		attr: { 'aria-label': 'Add to playlist' }
	});
	setIcon(addBtn, 'plus');
	addBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		void ctx.onShowAddToMenu(episode, e);
	});

	item.addEventListener('click', () => {
		ctx.onEpisodeClick(episode);
	});

	item.addEventListener('contextmenu', (e) => {
		e.preventDefault();
		ctx.onShowEpisodeContextMenu(episode, e);
	});
}
