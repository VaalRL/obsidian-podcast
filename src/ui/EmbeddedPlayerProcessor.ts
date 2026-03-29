/**
 * EmbeddedPlayerProcessor - Registers markdown code block processor for inline podcast player
 *
 * Usage in markdown notes:
 * ```podcast-player
 * episodeId: <episode-id>
 * showChapters: true
 * ```
 *
 * Renders a mini player inline in the note that syncs with the global PlayerController.
 */

import { MarkdownRenderChild, MarkdownPostProcessorContext, setIcon } from 'obsidian';
import type PodcastPlayerPlugin from '../../main';
import type { PodcastEvents } from '../model/events';
import type { Episode, Podcast } from '../model';
import { logger } from '../utils/Logger';
import { formatTime } from '../utils/timeUtils';

interface EmbeddedPlayerConfig {
	episodeId: string;
	showChapters?: boolean;
}

/**
 * Register the podcast-player code block processor
 */
export function registerEmbeddedPlayerProcessor(plugin: PodcastPlayerPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor('podcast-player', (source, el, ctx) => {
		const config = parseConfig(source);
		if (!config) {
			el.createDiv({ text: 'Invalid podcast-player configuration. Required: episodeId', cls: 'embedded-player-error' });
			return;
		}

		const child = new EmbeddedPlayerChild(el, plugin, config);
		ctx.addChild(child);
	});
}

/**
 * Parse code block content into config
 */
function parseConfig(source: string): EmbeddedPlayerConfig | null {
	const lines = source.trim().split('\n');
	const map = new Map<string, string>();

	for (const line of lines) {
		const colonIdx = line.indexOf(':');
		if (colonIdx === -1) continue;
		const key = line.slice(0, colonIdx).trim();
		const value = line.slice(colonIdx + 1).trim();
		if (key && value) map.set(key, value);
	}

	const episodeId = map.get('episodeId');
	if (!episodeId) return null;

	return {
		episodeId,
		showChapters: map.get('showChapters') === 'true',
	};
}

/**
 * MarkdownRenderChild that manages embedded player lifecycle
 */
class EmbeddedPlayerChild extends MarkdownRenderChild {
	private plugin: PodcastPlayerPlugin;
	private config: EmbeddedPlayerConfig;
	private episode: Episode | null = null;
	private podcast: Podcast | null = null;
	private playPauseBtn: HTMLElement | null = null;
	private progressFill: HTMLElement | null = null;
	private currentTimeEl: HTMLElement | null = null;
	private totalTimeEl: HTMLElement | null = null;
	private updateIntervalId: number | null = null;

	constructor(el: HTMLElement, plugin: PodcastPlayerPlugin, config: EmbeddedPlayerConfig) {
		super(el);
		this.plugin = plugin;
		this.config = config;
	}

	async onload(): Promise<void> {
		await this.loadEpisodeData();

		if (!this.episode) {
			this.containerEl.createDiv({ text: 'Episode not found', cls: 'embedded-player-error' });
			return;
		}

		this.renderPlayer();
		this.registerEvents();
		this.startUpdateInterval();
	}

	onunload(): void {
		this.stopUpdateInterval();
	}

	private async loadEpisodeData(): Promise<void> {
		try {
			const episodeManager = this.plugin.getEpisodeManager();
			const result = await episodeManager.getEpisodeWithProgress(this.config.episodeId);
			if (result) {
				this.episode = result;
			}

			if (this.episode) {
				this.podcast = await this.plugin.getSubscriptionStore().getPodcast(this.episode.podcastId);
			}
		} catch (error) {
			logger.warn('EmbeddedPlayer: Failed to load episode data', error);
		}
	}

