import { setIcon, Events, Platform } from 'obsidian';
import type PodcastPlayerPlugin from '../../main';
import { logger } from '../utils/Logger';

// Type-safe event registration helper
type PodcastEvents = Events & {
    on(name: 'podcast:player-state-updated', callback: () => void): ReturnType<Events['on']>;
    on(name: 'podcast:episode-changed', callback: () => void): ReturnType<Events['on']>;
};

export class MiniPlayer {
    private plugin: PodcastPlayerPlugin;
    private statusBarItem: HTMLElement | null = null;
    private playPauseBtn: HTMLElement;
    private titleEl: HTMLElement;
    private isMobile: boolean;

    constructor(plugin: PodcastPlayerPlugin) {
        this.plugin = plugin;
        this.isMobile = Platform.isMobile;
    }

    onload() {
        // Skip status bar on mobile as it has limited support
        if (this.isMobile) {
            logger.info('MiniPlayer: Skipping status bar on mobile platform');
            return;
        }

        this.statusBarItem = this.plugin.addStatusBarItem();
        this.statusBarItem.addClass('podcast-mini-player');

        // Hide initially until something is played or if state indicates no episode
        this.statusBarItem.addClass('is-hidden');

        this.render();
        this.registerEvents();

        // Initial state check
        this.updateState();
    }

    private render() {
        if (!this.statusBarItem) return;
        this.statusBarItem.empty();

        // Container
        const container = this.statusBarItem.createDiv({ cls: 'mini-player-container' });

        // Play/Pause Button
        this.playPauseBtn = container.createDiv({ cls: 'mini-player-btn' });
        setIcon(this.playPauseBtn, 'play');

        this.playPauseBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the status bar item click
            void this.togglePlayback();
        });

        // Title
        this.titleEl = container.createDiv({ cls: 'mini-player-title' });
        this.titleEl.textContent = 'No episode playing';

        // Add click handler to open player view
        this.statusBarItem.addEventListener('click', () => {
            void this.plugin.activatePlayerView();
        });

        // Add tooltip
        this.statusBarItem.setAttribute('aria-label', 'Click to open Podcasts');
    }

    private registerEvents() {
        // Skip event registration on mobile if no status bar
        if (this.isMobile || !this.statusBarItem) return;

        // We can access app.workspace directly
        this.plugin.registerEvent(
            (this.plugin.app.workspace as unknown as PodcastEvents).on('podcast:player-state-updated', () => {
                this.updateState();
            })
        );

        this.plugin.registerEvent(
            (this.plugin.app.workspace as unknown as PodcastEvents).on('podcast:episode-changed', () => {
                this.updateState();
            })
        );
    }

    private updateState() {
        if (!this.plugin.playerController || !this.statusBarItem) return;

        const state = this.plugin.playerController.getState();
        const currentEpisode = state.currentEpisode;

        if (currentEpisode) {
            this.statusBarItem.removeClass('is-hidden');
            this.titleEl.textContent = currentEpisode.title;

            if (state.status === 'playing') {
                setIcon(this.playPauseBtn, 'pause');
                this.playPauseBtn.setAttribute('aria-label', 'Pause');
            } else {
                setIcon(this.playPauseBtn, 'play');
                this.playPauseBtn.setAttribute('aria-label', 'Play');
            }
        } else {
            this.statusBarItem.addClass('is-hidden');
            this.titleEl.textContent = '';
        }
    }

    private async togglePlayback() {
        try {
            const playerController = this.plugin.playerController;
            const state = playerController.getState();

            if (state.status === 'playing') {
                await playerController.pause();
            } else {
                await playerController.play();
            }
        } catch (error) {
            logger.error('MiniPlayer: Failed to toggle playback', error);
        }
    }

    unload() {
        if (this.statusBarItem) {
            this.statusBarItem.remove();
        }
    }
}
