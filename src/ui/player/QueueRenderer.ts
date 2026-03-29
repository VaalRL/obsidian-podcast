/**
 * QueueRenderer - Renders queue and playlist sections in the player view
 *
 * Handles rendering of the current queue or playlist episode list,
 * including drag-and-drop reordering and mobile reorder buttons.
 * Extracted from PlayerView to reduce file size and improve modularity.
 */

import { setIcon, Platform } from 'obsidian';
import type { Queue, Playlist } from '../../model';
import type { EpisodeWithProgress } from '../../podcast';
import { logger } from '../../utils/Logger';
import type { PlayerContext } from './PlayerContext';

/**
 * Get the current queue (from QueueManager or fallback)
 */
export async function getCurrentQueue(ctx: PlayerContext): Promise<Queue | null> {
	try {
		const queueManager = ctx.plugin.getQueueManager();

		// Always try to get the current queue from QueueManager first
		const currentQueue = await queueManager.getCurrentQueue();
		if (currentQueue) {
			ctx.setCurrentQueueId(currentQueue.id);
			return currentQueue;
		}

		// If QueueManager doesn't have a current queue, try to use our local ID
		const localId = ctx.getCurrentQueueId();
		if (localId) {
			const queue = await queueManager.getQueue(localId);
			if (queue) {
				// Sync back to QueueManager
				queueManager.setCurrentQueue(queue.id);
				return queue;
			}
		}

		// Otherwise, get the first available queue (or default queue)
		const allQueues = await queueManager.getAllQueues();
		if (allQueues.length > 0) {
			ctx.setCurrentQueueId(allQueues[0].id);
			queueManager.setCurrentQueue(allQueues[0].id);
			return allQueues[0];
		}

		return null;
	} catch (error) {
		logger.error('Failed to get current queue', error);
		return null;
	}
}

/**
 * Render queue section (queue or playlist depending on state)
 */
export async function renderQueueSection(container: HTMLElement, ctx: PlayerContext): Promise<void> {
	const queueSection = container.createDiv({ cls: 'queue-section' });

	try {
		const playerController = ctx.plugin.playerController;

		// Check if playing from a playlist
		if (playerController.isPlayingFromPlaylist()) {
			const playlist = playerController.getCurrentPlaylist();
			if (playlist) {
				await renderPlaylistSection(queueSection, playlist, ctx);
				return;
			}
		}

		// Otherwise, render queue section
		const queue = await getCurrentQueue(ctx);

		// Section header with queue name
		const header = queueSection.createDiv({ cls: 'queue-header' });

		let titleText = 'Current Queue';
		if (queue) {
			if (queue.isPlaylist) {
				const name = queue.name.startsWith('Playlist: ') ? queue.name.substring(10) : queue.name;
				titleText = `Current Playlist: ${name}`;
			} else {
				titleText = `Current Queue: ${queue.name}`;
			}
		}

		header.createEl('h3', { text: titleText, cls: 'queue-title' });

		if (!queue || queue.episodeIds.length === 0) {
			const emptyState = queueSection.createDiv({ cls: 'queue-empty-state' });
			emptyState.createEl('p', { text: 'No queue active' });
			emptyState.createEl('p', {
				text: 'Add episodes to queue to see them here',
				cls: 'queue-empty-hint'
			});
			return;
		}

		// Episode list
		await renderQueueEpisodeList(queueSection, queue, ctx);

	} catch (error) {
		logger.error('Failed to render queue section', error);
		const errorState = queueSection.createDiv({ cls: 'queue-error-state' });
		errorState.createEl('p', { text: 'Failed to load queue' });
	}
}

/**
 * Render playlist section (when playing from playlist)
 */
async function renderPlaylistSection(container: HTMLElement, playlist: Playlist, ctx: PlayerContext): Promise<void> {
	const header = container.createDiv({ cls: 'queue-header' });
	header.createEl('h3', { text: `Current Playlist: ${playlist.name}`, cls: 'queue-title' });

	if (playlist.episodeIds.length === 0) {
		const emptyState = container.createDiv({ cls: 'queue-empty-state' });
		emptyState.createEl('p', { text: 'Playlist is empty' });
		return;
	}

	const listContainer = container.createDiv({ cls: 'queue-episode-list' });

	const episodeManager = ctx.plugin.getEpisodeManager();
	const playerController = ctx.plugin.playerController;
	const currentIndex = playerController.getCurrentPlaylistIndex();
	const playerState = playerController.getState();
	const isCurrentlyPlaying = playerState.status === 'playing';

	// Info bar
	const info = listContainer.createDiv({ cls: 'queue-info' });
	info.createSpan({
		text: `${playlist.episodeIds.length} episodes`,
		cls: 'queue-count'
	});
	info.createSpan({
		text: ` • Playing ${currentIndex + 1} of ${playlist.episodeIds.length}`,
		cls: 'queue-position'
	});

	// Episodes list
	const episodesContainer = listContainer.createDiv({ cls: 'queue-episodes' });

	for (let i = 0; i < playlist.episodeIds.length; i++) {
		const episodeId = playlist.episodeIds[i];
		const episode = await episodeManager.getEpisodeWithProgress(episodeId);

		if (episode) {
			const isCurrent = i === currentIndex;
			renderPlaylistEpisodeItem(episodesContainer, episode, i, isCurrent, isCurrentlyPlaying, ctx);
		}
	}
}

