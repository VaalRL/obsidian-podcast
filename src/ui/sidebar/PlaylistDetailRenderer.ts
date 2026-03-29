/**
 * PlaylistDetailRenderer - Renders playlist and queue detail views with episode lists
 */

import { Menu, Notice, setIcon } from 'obsidian';
import { Episode, Playlist, Queue } from '../../model';
import { RenameModal } from '../RenameModal';
import { logger } from '../../utils/Logger';
import { formatDuration, formatDate } from './SidebarUtils';
import type { SidebarContext } from './SidebarContext';

/**
 * Render playlist details (episodes)
 */
export async function renderPlaylistDetails(
	container: HTMLElement,
	playlist: Playlist,
	ctx: SidebarContext,
	signal?: AbortSignal
): Promise<void> {
	const detailsContainer = container.createDiv({ cls: 'playlist-details-container' });

	let totalDuration = 0;
	const episodeManager = ctx.plugin.getEpisodeManager();
	try {
		const episodes = await episodeManager.getEpisodesWithProgress(playlist.episodeIds);
		totalDuration = episodes.reduce((sum, e) => sum + (e.duration || 0), 0);
	} catch (error) {
		logger.error('Failed to calculate playlist duration', error);
	}

	const metadata = detailsContainer.createDiv({ cls: 'playlist-details-metadata' });
	if (playlist.description) {
		metadata.createEl('p', { text: playlist.description, cls: 'playlist-details-description' });
	}

	const durationText = totalDuration > 0 ? ` \u2022 ${formatDuration(totalDuration)}` : '';

	metadata.createEl('p', {
		text: `${playlist.episodeIds.length} episodes${durationText} \u2022 Created ${formatDate(playlist.createdAt)}`,
		cls: 'playlist-details-info'
	});

	await renderPlaylistEpisodeList(detailsContainer, playlist, ctx, signal);
}

/**
 * Render episode list for playlist
 */
async function renderPlaylistEpisodeList(
	container: HTMLElement,
	playlist: Playlist,
	ctx: SidebarContext,
	signal?: AbortSignal
): Promise<void> {
	const episodeIds = playlist.episodeIds;

	if (episodeIds.length === 0) {
		const empty = container.createDiv({ cls: 'empty-state' });
		empty.createEl('p', { text: 'No episodes in this playlist' });
		return;
	}

	const episodeManager = ctx.plugin.getEpisodeManager();
	const listContainer = container.createDiv({ cls: 'playlist-episode-list' });
	ctx.renderLoading(listContainer);
	listContainer.empty();

	for (let i = 0; i < episodeIds.length; i++) {
		if (signal?.aborted) return;
		const episodeId = episodeIds[i];
		try {
			const episodeWithProgress = await episodeManager.getEpisodeWithProgress(episodeId);
			if (episodeWithProgress) {
				renderPlaylistEpisodeItem(listContainer, episodeWithProgress, i, playlist, ctx);
			}
		} catch (error) {
			logger.error(`Failed to load episode: ${episodeId}`, error);
		}
	}
}

/**
 * Render a single episode item in playlist
 */
