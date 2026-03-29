/**
 * PlayerView - Podcast Player UI Component
 *
 * Provides a user interface for podcast playback control.
 * Displays current episode, playback controls, and progress.
 */

import { ItemView, WorkspaceLeaf, setIcon, Notice } from 'obsidian';
import type PodcastPlayerPlugin from '../../main';
import type { PodcastEvents } from '../model/events';
import { EpisodeDetailModal } from './EpisodeDetailModal';
import { AddNoteModal } from './AddNoteModal';
import { logger } from '../utils/Logger';
import type { PlayerContext } from './player/PlayerContext';
import { renderPlaybackControls, renderAdvancedControls } from './player/PlaybackControlsRenderer';
import { renderProgressSection } from './player/ProgressRenderer';
import { renderQueueSection } from './player/QueueRenderer';
import { renderChaptersSection } from './player/ChaptersRenderer';
import {
	updatePlayerState,
	updatePlayState,
	startUpdateInterval,
	stopUpdateInterval,
} from './player/PlayerStateUpdater';
import {
	formatTime as formatTimeUtil,
	formatDuration as formatDurationUtil,
	formatRepeatMode as formatRepeatModeUtil,
} from './player/PlayerUtils';

export const PLAYER_VIEW_TYPE = 'podcast-player-view';

/**
 * PlayerView - Main player control UI
 */
export class PlayerView extends ItemView {
	plugin: PodcastPlayerPlugin;
	private playerContentEl: HTMLElement;
	private updateInterval: number | null = null;
	private currentQueueId: string | null = null;
	private isDraggingProgress: boolean = false;
	private lastPlaylistStateKey: string = 'queue';
	private lastQueueEpisodeIds: string[] = [];
	private lastQueueUpdatedAt: number = 0;