/**
 * Render a single playlist episode item
 */
function renderPlaylistEpisodeItem(
	container: HTMLElement,
	episode: EpisodeWithProgress,
	index: number,
	isCurrent: boolean,
	isPlaying: boolean,
	ctx: PlayerContext
): void {
	const item = container.createDiv({ cls: `queue-episode-item ${isCurrent ? 'current' : ''}` });
	item.setAttribute('data-episode-id', episode.id);
	item.setAttribute('data-index', String(index));

	// Action icon
	const actionEl = item.createDiv({ cls: 'queue-episode-action' });

	if (isCurrent) {
		const icon = actionEl.createDiv({ cls: 'icon-current' });
		setIcon(icon, isPlaying ? 'pause' : 'play');
	} else {
		const playIcon = actionEl.createDiv({ cls: 'icon-play' });
		setIcon(playIcon, 'play');
	}

	// Episode info
	const info = item.createDiv({ cls: 'queue-episode-info' });
	info.createEl('span', { text: episode.title, cls: 'queue-episode-title' });

	if (episode.duration) {
		info.createEl('span', {
			text: ctx.formatTime(episode.duration),
			cls: 'queue-episode-duration'
		});
	}

	// Click to play this episode
	item.addEventListener('click', () => {
		void (async () => {
			const playerController = ctx.plugin.playerController;
			const playlist = playerController.getCurrentPlaylist();

			if (playlist) {
				playerController.setCurrentPlaylist(playlist, index);
				await playerController.loadEpisode(episode, true, true);
			}
		})();
	});
}

/**
 * Render queue episode list
 */
async function renderQueueEpisodeList(container: HTMLElement, queue: Queue, ctx: PlayerContext): Promise<void> {
	const listContainer = container.createDiv({ cls: 'queue-episode-list' });

	if (queue.episodeIds.length === 0) {
		listContainer.createEl('p', {
			text: 'Queue is empty',
			cls: 'queue-empty-text'
		});
		return;
	}

	const episodeManager = ctx.plugin.getEpisodeManager();

	// Get current playback state
	const playerController = ctx.plugin.playerController;
	const playerState = playerController.getState();
	const isCurrentlyPlaying = playerState.status === 'playing';

	// Info bar
	const info = listContainer.createDiv({ cls: 'queue-info' });
	info.createSpan({
		text: `${queue.episodeIds.length} episodes`,
		cls: 'queue-count'
	});
	info.createSpan({
		text: ` • Current: ${queue.currentIndex + 1}`,
		cls: 'queue-current'
	});

	// Episodes
	const episodesContainer = listContainer.createDiv({ cls: 'queue-episodes' });

	const displayCount = Math.min(queue.episodeIds.length, 10);
	for (let i = 0; i < displayCount; i++) {
		const episodeId = queue.episodeIds[i];
		try {
			const episode = await episodeManager.getEpisodeWithProgress(episodeId);
			if (episode) {
				const isCurrent = queue.currentIndex === i;
				renderQueueEpisodeItem(episodesContainer, episode, i, isCurrent, isCurrent && isCurrentlyPlaying, displayCount, ctx);
			}
		} catch (error) {
			logger.error(`Failed to load episode: ${episodeId}`, error);
		}
	}

	// Show "more" indicator if queue is longer
	if (queue.episodeIds.length > 10) {
		const more = episodesContainer.createDiv({ cls: 'queue-more' });
		more.createEl('span', {
			text: `+ ${queue.episodeIds.length - 10} more episodes`,
			cls: 'queue-more-text'
		});
	}
}

/**
 * Render a queue episode item
 */