function renderPlaylistEpisodeItem(
	container: HTMLElement,
	episode: Episode,
	index: number,
	playlist: Playlist,
	ctx: SidebarContext
): void {
	const playerController = ctx.plugin.playerController;
	const playerState = playerController.getState();
	const isCurrent = playerState.currentEpisode?.id === episode.id;
	const isPlaying = isCurrent && playerState.status === 'playing';

	const item = container.createDiv({
		cls: isCurrent ? 'playlist-episode-item current' : 'playlist-episode-item',
		attr: { 'data-episode-id': episode.id }
	});

	item.draggable = true;
	item.addEventListener('dragstart', (e) => {
		ctx.dragDropHandler.handleDragStart(e, index, 'playlist', playlist.id);
	});
	item.addEventListener('dragend', (e) => ctx.dragDropHandler.handleDragEnd(e));
	item.addEventListener('dragover', (e) => ctx.dragDropHandler.handleDragOver(e));
	item.addEventListener('dragenter', (e) => ctx.dragDropHandler.handleDragEnter(e));
	item.addEventListener('dragleave', (e) => ctx.dragDropHandler.handleDragLeave(e));
	item.addEventListener('drop', (e) => {
		void ctx.dragDropHandler.handleDrop(e, index, 'playlist', playlist.id);
	});

	const actionEl = item.createDiv({ cls: 'queue-episode-action' });

	if (isCurrent && isPlaying) {
		const pauseIcon = actionEl.createDiv({ cls: 'icon-current' });
		setIcon(pauseIcon, 'pause');
	} else {
		const dragIcon = actionEl.createDiv({ cls: 'icon-drag' });
		setIcon(dragIcon, 'grip-vertical');

		const playIcon = actionEl.createDiv({ cls: 'icon-play' });
		setIcon(playIcon, 'play');
	}

	const info = item.createDiv({ cls: 'playlist-episode-info' });
	info.createEl('h4', { text: episode.title, cls: 'playlist-episode-title' });

	const metadata = info.createDiv({ cls: 'playlist-episode-metadata' });
	if (episode.duration) {
		metadata.createSpan({ text: formatDuration(episode.duration), cls: 'playlist-episode-duration' });
	}

	const deleteBtn = item.createEl('button', {
		cls: 'playlist-episode-delete clickable-icon',
		attr: { 'aria-label': 'Remove from playlist' }
	});
	setIcon(deleteBtn, 'trash');
	deleteBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		void (async () => {
			const playlistManager = ctx.plugin.getPlaylistManager();
			await playlistManager.removeEpisode(playlist.id, episode.id);

			const updated = await playlistManager.getPlaylist(playlist.id);
			if (updated) ctx.onSelectPlaylist(updated);
			await ctx.requestRender();
		})();
	});

	item.addEventListener('click', (e) => {
		e.stopPropagation();
		void (async () => {
			try {
				const currentState = ctx.plugin.playerController.getState();
				const isCurrentlyPlaying = currentState.currentEpisode?.id === episode.id;

				if (isCurrentlyPlaying) {
					if (currentState.status === 'playing') {
						ctx.plugin.playerController.pause();
					} else {
						await ctx.plugin.playerController.play();
					}
				} else {
					await ctx.onPlayEpisode(episode, false, playlist);
				}
			} catch (error) {
				logger.error('Failed to play/pause episode', error);
			}
		})();
	});

	item.addEventListener('contextmenu', (e) => {
		e.preventDefault();
		showPlaylistEpisodeContextMenu(episode, index, e, playlist, ctx);
	});
}

/**
 * Render queue details (episodes)
 */
export async function renderQueueDetails(
	container: HTMLElement,
	queue: Queue,
	ctx: SidebarContext,
	signal?: AbortSignal
): Promise<void> {
	const detailsContainer = container.createDiv({ cls: 'playlist-details-container' });

	const header = detailsContainer.createDiv({ cls: 'playlist-details-header podcast-sidebar-header-flex' });

	let totalDuration = 0;
	const episodeManager = ctx.plugin.getEpisodeManager();
	try {
		const episodes = await episodeManager.getEpisodesWithProgress(queue.episodeIds);
		totalDuration = episodes.reduce((sum, e) => sum + (e.duration || 0), 0);
	} catch (error) {
		logger.error('Failed to calculate queue duration', error);
	}

	const metadata = header.createDiv({ cls: 'playlist-details-metadata' });
	const durationText = totalDuration > 0 ? ` \u2022 ${formatDuration(totalDuration)}` : '';

	metadata.createEl('p', {
		text: `${queue.episodeIds.length} episodes${durationText}`,
		cls: 'playlist-details-count'
	});

	const playAllBtn = header.createEl('button', {
		text: 'Play queue',
		cls: 'playlist-play-all-button clickable-icon'
	});
	setIcon(playAllBtn, 'play');
	playAllBtn.addEventListener('click', () => {
		void handlePlayQueueFromDetails(queue, ctx);
	});

	const listContainer = detailsContainer.createDiv({ cls: 'episode-list-container' });

	if (queue.episodeIds.length === 0) {
		const empty = listContainer.createDiv({ cls: 'empty-state' });
		empty.createEl('p', { text: 'Queue is empty' });
		return;
	}

	const episodes: Episode[] = [];

	for (const episodeId of queue.episodeIds) {
		if (signal?.aborted) return;
		const episode = await episodeManager.getEpisodeWithProgress(episodeId);
		if (episode) {
			episodes.push(episode);
		}
	}

	episodes.forEach((episode, index) => {
		if (signal?.aborted) return;
		renderQueueEpisodeItem(listContainer, episode, index, queue, ctx);
	});
}

/**
 * Handle play queue from details view
 */
