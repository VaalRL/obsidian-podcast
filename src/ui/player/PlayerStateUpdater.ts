/**
 * PlayerStateUpdater - Handles periodic UI state updates for the player
 *
 * Updates episode info, progress bar, volume/speed sliders, and queue section.
 * Also provides play state icon updates without full DOM rebuild.
 * Extracted from PlayerView to reduce file size and improve modularity.
 */

import { setIcon, Platform } from 'obsidian';
import { logger } from '../../utils/Logger';
import type { PlayerContext } from './PlayerContext';
import { renderQueueSection } from './QueueRenderer';
import { updateCurrentChapter } from './ChaptersRenderer';

/**
 * Start the update interval for UI refresh
 */
export function startUpdateInterval(ctx: PlayerContext): number {
	return window.setInterval(() => {
		void updatePlayerState(ctx);
	}, 1000);
}

/**
 * Stop the update interval
 */
export function stopUpdateInterval(intervalId: number | null): void {
	if (intervalId !== null) {
		window.clearInterval(intervalId);
	}
}

/**
 * Update the player state in the UI (called periodically)
 */
export async function updatePlayerState(ctx: PlayerContext): Promise<void> {
	try {
		const playerController = ctx.plugin.playerController;
		const state = playerController.getState();

		// Update episode info
		const titleEl = ctx.playerContentEl.querySelector('.episode-title') as HTMLElement;
		const podcastEl = ctx.playerContentEl.querySelector('.podcast-name') as HTMLElement;
		const durationEl = ctx.playerContentEl.querySelector('.episode-duration') as HTMLElement;
		const thumbnailEl = ctx.playerContentEl.querySelector('.player-podcast-thumbnail') as HTMLImageElement;
		const infoBtnEl = ctx.playerContentEl.querySelector('.player-info-button') as HTMLElement;

		if (state.currentEpisode) {
			if (titleEl) titleEl.textContent = state.currentEpisode.title;
			if (durationEl) durationEl.textContent = ctx.formatTime(state.currentEpisode.duration);
			if (infoBtnEl) {
				infoBtnEl.removeClass('podcast-hidden');
				infoBtnEl.addClass('podcast-flex-visible');
			}

			// Update thumbnail and podcast title
			const podcastId = state.currentEpisode.podcastId;
			if (podcastId) {
				void ctx.plugin.getSubscriptionStore().getPodcast(podcastId).then(podcast => {
					if (podcast) {
						if (podcastEl) podcastEl.textContent = podcast.title;
						if (thumbnailEl && podcast.imageUrl) {
							thumbnailEl.src = podcast.imageUrl;
							thumbnailEl.removeClass('podcast-hidden');
							thumbnailEl.addClass('podcast-visible');
						} else if (thumbnailEl) {
							thumbnailEl.removeClass('podcast-visible');
							thumbnailEl.addClass('podcast-hidden');
						}
					}
				});
			} else {
				if (podcastEl) podcastEl.textContent = 'Unknown podcast';
				if (thumbnailEl) {
					thumbnailEl.removeClass('podcast-visible');
					thumbnailEl.addClass('podcast-hidden');
				}
			}
		} else {
			if (titleEl) titleEl.textContent = 'No episode playing';
			if (podcastEl) podcastEl.textContent = 'Select a podcast to start';
			if (durationEl) durationEl.textContent = '--:--';
			if (thumbnailEl) {
				thumbnailEl.removeClass('podcast-visible');
				thumbnailEl.addClass('podcast-hidden');
			}
			if (infoBtnEl) {
				infoBtnEl.removeClass('podcast-flex-visible');
				infoBtnEl.addClass('podcast-hidden');
			}
		}

		// Update play/pause button
		const playPauseBtn = ctx.playerContentEl.querySelector('.player-button-play-pause') as HTMLElement;
		if (playPauseBtn) {
			if (state.status === 'loading') {
				playPauseBtn.addClass('is-loading');
			} else {
				playPauseBtn.removeClass('is-loading');
				setIcon(playPauseBtn, state.status === 'playing' ? 'pause' : 'play');
			}
		}

		// Update time display
		const currentTimeEl = ctx.playerContentEl.querySelector('.current-time') as HTMLElement;
		const totalTimeEl = ctx.playerContentEl.querySelector('.total-time') as HTMLElement;

		if (currentTimeEl) currentTimeEl.textContent = ctx.formatTime(state.position);
		if (totalTimeEl && state.currentEpisode) {
			totalTimeEl.textContent = ctx.formatTime(state.currentEpisode.duration);
		}

		// Update progress bar and thumb
		const progressFill = ctx.playerContentEl.querySelector('.progress-fill') as HTMLElement;
		const progressThumb = ctx.playerContentEl.querySelector('.progress-bar-thumb') as HTMLElement;
		if (progressFill && !ctx.getIsDraggingProgress()) {
			if (state.currentEpisode && state.currentEpisode.duration > 0) {
				const percentage = Math.min(100, Math.max(0, (state.position / state.currentEpisode.duration) * 100));
				progressFill.setCssProps({ 'width': `${percentage}%` });
				if (progressThumb) progressThumb.setCssProps({ 'left': `${percentage}%` });
			} else {
				progressFill.setCssProps({ 'width': '0%' });
				if (progressThumb) progressThumb.setCssProps({ 'left': '0%' });
			}
		}

		// Update chapter highlights
		if (state.currentEpisode?.chapters && state.currentEpisode.chapters.length > 0) {
			const chaptersSection = ctx.playerContentEl.querySelector('.chapters-section') as HTMLElement;
			if (chaptersSection) {
				updateCurrentChapter(chaptersSection, state.position, state.currentEpisode.chapters);
			}
		}

		// Update volume slider
		const volumeSlider = ctx.playerContentEl.querySelector('.volume-slider') as HTMLInputElement;
		if (volumeSlider) {
			volumeSlider.value = String(state.volume * 100);
		}

		// Update speed slider and label
		const speedSlider = ctx.playerContentEl.querySelector('.speed-slider') as HTMLInputElement;
		const speedLabel = ctx.playerContentEl.querySelector('.speed-value') as HTMLElement;
		if (speedSlider) {
			if (document.activeElement !== speedSlider) {
				speedSlider.value = String(state.playbackSpeed);
			}
		}
		if (speedLabel) {
			speedLabel.textContent = `${state.playbackSpeed.toFixed(1)}x`;
		}

		// Check for queue/playlist updates
		const isPlayingFromPlaylist = playerController.isPlayingFromPlaylist();
		const currentPlaylist = playerController.getCurrentPlaylist();
		const currentPlaylistIndex = playerController.getCurrentPlaylistIndex();

		// Rerender if playlist state changed
		const playlistStateKey = isPlayingFromPlaylist
			? `playlist:${currentPlaylist?.id}:${currentPlaylistIndex}`
			: 'queue';

		if (ctx.getLastPlaylistStateKey() !== playlistStateKey) {
			ctx.setLastPlaylistStateKey(playlistStateKey);
			const playerContainer = ctx.playerContentEl.querySelector('.player-container') as HTMLElement;
			if (playerContainer) {
				const oldQueueSection = playerContainer.querySelector('.queue-section');
				if (oldQueueSection) {
					oldQueueSection.remove();
				}
				await renderQueueSection(playerContainer, ctx);
			}
			return;
		}

		// Only check queue updates if not playing from playlist
		if (!isPlayingFromPlaylist) {
			const queueManager = ctx.plugin.getQueueManager();
			const currentQueue = await queueManager.getCurrentQueue();

			if (currentQueue) {
				const updatedAt = currentQueue.updatedAt instanceof Date ? currentQueue.updatedAt.getTime() : new Date(currentQueue.updatedAt).getTime();

				if (currentQueue.id !== ctx.getCurrentQueueId() || updatedAt > ctx.getLastQueueUpdatedAt()) {
					ctx.setCurrentQueueId(currentQueue.id);
					ctx.setLastQueueUpdatedAt(updatedAt);

					const playerContainer = ctx.playerContentEl.querySelector('.player-container') as HTMLElement;
					if (playerContainer) {
						const oldQueueSection = playerContainer.querySelector('.queue-section');
						if (oldQueueSection) {
							oldQueueSection.remove();
						}
						await renderQueueSection(playerContainer, ctx);
					}
				}
			}
		}
	} catch (error) {
		logger.error('Failed to update player state', error);
	}
}

