/**
 * PlayerContext - Shared context type for player renderer components
 *
 * Bundles the dependencies that rendering functions need from PlayerView.
 * Created once per render/update call and passed down to renderer components.
 */

import type PodcastPlayerPlugin from '../../../main';

export interface PlayerContext {
	plugin: PodcastPlayerPlugin;
	playerContentEl: HTMLElement;

	// Mutable state accessors
	getIsDraggingProgress(): boolean;
	setIsDraggingProgress(value: boolean): void;
	getCurrentQueueId(): string | null;
	setCurrentQueueId(id: string | null): void;
	getLastPlaylistStateKey(): string;
	setLastPlaylistStateKey(value: string): void;
	getLastQueueUpdatedAt(): number;
	setLastQueueUpdatedAt(value: number): void;

	// Action callbacks (bound methods from PlayerView)
	onPlayPause: () => Promise<void>;
	onPrevious: () => Promise<void>;
	onNext: () => Promise<void>;
	onSkipBackward: () => void;
	onSkipForward: () => void;
	onAddNote: () => Promise<void>;
	onBookmark: () => Promise<void>;
	onVolumeChange: (volume: number) => void;
	onSpeedChange: (speed: number) => void;

	// Re-render callback
	requestRender: () => Promise<void>;

	// Utilities
	formatTime: (seconds: number) => string;
	formatDuration: (seconds: number) => string;
}