async function handlePlayQueueFromDetails(queue: Queue, ctx: SidebarContext): Promise<void> {
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
 * Render a single episode item in queue
 */
function renderQueueEpisodeItem(
	container: HTMLElement,
	episode: Episode,
	index: number,
	queue: Queue,
	ctx: SidebarContext
): void {
	const playerController = ctx.plugin.playerController;
	const playerState = playerController.getState();
	const isCurrent = playerState.currentEpisode?.id === episode.id;
	const isPlaying = isCurrent && playerState.status === 'playing';

	const item = container.createDiv({
		cls: isCurrent ? 'playlist-episode-item current' : 'playlist-episode-item',
		attr: { 'data-episode-id': episode.id }
	});

	item.draggable = true;
	item.addEventListener('dragstart', (e) => {
		ctx.dragDropHandler.handleDragStart(e, index, 'queue', queue.id);
	});
	item.addEventListener('dragend', (e) => ctx.dragDropHandler.handleDragEnd(e));
	item.addEventListener('dragover', (e) => ctx.dragDropHandler.handleDragOver(e));
	item.addEventListener('dragenter', (e) => ctx.dragDropHandler.handleDragEnter(e));
	item.addEventListener('dragleave', (e) => ctx.dragDropHandler.handleDragLeave(e));
	item.addEventListener('drop', (e) => {
		void ctx.dragDropHandler.handleDrop(e, index, 'queue', queue.id);
	});

	const actionEl = item.createDiv({ cls: 'queue-episode-action' });

	if (isCurrent && isPlaying) {
		const pauseIcon = actionEl.createDiv({ cls: 'icon-current' });
		setIcon(pauseIcon, 'pause');
	} else {
		const dragIcon = actionEl.createDiv({ cls: 'icon-drag' });
		setIcon(dragIcon, 'grip-vertical');

		const playIcon = actionEl.createDiv({ cls: 'icon-play' });
		setIcon(playIcon, 'play');
	}

	const info = item.createDiv({ cls: 'playlist-episode-info' });
	info.createEl('h4', { text: episode.title, cls: 'playlist-episode-title' });

	const metadata = info.createDiv({ cls: 'playlist-episode-metadata' });
	if (episode.duration) {
		metadata.createSpan({ text: formatDuration(episode.duration), cls: 'playlist-episode-duration' });
	}

	const deleteBtn = item.createEl('button', {
		cls: 'playlist-episode-delete clickable-icon',
		attr: { 'aria-label': 'Remove from queue' }
	});
	setIcon(deleteBtn, 'trash');
	deleteBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		void (async () => {
			const queueManager = ctx.plugin.getQueueManager();
			await queueManager.removeEpisode(queue.id, episode.id);

			const updated = await queueManager.getQueue(queue.id);
			if (updated) ctx.onSelectQueue(updated);
			await ctx.requestRender();
		})();
	});

	item.addEventListener('click', (e) => {
		e.stopPropagation();
		void (async () => {
			try {
				const currentState = ctx.plugin.playerController.getState();
				const isCurrentlyPlaying = currentState.currentEpisode?.id === episode.id;

				if (isCurrentlyPlaying) {
					if (currentState.status === 'playing') {
						ctx.plugin.playerController.pause();
					} else {
						await ctx.plugin.playerController.play();
					}
				} else {
					const queueManager = ctx.plugin.getQueueManager();
					queueManager.setCurrentQueue(queue.id);
					await queueManager.jumpTo(queue.id, index);
					await ctx.plugin.playerController.loadEpisode(episode, true);
				}
			} catch (error) {
				logger.error('Failed to play/pause episode', error);
			}
		})();
	});

	item.addEventListener('contextmenu', (e) => {
		e.preventDefault();
		ctx.onShowEpisodeContextMenu(episode, e);
	});
}

/**
 * Show context menu for episode in playlist
 */
function showPlaylistEpisodeContextMenu(
	episode: Episode,
	index: number,
	event: MouseEvent,
	playlist: Playlist,
	ctx: SidebarContext
): void {
	const menu = new Menu();

	menu.addItem((item) =>
		item
			.setTitle('View details')
			.setIcon('info')
			.onClick(() => ctx.onEpisodeClick(episode))
	);

	menu.addSeparator();

	menu.addItem((item) =>
		item
			.setTitle('Play')
			.setIcon('play')
			.onClick(() => void ctx.onPlayEpisode(episode, false, playlist))
	);

	menu.addSeparator();

	menu.addItem((item) =>
		item
			.setTitle('Remove from playlist')
			.setIcon('trash')
			.onClick(() => {
				void (async () => {
					try {
						const playlistManager = ctx.plugin.getPlaylistManager();
						await playlistManager.removeEpisode(playlist.id, episode.id);
						const updated = await playlistManager.getPlaylist(playlist.id);
						if (updated) ctx.onSelectPlaylist(updated);
						new Notice('Episode removed from playlist');
						await ctx.requestRender();
					} catch (error) {
						logger.error('Failed to remove episode', error);
						new Notice('Failed to remove episode');
					}
				})();
			})
	);

	menu.showAtMouseEvent(event);
}