	private renderPlayer(): void {
		if (!this.episode) return;

		const container = this.containerEl.createDiv({ cls: 'embedded-podcast-player' });

		// Header: title + podcast name
		const header = container.createDiv({ cls: 'embedded-player-header' });
		header.createDiv({ text: this.episode.title, cls: 'embedded-player-title' });
		if (this.podcast) {
			header.createDiv({ text: this.podcast.title, cls: 'embedded-player-podcast' });
		}

		// Controls row
		const controls = container.createDiv({ cls: 'embedded-player-controls' });

		this.playPauseBtn = controls.createEl('button', {
			cls: 'embedded-player-play-btn clickable-icon',
			attr: { 'aria-label': 'Play' }
		});
		setIcon(this.playPauseBtn, 'play');
		this.playPauseBtn.addEventListener('click', () => {
			void this.handlePlayPause();
		});

		// Progress bar
		const progressContainer = controls.createDiv({ cls: 'embedded-player-progress' });
		const progressBar = progressContainer.createDiv({ cls: 'embedded-player-progress-bar' });
		this.progressFill = progressBar.createDiv({ cls: 'embedded-player-progress-fill' });

		// Click to seek
		progressBar.addEventListener('click', (e) => {
			if (!this.episode || this.episode.duration <= 0) return;
			const rect = progressBar.getBoundingClientRect();
			const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
			const seekPosition = pct * this.episode.duration;

			// Only seek if this episode is currently loaded
			const currentEp = this.plugin.playerController.getCurrentEpisode();
			if (currentEp?.id === this.episode.id) {
				this.plugin.playerController.seek(seekPosition);
			}
		});

		// Time display
		const timeDisplay = controls.createDiv({ cls: 'embedded-player-time' });
		this.currentTimeEl = timeDisplay.createSpan({ text: '0:00', cls: 'embedded-player-current-time' });
		timeDisplay.createSpan({ text: ' / ' });
		this.totalTimeEl = timeDisplay.createSpan({
			text: formatTime(this.episode.duration),
			cls: 'embedded-player-total-time'
		});

		// Chapters (optional)
		if (this.config.showChapters && this.episode.chapters && this.episode.chapters.length > 0) {
			const chaptersEl = container.createDiv({ cls: 'embedded-player-chapters' });
			for (const chapter of this.episode.chapters) {
				const chItem = chaptersEl.createDiv({ cls: 'chapter-item' });
				chItem.createSpan({ text: formatTime(chapter.startTime), cls: 'chapter-time' });
				chItem.createSpan({ text: chapter.title, cls: 'chapter-title' });
				chItem.addEventListener('click', () => {
					const currentEp = this.plugin.playerController.getCurrentEpisode();
					if (currentEp?.id === this.episode?.id) {
						this.plugin.playerController.seek(chapter.startTime);
					}
				});
			}
		}

		this.updateState();
	}

	private registerEvents(): void {
		this.registerEvent(
			(this.plugin.app.workspace as unknown as PodcastEvents).on('podcast:player-state-updated', () => {
				this.updateState();
			})
		);
		this.registerEvent(
			(this.plugin.app.workspace as unknown as PodcastEvents).on('podcast:episode-changed', () => {
				this.updateState();
			})
		);
	}

	private startUpdateInterval(): void {
		this.updateIntervalId = window.setInterval(() => {
			this.updateState();
		}, 1000);
		this.registerInterval(this.updateIntervalId);
	}

	private stopUpdateInterval(): void {
		if (this.updateIntervalId !== null) {
			window.clearInterval(this.updateIntervalId);
			this.updateIntervalId = null;
		}
	}

	private updateState(): void {
		if (!this.episode) return;

		const state = this.plugin.playerController.getState();
		const isThisEpisode = state.currentEpisode?.id === this.episode.id;

		// Update play/pause icon
		if (this.playPauseBtn) {
			if (isThisEpisode && state.status === 'playing') {
				setIcon(this.playPauseBtn, 'pause');
				this.playPauseBtn.setAttribute('aria-label', 'Pause');
			} else {
				setIcon(this.playPauseBtn, 'play');
				this.playPauseBtn.setAttribute('aria-label', 'Play');
			}
		}

		// Update progress
		if (isThisEpisode && this.episode.duration > 0) {
			const pct = Math.min(100, Math.max(0, (state.position / this.episode.duration) * 100));
			if (this.progressFill) {
				this.progressFill.setCssProps({ width: `${pct}%` });
			}
			if (this.currentTimeEl) {
				this.currentTimeEl.textContent = formatTime(state.position);
			}
		}
	}

	private async handlePlayPause(): Promise<void> {
		if (!this.episode) return;

		try {
			const playerController = this.plugin.playerController;
			const currentEp = playerController.getCurrentEpisode();

			if (currentEp?.id === this.episode.id) {
				// Toggle play/pause for this episode
				const state = playerController.getState();
				if (state.status === 'playing') {
					await playerController.pause();
				} else {
					await playerController.play();
				}
			} else {
				// Load and play this episode
				await playerController.loadEpisode(this.episode, true, true);
			}
		} catch (error) {
			logger.error('EmbeddedPlayer: Failed to toggle playback', error);
		}
	}
}
