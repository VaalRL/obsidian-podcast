/**
 * PlaylistListRenderer - Renders the playlist and queue list view
 */

import { Menu, Notice, setIcon } from 'obsidian';
import { Playlist, Queue } from '../../model';
import { logger } from '../../utils/Logger';
import { filterPlaylists, sortPlaylists, formatDate } from './SidebarUtils';
import type { SidebarContext } from './SidebarContext';

export interface PlaylistListOptions {
	sortBy: 'name' | 'date' | 'count';
	sortDirection: 'asc' | 'desc';
}

/**
 * Render the list of playlists and queues
 */
export async function renderPlaylistList(
	container: HTMLElement,
	ctx: SidebarContext,
	options: PlaylistListOptions,
	signal?: AbortSignal
): Promise<void> {
	const listContainer = container.createDiv({ cls: 'playlist-list-container' });
	ctx.renderLoading(listContainer);

	listContainer.empty();

	const queueManager = ctx.plugin.getQueueManager();
	const allQueues = await queueManager.getAllQueues();

	if (allQueues.length > 0) {
		const queueSection = listContainer.createDiv({ cls: 'queue-section-sidebar' });
		queueSection.createEl('h4', { text: 'Queues', cls: 'section-title' });

		for (const queue of allQueues) {
			if (signal?.aborted) return;
			renderQueueAsPlaylistItem(queueSection, queue, ctx);
		}
	}

	const playlistManager = ctx.plugin.getPlaylistManager();
	let playlists = await playlistManager.getAllPlaylists();

	if (ctx.searchQuery) {
		playlists = filterPlaylists(playlists, ctx.searchQuery);
	}

	playlists = sortPlaylists(playlists, options.sortBy, options.sortDirection);

	if (playlists.length > 0 || ctx.searchQuery) {
		const playlistSection = listContainer.createDiv({ cls: 'playlist-section-sidebar' });
		if (!ctx.searchQuery) {
			playlistSection.createEl('h4', { text: 'Playlists', cls: 'section-title' });
		}

		if (playlists.length === 0) {
			const empty = playlistSection.createDiv({ cls: 'empty-state' });
			if (ctx.searchQuery) {
				empty.createEl('p', { text: 'No playlists found' });
				empty.createEl('p', {
					text: `No playlists match "${ctx.searchQuery}"`,
					cls: 'empty-state-hint'
				});
			} else {
				empty.createEl('p', { text: 'No playlists yet' });
				empty.createEl('p', {
					text: 'Click the + button to create a playlist',
					cls: 'empty-state-hint'
				});
			}
		} else {
			for (const playlist of playlists) {
				if (signal?.aborted) return;
				renderPlaylistItem(playlistSection, playlist, ctx);
			}
		}
	} else if (allQueues.length === 0) {
		const empty = listContainer.createDiv({ cls: 'empty-state' });
		empty.createEl('p', { text: 'No playlists yet' });
		empty.createEl('p', {
			text: 'Click the + button to create a playlist',
			cls: 'empty-state-hint'
		});
	}
}

/**
 * Render a queue as a playlist item
 */
function renderQueueAsPlaylistItem(container: HTMLElement, queue: Queue, ctx: SidebarContext): void {
	const item = container.createDiv({ cls: 'playlist-item queue-item' });

	const info = item.createDiv({ cls: 'playlist-info' });
	info.createEl('h3', { text: queue.name, cls: 'playlist-title' });

	const metadata = info.createDiv({ cls: 'playlist-metadata' });
	metadata.createSpan({ text: `${queue.episodeIds.length} episodes`, cls: 'playlist-count' });
	metadata.createSpan({ text: ` \u2022 Updated ${formatDate(queue.updatedAt)}`, cls: 'playlist-date' });

	const playBtn = item.createEl('button', {
		cls: 'playlist-play-button clickable-icon',
		attr: { 'aria-label': 'Play queue' }
	});
	setIcon(playBtn, 'play');
	playBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		void handlePlayQueue(queue, ctx);
	});

	item.addEventListener('click', () => {
		ctx.onSelectQueue(queue);
	});

	item.addEventListener('contextmenu', (e) => {
		e.preventDefault();
		showQueueContextMenu(queue, e, ctx);
	});
}