function renderQueueEpisodeItem(
	container: HTMLElement,
	episode: EpisodeWithProgress,
	index: number,
	isCurrent: boolean,
	isPlaying: boolean,
	totalItems: number,
	ctx: PlayerContext
): void {
	const isMobile = Platform.isMobile;
	const item = container.createDiv({
		cls: isCurrent ? 'queue-episode-item current' : 'queue-episode-item',
		attr: { 'data-episode-id': episode.id }
	});

	// Only enable drag-and-drop on desktop
	if (!isMobile) {
		item.draggable = true;

		item.addEventListener('dragstart', (e) => {
			e.dataTransfer?.setData('text/plain', index.toString());
			item.addClass('dragging');
			if (e.dataTransfer) {
				e.dataTransfer.effectAllowed = 'move';
			}
		});

		item.addEventListener('dragend', () => {
			item.removeClass('dragging');
			container.querySelectorAll('.queue-episode-item').forEach(el => el.removeClass('drag-over'));
		});

		item.addEventListener('dragover', (e) => {
			e.preventDefault();
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = 'move';
			}
			item.addClass('drag-over');
		});

		item.addEventListener('dragleave', () => {
			item.removeClass('drag-over');
		});

		item.addEventListener('drop', (e) => {
			e.preventDefault();
			item.removeClass('drag-over');

			const fromIndex = parseInt(e.dataTransfer?.getData('text/plain') || '-1');
			const queueId = ctx.getCurrentQueueId();
			if (fromIndex >= 0 && fromIndex < totalItems && fromIndex !== index && queueId) {
				void (async () => {
					try {
						const queueManager = ctx.plugin.getQueueManager();
						await queueManager.moveEpisode(queueId, fromIndex, index);
						await ctx.requestRender();
					} catch (error) {
						logger.error('Failed to move episode', error);
					}
				})();
			}
		});
	}

	// Action Icon (Drag/Play/Pause)
	const actionEl = item.createDiv({ cls: 'queue-episode-action' });

	if (isCurrent && isPlaying) {
		// Currently playing episode - show pause icon only
		const pauseIcon = actionEl.createDiv({ cls: 'icon-current' });
		setIcon(pauseIcon, 'pause');
	} else {
		if (!isMobile) {
			// Desktop: show drag handle, swap to play on hover
			const dragIcon = actionEl.createDiv({ cls: 'icon-drag' });
			setIcon(dragIcon, 'grip-vertical');
		}

		const playIcon = actionEl.createDiv({ cls: isMobile ? 'icon-play-mobile' : 'icon-play' });
		setIcon(playIcon, 'play');
	}

	// Info
	const info = item.createDiv({ cls: 'queue-episode-info' });

	const title = info.createEl('div', {
		text: episode.title,
		cls: 'queue-episode-title'
	});

	// Truncate long titles
	if (episode.title.length > 40) {
		title.textContent = episode.title.substring(0, 40) + '...';
		title.setAttribute('title', episode.title);
	}

	// Duration
	if (episode.duration) {
		info.createEl('div', {
			text: ctx.formatDuration(episode.duration),
			cls: 'queue-episode-duration'
		});
	}

	// Mobile: Add reorder buttons
	if (isMobile && !isCurrent) {
		const reorderBtns = item.createDiv({ cls: 'queue-episode-reorder' });

		if (index > 0) {
			const moveUpBtn = reorderBtns.createEl('button', {
				cls: 'queue-reorder-btn clickable-icon',
				attr: { 'aria-label': 'Move up' }
			});
			setIcon(moveUpBtn, 'chevron-up');
			moveUpBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				void moveQueueEpisode(index, index - 1, ctx);
			});
		}

		if (index < totalItems - 1) {
			const moveDownBtn = reorderBtns.createEl('button', {
				cls: 'queue-reorder-btn clickable-icon',
				attr: { 'aria-label': 'Move down' }
			});
			setIcon(moveDownBtn, 'chevron-down');
			moveDownBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				void moveQueueEpisode(index, index + 1, ctx);
			});
		}
	}

	// Click to play/pause
	item.addEventListener('click', () => {
		void (async () => {
			try {
				const playerController = ctx.plugin.playerController;
				const playerState = playerController.getState();

				if (isCurrent) {
					// Current episode - toggle play/pause
					if (playerState.status === 'playing') {
						playerController.pause();
					} else {
						await playerController.play();
					}
				} else {
					// Other episodes - jump to and play
					const queueManager = ctx.plugin.getQueueManager();
					const queueId = ctx.getCurrentQueueId();
					if (queueId) {
						await queueManager.jumpTo(queueId, index);
						await playerController.loadEpisode(episode, true, true);
						await ctx.requestRender();
					}
				}
			} catch (error) {
				logger.error('Failed to play/pause episode from queue', error);
			}
		})();
	});
}

/**
 * Move a queue episode from one position to another (for mobile)
 */
async function moveQueueEpisode(fromIndex: number, toIndex: number, ctx: PlayerContext): Promise<void> {
	const queueId = ctx.getCurrentQueueId();
	if (!queueId) return;

	try {
		const queueManager = ctx.plugin.getQueueManager();
		await queueManager.moveEpisode(queueId, fromIndex, toIndex);
		await ctx.requestRender();
	} catch (error) {
		logger.error('Failed to move episode', error);
	}
}
