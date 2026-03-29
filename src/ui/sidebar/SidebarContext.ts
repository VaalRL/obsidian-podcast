/**
 * SidebarContext - Shared context type for sidebar renderer components
 *
 * Bundles the dependencies that rendering functions need from the parent view.
 * Created once per render() call in PodcastSidebarView and passed down.
 */

import type { App } from 'obsidian';
import type PodcastPlayerPlugin from '../../../main';
import type { Episode, Playlist, Podcast, Queue } from '../../model';
import type { EpisodeStatistics } from '../../podcast/EpisodeManager';
import type { DragDropHandler } from './DragDropHandler';

export interface SidebarContext {
	plugin: PodcastPlayerPlugin;
	app: App;

	// Callbacks for user actions
	onPlayEpisode: (episode: Episode, addToQueue?: boolean, fromPlaylist?: Playlist) => Promise<void>;
	onEpisodeClick: (episode: Episode) => void;
	onShowAddToMenu: (episode: Episode, event: MouseEvent) => Promise<void>;
	onShowEpisodeContextMenu: (episode: Episode, event: MouseEvent) => void;
	onShowPodcastContextMenu: (podcast: Podcast, event: MouseEvent) => void;
	onSelectPodcast: (podcast: Podcast) => void;
	onSelectPlaylist: (playlist: Playlist | null) => void;
	onSelectQueue: (queue: Queue | null) => void;
	requestRender: () => Promise<void>;
	renderLoading: (container: HTMLElement) => void;
	promptForInput: (title: string, message: string, defaultValue?: string) => Promise<string | null>;

	// Drag and drop
	dragDropHandler: DragDropHandler;

	// State (read-only from renderers' perspective)
	searchQuery: string;
	podcastStats: Map<string, EpisodeStatistics>;
	selectedPlaylist: Playlist | null;
	selectedQueue: Queue | null;
}
