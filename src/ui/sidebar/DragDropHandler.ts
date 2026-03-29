/**
 * DragDropHandler - Encapsulates drag-and-drop state and event handlers
 * for reordering episodes within playlists and queues.
 */

import { Notice } from 'obsidian';
import type PodcastPlayerPlugin from '../../../main';
import type { Playlist, Queue } from '../../model';
import { logger } from '../../utils/Logger';

export interface DragDropCallbacks {
	setSelectedPlaylist: (playlist: Playlist | null) => void;
	setSelectedQueue: (queue: Queue | null) => void;
	requestRender: () => Promise<void>;
}

export class DragDropHandler {
	private dragStartIndex: number = -1;
	private dragType: 'playlist' | 'queue' | null = null;
	private dragTargetId: string | null = null;

	constructor(
		private plugin: PodcastPlayerPlugin,
		private callbacks: DragDropCallbacks
	) {}

	handleDragStart(e: DragEvent, index: number, type: 'playlist' | 'queue', id: string): void {
		this.dragStartIndex = index;
		this.dragType = type;
		this.dragTargetId = id;

		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', JSON.stringify({ index, type, id }));
		}

		(e.target as HTMLElement).addClass('dragging');
	}

	handleDragEnd(e: DragEvent): void {
		(e.target as HTMLElement).removeClass('dragging');
		this.dragStartIndex = -1;
		this.dragType = null;
		this.dragTargetId = null;
	}

	handleDragOver(e: DragEvent): boolean {
		if (e.preventDefault) {
			e.preventDefault();
		}
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		return false;
	}

	handleDragEnter(e: DragEvent): void {
		(e.target as HTMLElement).closest('.playlist-episode-item')?.addClass('drag-over');
	}

	handleDragLeave(e: DragEvent): void {
		(e.target as HTMLElement).closest('.playlist-episode-item')?.removeClass('drag-over');
	}

	async handleDrop(e: DragEvent, dropIndex: number, type: 'playlist' | 'queue', id: string): Promise<boolean> {
		e.stopPropagation();

		(e.target as HTMLElement).closest('.playlist-episode-item')?.removeClass('drag-over');

		if (this.dragStartIndex === dropIndex ||
			this.dragType !== type ||
			this.dragTargetId !== id) {
			return false;
		}

		try {
			if (type === 'playlist') {
				const playlistManager = this.plugin.getPlaylistManager();
				const playlist = await playlistManager.getPlaylist(id);
				if (playlist) {
					const episodeId = playlist.episodeIds[this.dragStartIndex];
					playlist.episodeIds.splice(this.dragStartIndex, 1);
					playlist.episodeIds.splice(dropIndex, 0, episodeId);

					await playlistManager.updatePlaylist(id, { episodeIds: playlist.episodeIds });

					this.callbacks.setSelectedPlaylist(playlist);
				}
			} else if (type === 'queue') {
				const queueManager = this.plugin.getQueueManager();
				const queue = await queueManager.getQueue(id);
				if (queue) {
					const episodeId = queue.episodeIds[this.dragStartIndex];
					queue.episodeIds.splice(this.dragStartIndex, 1);
					queue.episodeIds.splice(dropIndex, 0, episodeId);

					await queueManager.updateQueue(id, { episodeIds: queue.episodeIds });

					this.callbacks.setSelectedQueue(queue);
				}
			}

			await this.callbacks.requestRender();
		} catch (error) {
			logger.error('Failed to reorder', error);
			new Notice('Failed to reorder items');
		} finally {
			document.querySelectorAll('.dragging').forEach(el => el.removeClass('dragging'));
			this.dragStartIndex = -1;
			this.dragType = null;
			this.dragTargetId = null;
		}

		return false;
	}
}