/**
 * Update play state icons without rebuilding the DOM
 */
export function updatePlayState(ctx: PlayerContext): void {
	try {
		const playerController = ctx.plugin.playerController;
		const state = playerController.getState();
		const currentId = state.currentEpisode?.id;
		const isPlaying = state.status === 'playing';

		const items = ctx.playerContentEl.querySelectorAll('.queue-episode-item');
		items.forEach((item) => {
			const id = item.getAttribute('data-episode-id');
			const actionEl = item.querySelector('.queue-episode-action');
			if (!actionEl) return;

			if (id === currentId) {
				item.addClass('current');
				actionEl.empty();

				if (isPlaying) {
					const pauseIcon = actionEl.createDiv({ cls: 'icon-current' });
					setIcon(pauseIcon, 'pause');
				} else {
					const playIcon = actionEl.createDiv({ cls: 'icon-current' });
					setIcon(playIcon, 'play');
				}
			} else {
				item.removeClass('current');
				actionEl.empty();

				if (!Platform.isMobile) {
					const dragIcon = actionEl.createDiv({ cls: 'icon-drag' });
					setIcon(dragIcon, 'grip-vertical');
				}

				const playIcon = actionEl.createDiv({ cls: Platform.isMobile ? 'icon-play-mobile' : 'icon-play' });
				setIcon(playIcon, 'play');
			}
		});
	} catch (error) {
		logger.error('Failed to update play state', error);
	}
}