	constructor(leaf: WorkspaceLeaf, plugin: PodcastPlayerPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	onload() {
		super.onload();

		// Listen for queue updates
		this.registerEvent(
			(this.app.workspace as unknown as PodcastEvents).on('podcast:queue-updated', (queueId: string) => {
				void (async () => {
					const currentQueue = await this.plugin.getQueueManager().getCurrentQueue();

					if (currentQueue && currentQueue.id === queueId) {
						const idsChanged = JSON.stringify(currentQueue.episodeIds) !== JSON.stringify(this.lastQueueEpisodeIds);

						if (idsChanged) {
							this.lastQueueEpisodeIds = [...currentQueue.episodeIds];
							await this.renderPlayer();
						} else {
							updatePlayState(this.buildContext());
						}
					}
				})();
			})
		);

		this.registerEvent(
			(this.app.workspace as unknown as PodcastEvents).on('podcast:player-state-updated', () => updatePlayState(this.buildContext()))
		);

		this.registerEvent(
			(this.app.workspace as unknown as PodcastEvents).on('podcast:episode-changed', () => updatePlayState(this.buildContext()))
		);
	}

	getViewType(): string {
		return PLAYER_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Podcasts';
	}

	getIcon(): string {
		return 'podcast';
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('podcast-player-view');

		this.playerContentEl = container.createDiv({ cls: 'podcast-player-content' });

		await this.renderPlayer();
		this.updateInterval = startUpdateInterval(this.buildContext());
	}

	// eslint-disable-next-line @typescript-eslint/require-await -- Override must match base class ItemView.onClose() signature
	async onClose(): Promise<void> {
		stopUpdateInterval(this.updateInterval);
		this.updateInterval = null;
	}

	/**
	 * Build the shared context for renderer components
	 */
	private buildContext(): PlayerContext {
		return {
			plugin: this.plugin,
			playerContentEl: this.playerContentEl,
			getIsDraggingProgress: () => this.isDraggingProgress,
			setIsDraggingProgress: (v: boolean) => { this.isDraggingProgress = v; },
			getCurrentQueueId: () => this.currentQueueId,
			setCurrentQueueId: (id: string | null) => { this.currentQueueId = id; },
			getLastPlaylistStateKey: () => this.lastPlaylistStateKey,
			setLastPlaylistStateKey: (v: string) => { this.lastPlaylistStateKey = v; },
			getLastQueueUpdatedAt: () => this.lastQueueUpdatedAt,
			setLastQueueUpdatedAt: (v: number) => { this.lastQueueUpdatedAt = v; },
			onPlayPause: () => this.handlePlayPause(),
			onPrevious: () => this.handlePrevious(),
			onNext: () => this.handleNext(),
			onSkipBackward: () => { this.handleSkipBackward(); },
			onSkipForward: () => { this.handleSkipForward(); },
			onAddNote: () => this.handleAddNote(),
			onBookmark: () => this.handleBookmark(),
			onVolumeChange: (volume: number) => { this.handleVolumeChange(volume); },
			onSpeedChange: (speed: number) => { this.handleSpeedChange(speed); },
			requestRender: () => this.renderPlayer(),
			formatTime: (seconds: number) => this.formatTime(seconds),
			formatDuration: (seconds: number) => this.formatDuration(seconds),
		};
	}

	private async renderPlayer(): Promise<void> {
		this.playerContentEl.empty();

		const playerContainer = this.playerContentEl.createDiv({ cls: 'player-container' });
		const ctx = this.buildContext();

		this.renderEpisodeInfo(playerContainer);
		renderPlaybackControls(playerContainer, ctx);
		renderProgressSection(playerContainer, ctx);
		renderChaptersSection(playerContainer, ctx);
		renderAdvancedControls(playerContainer, ctx);
		await renderQueueSection(playerContainer, ctx);
	}

	private renderEpisodeInfo(container: HTMLElement): void {
		const infoSection = container.createDiv({ cls: 'episode-info-section' });

		// Update UI initially
		void updatePlayerState(this.buildContext());

		const titleContainer = infoSection.createDiv({ cls: 'episode-title-container' });

		titleContainer.createEl('h3', {
			text: 'No episode playing',
			cls: 'episode-title'
		});

		const infoBtn = titleContainer.createEl('button', {
			cls: 'player-info-button clickable-icon podcast-display-none',
			attr: { 'aria-label': 'View episode details' }
		});
		setIcon(infoBtn, 'info');
		infoBtn.addEventListener('click', () => this.handleShowEpisodeDetails());

		infoSection.createEl('p', {
			text: 'Select a podcast to start',
			cls: 'podcast-name'
		});

		const metadata = infoSection.createDiv({ cls: 'episode-metadata' });
		metadata.createSpan({ text: '--:--', cls: 'episode-duration' });
	}

	private handleShowEpisodeDetails(): void {
		const playerController = this.plugin.playerController;
		const currentEpisode = playerController.getCurrentEpisode();

		if (currentEpisode) {
			new EpisodeDetailModal(this.app, this.plugin, currentEpisode).open();
		}
	}

	private async handlePlayPause(): Promise<void> {
		try {
			if (!this.plugin) {
				logger.error('PlayerView: Plugin instance is missing');
				return;
			}
			if (!this.plugin.playerController) {
				logger.error('PlayerView: PlayerController is missing');
				return;
			}

			const playerController = this.plugin.playerController;
			const state = playerController.getState();

			if (state.status === 'playing') {
				void playerController.pause();
			} else if (state.status === 'paused') {
				void playerController.play();
			} else if (state.status === 'stopped' && !state.currentEpisode) {
				await this.playFromFirstQueue();
			} else if (state.status === 'stopped') {
				void playerController.play();
			}
		} catch (error) {
			logger.error('Failed to toggle playback', error);
		}
	}

	private async playFromFirstQueue(): Promise<void> {
		try {
			const queueManager = this.plugin.getQueueManager();
			const allQueues = await queueManager.getAllQueues();

			if (allQueues.length === 0) return;

			for (const queue of allQueues) {
				if (queue.episodeIds.length > 0) {
					const firstEpisodeId = queue.episodeIds[0];

					queueManager.setCurrentQueue(queue.id);
					await queueManager.jumpTo(queue.id, 0);
					this.currentQueueId = queue.id;

					await this.loadEpisodeById(firstEpisodeId);
					return;
				}
			}
		} catch (error) {
			logger.error('Failed to play from first queue', error);
		}
	}

	private async handlePrevious(): Promise<void> {
		await this.plugin.navigatePrevious();
	}

	private async handleNext(): Promise<void> {
		await this.plugin.navigateNext();
	}

	private async handleAddNote(): Promise<void> {
		const playerController = this.plugin.playerController;
		const currentEpisode = playerController.getCurrentEpisode();

		if (!currentEpisode) {
			new Notice('No episode is currently playing');
			return;
		}

		const currentPosition = playerController.getCurrentPosition();

		let podcast = null;
		try {
			podcast = await this.plugin.getSubscriptionStore().getPodcast(currentEpisode.podcastId);
		} catch (error) {
			logger.error('Failed to get podcast info', error);
		}

		new AddNoteModal(
			this.app,
			this.plugin,
			currentEpisode,
			podcast,
			currentPosition,
			(note: string) => {
			}
		).open();
	}

	private async handleBookmark(): Promise<void> {
		const playerController = this.plugin.playerController;
		const currentEpisode = playerController.getCurrentEpisode();

		if (!currentEpisode) {
			new Notice('No episode is currently playing');
			return;
		}

		const currentPosition = playerController.getCurrentPosition();

		try {
			const bookmarkStore = this.plugin.getBookmarkStore();
			await bookmarkStore.addBookmark(currentEpisode.id, currentPosition);
			new Notice(`Bookmark added at ${this.formatTime(currentPosition)}`);
		} catch (error) {
			logger.error('Failed to add bookmark', error);
			new Notice('Failed to add bookmark');
		}
	}

	private async loadEpisodeById(episodeId: string): Promise<void> {
		try {
			const episodeManager = this.plugin.getEpisodeManager();
			const episodeWithProgress = await episodeManager.getEpisodeWithProgress(episodeId);

			if (episodeWithProgress) {
				const playerController = this.plugin.playerController;
				await playerController.loadEpisode(episodeWithProgress, true, true);
			}
		} catch (error) {
			logger.error('Failed to load episode', error);
		}
	}

	private handleSkipBackward(): void {
		try {
			const playerController = this.plugin.playerController;
			playerController.skipBackward(15);
		} catch (error) {
			logger.error('Failed to skip backward', error);
		}
	}

	private handleSkipForward(): void {
		try {
			const playerController = this.plugin.playerController;
			playerController.skipForward(30);
		} catch (error) {
			logger.error('Failed to skip forward', error);
		}
	}

	private handleVolumeChange(volume: number): void {
		try {
			const playerController = this.plugin.playerController;
			playerController.setVolume(volume / 100);
		} catch (error) {
			logger.error('Failed to change volume', error);
		}
	}

	private handleSpeedChange(speed: number): void {
		try {
			const playerController = this.plugin.playerController;
			playerController.setPlaybackSpeed(speed);
		} catch (error) {
			logger.error('Failed to change playback speed', error);
		}
	}

	private formatRepeatMode(mode: 'none' | 'one' | 'all'): string {
		return formatRepeatModeUtil(mode);
	}

	private formatDuration(seconds: number): string {
		return formatDurationUtil(seconds);
	}

	private formatTime(seconds: number): string {
		return formatTimeUtil(seconds);
	}
}