/**
 * Update play state icons without rebuilding the DOM
 */
export function updateListIcons(contentEl: HTMLElement, ctx: SidebarContext): void {
	try {
		const playerController = ctx.plugin.playerController;
		const state = playerController.getState();
		const currentId = state.currentEpisode?.id;
		const isPlaying = state.status === 'playing';

		const items = contentEl.querySelectorAll('.playlist-episode-item');
		items.forEach((item) => {
			const id = item.getAttribute('data-episode-id');

			const actionEl = item.querySelector('.queue-episode-action');
			if (!actionEl) return;

			if (id === currentId) {
				item.addClass('current');
				actionEl.empty();

				if (isPlaying) {
					const pauseIcon = (actionEl as HTMLElement).createDiv({ cls: 'icon-current' });
					setIcon(pauseIcon, 'pause');
				} else {
					const playIcon = (actionEl as HTMLElement).createDiv({ cls: 'icon-current' });
					setIcon(playIcon, 'play');
				}
			} else {
				item.removeClass('current');
				actionEl.empty();

				const dragIcon = (actionEl as HTMLElement).createDiv({ cls: 'icon-drag' });
				setIcon(dragIcon, 'grip-vertical');

				const playIcon = (actionEl as HTMLElement).createDiv({ cls: 'icon-play' });
				setIcon(playIcon, 'play');
			}
		});
	} catch (error) {
		logger.error('Failed to update list icons', error);
	}
}

/**
 * Handle rename playlist
 */
export function handleRenamePlaylist(playlist: Playlist, ctx: SidebarContext): void {
	new RenameModal(
		ctx.app,
		'Rename playlist',
		playlist.name,
		'Enter new playlist name',
		(newName) => {
			void (async () => {
				if (!newName || newName === playlist.name) return;

				try {
					const playlistManager = ctx.plugin.getPlaylistManager();
					await playlistManager.updatePlaylist(playlist.id, { name: newName });

					new Notice(`Playlist renamed to "${newName}"`);

					const updated = await playlistManager.getPlaylist(playlist.id);
					if (updated) ctx.onSelectPlaylist(updated);
					await ctx.requestRender();
				} catch (error) {
					logger.error('Failed to rename playlist', error);
					new Notice('Failed to rename playlist');
				}
			})();
		},
		() => {
			void (async () => {
				try {
					const playlistManager = ctx.plugin.getPlaylistManager();
					await playlistManager.deletePlaylist(playlist.id);

					new Notice('Playlist deleted');
					ctx.onSelectPlaylist(null);
					await ctx.requestRender();
				} catch (error) {
					logger.error('Failed to delete playlist', error);
					new Notice('Failed to delete playlist');
				}
			})();
		}
	).open();
}

/**
 * Handle rename queue
 */
export function handleRenameQueue(queue: Queue, ctx: SidebarContext): void {
	new RenameModal(
		ctx.app,
		'Rename queue',
		queue.name,
		'Enter new queue name',
		(newName) => {
			void (async () => {
				if (!newName || newName === queue.name) return;

				try {
					const queueManager = ctx.plugin.getQueueManager();
					await queueManager.updateQueue(queue.id, { name: newName });

					queue.name = newName;

					new Notice('Queue renamed');
					await ctx.requestRender();
				} catch (error) {
					logger.error('Failed to rename queue', error);
					new Notice('Failed to rename queue');
				}
			})();
		},
		() => {
			void (async () => {
				try {
					const queueManager = ctx.plugin.getQueueManager();
					await queueManager.deleteQueue(queue.id);

					new Notice('Queue deleted');
					ctx.onSelectQueue(null);
					await ctx.requestRender();
				} catch (error) {
					logger.error('Failed to delete queue', error);
					new Notice('Failed to delete queue');
				}
			})();
		}
	).open();
}
