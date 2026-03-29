/**
 * Shared Podcast Event Types
 *
 * Type-safe event registration helpers used across all UI components.
 * Single source of truth for custom podcast events.
 */

import { Events } from 'obsidian';

/**
 * Type-safe event registration helper for podcast-specific workspace events
 */
export type PodcastEvents = Events & {
	on(name: 'podcast:queue-updated', callback: (queueId: string) => void): ReturnType<Events['on']>;
	on(name: 'podcast:player-state-updated', callback: () => void): ReturnType<Events['on']>;
	on(name: 'podcast:episode-changed', callback: () => void): ReturnType<Events['on']>;
	on(name: 'podcast:playlist-updated', callback: (playlistId: string) => void): ReturnType<Events['on']>;
	on(name: 'podcast:queue-changed', callback: () => void): ReturnType<Events['on']>;
};