/**
 * Render a single playlist item
 */
function renderPlaylistItem(container: HTMLElement, playlist: Playlist, ctx: SidebarContext): void {
	const item = container.createDiv({ cls: 'playlist-item' });

	const info = item.createDiv({ cls: 'playlist-info' });
	info.createEl('h3', { text: playlist.name, cls: 'playlist-title' });

	if (playlist.description) {
		info.createEl('p', { text: playlist.description, cls: 'playlist-description' });
	}

	const metadata = info.createDiv({ cls: 'playlist-metadata' });
	metadata.createSpan({ text: `${playlist.episodeIds.length} episodes`, cls: 'playlist-count' });
	metadata.createSpan({ text: ` \u2022 Updated ${formatDate(playlist.updatedAt)}`, cls: 'playlist-date' });

	const playBtn = item.createEl('button', {
		cls: 'playlist-play-button clickable-icon',
		attr: { 'aria-label': 'Play playlist' }
	});
	setIcon(playBtn, 'play');
	playBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		void handlePlayPlaylist(playlist, ctx);
	});

	item.addEventListener('click', () => {
		ctx.onSelectPlaylist(playlist);
	});

	item.addEventListener('contextmenu', (e) => {
		e.preventDefault();
		showPlaylistContextMenu(playlist, e, ctx);
	});
}

/**
 * Handle play queue
 */
async function handlePlayQueue(queue: Queue, ctx: SidebarContext): Promise<void> {
	if (queue.episodeIds.length === 0) {
		new Notice('Queue is empty');
		return;
	}

	try {
		const queueManager = ctx.plugin.getQueueManager();
		queueManager.setCurrentQueue(queue.id);

		const episodeManager = ctx.plugin.getEpisodeManager();
		const firstEpisodeId = queue.episodeIds[queue.currentIndex] || queue.episodeIds[0];
		const episode = await episodeManager.getEpisodeWithProgress(firstEpisodeId);

		if (episode) {
			await ctx.plugin.playerController.loadEpisode(episode, true, true);
		}
	} catch (error) {
		logger.error('Failed to play queue', error);
		new Notice('Failed to play queue');
	}
}

/**
 * Handle play playlist
 */
async function handlePlayPlaylist(playlist: Playlist, ctx: SidebarContext): Promise<void> {
	if (playlist.episodeIds.length === 0) {
		new Notice('Playlist is empty');
		return;
	}

	try {
		const episodeManager = ctx.plugin.getEpisodeManager();
		const episodeId = playlist.episodeIds[0];
		const episode = await episodeManager.getEpisodeWithProgress(episodeId);

		if (episode) {
			await ctx.onPlayEpisode(episode, false, playlist);
		} else {
			new Notice('Failed to load episode from playlist');
		}
	} catch (error) {
		logger.error('Failed to play playlist', error);
		new Notice('Failed to play playlist');
	}
}

/**
 * Show context menu for queue
 */
function showQueueContextMenu(queue: Queue, event: MouseEvent, ctx: SidebarContext): void {
	const menu = new Menu();

	menu.addItem((item) =>
		item
			.setTitle('View details')
			.setIcon('list')
			.onClick(() => {
				ctx.onSelectQueue(queue);
			})
	);

	menu.addItem((item) =>
		item
			.setTitle('Play')
			.setIcon('play')
			.onClick(() => {
				void handlePlayQueue(queue, ctx);
			})
	);

	menu.addItem((item) =>
		item
			.setTitle('Rename')
			.setIcon('pencil')
			.onClick(() => {
				void (async () => {
					const newName = await ctx.promptForInput('Rename Queue', 'Enter new name:', queue.name);
					if (!newName || newName === queue.name) return;

					try {
						const queueManager = ctx.plugin.getQueueManager();
						await queueManager.updateQueue(queue.id, { name: newName });
						new Notice('Queue renamed');
						await ctx.requestRender();
					} catch (error) {
						logger.error('Failed to rename queue', error);
						new Notice('Failed to rename queue');
					}
				})();
			})
	);

	menu.addSeparator();

	menu.addItem((item) =>
		item
			.setTitle('Clear queue')
			.setIcon('eraser')
			.onClick(() => {
				void (async () => {
					try {
						const queueManager = ctx.plugin.getQueueManager();
						await queueManager.clearQueue(queue.id);
						new Notice('Queue cleared');
						await ctx.requestRender();
					} catch (error) {
						logger.error('Failed to clear queue', error);
						new Notice('Failed to clear queue');
					}
				})();
			})
	);

	menu.addItem((item) =>
		item
			.setTitle('Delete queue')
			.setIcon('trash')
			.onClick(() => {
				void (async () => {
					try {
						const queueManager = ctx.plugin.getQueueManager();
						await queueManager.deleteQueue(queue.id);
						new Notice('Queue deleted');
						await ctx.requestRender();
					} catch (error) {
						logger.error('Failed to delete queue', error);
						new Notice('Failed to delete queue');
					}
				})();
			})
	);

	menu.showAtMouseEvent(event);
}

/**
 * Show context menu for playlist
 */
function showPlaylistContextMenu(playlist: Playlist, event: MouseEvent, ctx: SidebarContext): void {
	const menu = new Menu();

	menu.addItem((item) =>
		item
			.setTitle('View details')
			.setIcon('list')
			.onClick(() => {
				ctx.onSelectPlaylist(playlist);
			})
	);

	menu.addItem((item) =>
		item
			.setTitle('Rename')
			.setIcon('pencil')
			.onClick(() => {
				void (async () => {
					const newName = await ctx.promptForInput('Rename Playlist', 'Enter new name:', playlist.name);
					if (!newName || newName === playlist.name) return;

					try {
						const playlistManager = ctx.plugin.getPlaylistManager();
						await playlistManager.updatePlaylist(playlist.id, { name: newName });
						new Notice('Playlist renamed');
						await ctx.requestRender();
					} catch (error) {
						logger.error('Failed to rename playlist', error);
						new Notice('Failed to rename playlist');
					}
				})();
			})
	);

	menu.addSeparator();

	menu.addItem((item) =>
		item
			.setTitle('Delete')
			.setIcon('trash')
			.onClick(() => {
				void (async () => {
					try {
						const playlistManager = ctx.plugin.getPlaylistManager();
						await playlistManager.deletePlaylist(playlist.id);
						new Notice('Playlist deleted');
						await ctx.requestRender();
					} catch (error) {
						logger.error('Failed to delete playlist', error);
						new Notice('Failed to delete playlist');
					}
				})();
			})
	);

	menu.showAtMouseEvent(event);
}

/**
 * Handle create playlist
 */
export async function handleCreatePlaylist(ctx: SidebarContext): Promise<void> {
	try {
		const name = await ctx.promptForInput('Create Playlist', 'Enter playlist name:');
		if (!name) return;

		const description = await ctx.promptForInput('Playlist Description', 'Enter description (optional):');

		const playlistManager = ctx.plugin.getPlaylistManager();
		await playlistManager.createPlaylist(name, description || undefined);

		new Notice(`Playlist "${name}" created`);
		await ctx.requestRender();
	} catch (error) {
		logger.error('Failed to create playlist', error);
		new Notice('Failed to create playlist');
	}
}

/**
 * Handle create queue
 */
export async function handleCreateQueue(ctx: SidebarContext): Promise<void> {
	try {
		const name = await ctx.promptForInput('Create Queue', 'Enter queue name:');
		if (!name) return;

		const queueManager = ctx.plugin.getQueueManager();
		await queueManager.createQueue(name);

		new Notice(`Queue "${name}" created`);
		await ctx.requestRender();
	} catch (error) {
		logger.error('Failed to create queue', error);
		new Notice('Failed to create queue');
	}
}
