/**
 * PodcastSidebarView - Sidebar view for podcast management
 *
 * Provides a sidebar interface for:
 * - Browsing subscribed podcasts
 * - Viewing episodes
 * - Quick playback controls
 */

import { ItemView, WorkspaceLeaf, Menu, Notice, setIcon } from 'obsidian';
import type PodcastPlayerPlugin from '../../main';
import { Podcast, Episode, Playlist, Queue } from '../model';
import type { PodcastEvents } from '../model/events';
import { EpisodeStatistics } from '../podcast/EpisodeManager';
import { AddToQueueModal } from './AddToQueueModal';
import { AddToPlaylistModal } from './AddToPlaylistModal';
import { SubscribePodcastModal } from './SubscribePodcastModal';
import { PodcastSettingsModal } from './PodcastSettingsModal';
import { EpisodeDetailModal } from './EpisodeDetailModal';
import { TextInputModal } from './TextInputModal';
import { logger } from '../utils/Logger';
import {
	filterEpisodes as filterEpisodesUtil,
	sortEpisodes as sortEpisodesUtil,
	formatDuration as formatDurationUtil,
} from './sidebar/SidebarUtils';
import { DragDropHandler } from './sidebar/DragDropHandler';
import type { SidebarContext } from './sidebar/SidebarContext';
import { renderPodcastList, renderAllEpisodes } from './sidebar/PodcastListRenderer';
import { renderEpisodeList } from './sidebar/EpisodeListRenderer';
import { renderPlaylistList, handleCreatePlaylist, handleCreateQueue } from './sidebar/PlaylistListRenderer';
import {
	renderPlaylistDetails,
	renderQueueDetails,
	updateListIcons,
	handleRenamePlaylist,
	handleRenameQueue,
} from './sidebar/PlaylistDetailRenderer';

export const PODCAST_SIDEBAR_VIEW_TYPE = 'podcast-sidebar-view';

/**
 * PodcastSidebarView - Main sidebar for podcast browsing
 */
export class PodcastSidebarView extends ItemView {
	plugin: PodcastPlayerPlugin;
	private sidebarContentEl: HTMLElement;
	private viewMode: 'podcasts' | 'playlists' = 'podcasts';
	private selectedPodcast: Podcast | null = null;
	private selectedPlaylist: Playlist | null = null;
	private selectedQueue: Queue | null = null;
	private searchQuery: string = '';
	private podcastSortBy: 'title' | 'author' | 'date' | 'count' | 'unplayed' | 'latest' = 'title';
	private episodeSortBy: 'title' | 'date' | 'duration' = 'date';
	private playlistSortBy: 'name' | 'date' | 'count' = 'date';
	private podcastSortDirection: 'asc' | 'desc' = 'asc';
	private episodeSortDirection: 'asc' | 'desc' = 'desc';
	private playlistSortDirection: 'asc' | 'desc' = 'asc';
	private podcastStats: Map<string, EpisodeStatistics> = new Map();
	private feedsViewMode: 'feeds' | 'episodes' = 'feeds'; // Toggle between feeds list and all episodes

	// Drag and drop handler
	private dragDropHandler: DragDropHandler;

	constructor(leaf: WorkspaceLeaf, plugin: PodcastPlayerPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.dragDropHandler = new DragDropHandler(plugin, {
			setSelectedPlaylist: (p) => { this.selectedPlaylist = p; },
			setSelectedQueue: (q) => { this.selectedQueue = q; },
			requestRender: () => this.render(),
		});
	}

	onload() {
		super.onload();

		// Listen for queue/playlist updates
		this.registerEvent(
			(this.app.workspace as unknown as PodcastEvents).on('podcast:queue-updated', (queueId: string) => {
				void (async () => {
					if (this.selectedQueue && this.selectedQueue.id === queueId) {
						this.selectedQueue = await this.plugin.getQueueManager().getQueue(queueId);
						await this.render();
					}
				})();
			})
		);

		// Listen for player state updates to refresh UI (e.g. play/pause icons)
		this.registerEvent(
			(this.app.workspace as unknown as PodcastEvents).on('podcast:player-state-updated', () => {
				this.updateListIcons();
			})
		);

		this.registerEvent(
			(this.app.workspace as unknown as PodcastEvents).on('podcast:episode-changed', () => {
				this.updateListIcons();
			})
		);

		this.registerEvent(
			(this.app.workspace as unknown as PodcastEvents).on('podcast:playlist-updated', (playlistId: string) => {
				void (async () => {
					if (this.selectedPlaylist && this.selectedPlaylist.id === playlistId) {
						this.selectedPlaylist = await this.plugin.getPlaylistManager().getPlaylist(playlistId);
						await this.render();
					}
				})();
			})
		);
	}

	/**
	 * Get the view type identifier
	 */
	getViewType(): string {
		return PODCAST_SIDEBAR_VIEW_TYPE;
	}

	/**
	 * Get the display text for the view
	 */
	getDisplayText(): string {
		return 'Podcasts';
	}

	/**
	 * Get the icon for the view
	 */
	getIcon(): string {
		return 'podcast';
	}

	/**
	 * Called when the view is opened
	 */
	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('podcast-sidebar-view');

		this.sidebarContentEl = container.createDiv({ cls: 'podcast-sidebar-content' });

		await this.render();
	}

	/**
	 * Called when the view is closed
	 */
	async onClose(): Promise<void> {
		// Cleanup if needed
	}

	/**
	 * Render the sidebar view
	 */
	private renderLoading(container: HTMLElement): void {
		const spinnerContainer = container.createDiv({ cls: 'podcast-spinner-container' });
		spinnerContainer.createDiv({ cls: 'podcast-spinner' });
	}

	private renderAbortController: AbortController | null = null;

	/**
	 * Build shared context for renderer components
	 */
	private buildContext(): SidebarContext {
		return {
			plugin: this.plugin,
			app: this.app,
			onPlayEpisode: (episode, addToQueue?, fromPlaylist?) => this.handlePlayEpisode(episode, addToQueue, fromPlaylist),
			onEpisodeClick: (episode) => this.handleEpisodeClick(episode),
			onShowAddToMenu: (episode, event) => this.showAddToPlaylistMenu(episode, event),
			onShowEpisodeContextMenu: (episode, event) => this.showEpisodeContextMenu(episode, event),
			onShowPodcastContextMenu: (podcast, event) => this.showPodcastContextMenu(podcast, event),
			onSelectPodcast: (podcast) => {
				this.selectedPodcast = podcast;
				this.episodeSortBy = 'date';
				this.episodeSortDirection = 'desc';
				void this.render();
			},
			onSelectPlaylist: (playlist) => {
				this.selectedPlaylist = playlist;
				void this.render();
			},
			onSelectQueue: (queue) => {
				this.selectedQueue = queue;
				void this.render();
			},
			requestRender: () => this.render(),
			renderLoading: (container) => this.renderLoading(container),
			promptForInput: (title, message, defaultValue?) => this.promptForInput(title, message, defaultValue),
			dragDropHandler: this.dragDropHandler,
			searchQuery: this.searchQuery,
			podcastStats: this.podcastStats,
			selectedPlaylist: this.selectedPlaylist,
			selectedQueue: this.selectedQueue,
		};
	}

	/**
	 * Render the sidebar view
	 */
	private async render(): Promise<void> {
		// Cancel previous render operation
		if (this.renderAbortController) {
			this.renderAbortController.abort();
		}
		this.renderAbortController = new AbortController();
		const signal = this.renderAbortController.signal;

		this.sidebarContentEl.empty();

		// Header with actions
		this.renderHeader();

		// Search box (includes sort button)
		this.renderSearchBox();

		const ctx = this.buildContext();

		try {
			// Render content based on current view
			if (this.selectedPodcast) {
				await renderEpisodeList(this.sidebarContentEl, ctx, {
					podcastId: this.selectedPodcast.id,
					sortBy: this.episodeSortBy,
					sortDirection: this.episodeSortDirection,
				}, signal);
			} else if (this.selectedPlaylist) {
				await renderPlaylistDetails(this.sidebarContentEl, this.selectedPlaylist, ctx, signal);
			} else if (this.selectedQueue) {
				await renderQueueDetails(this.sidebarContentEl, this.selectedQueue, ctx, signal);
			} else if (this.viewMode === 'podcasts') {
				if (this.feedsViewMode === 'episodes') {
					await renderAllEpisodes(this.sidebarContentEl, ctx, {
						episodeSortBy: this.episodeSortBy,
						episodeSortDirection: this.episodeSortDirection,
					}, signal);
				} else {
					await renderPodcastList(this.sidebarContentEl, ctx, {
						sortBy: this.podcastSortBy,
						sortDirection: this.podcastSortDirection,
					}, signal);
				}
			} else {
				await renderPlaylistList(this.sidebarContentEl, ctx, {
					sortBy: this.playlistSortBy,
					sortDirection: this.playlistSortDirection,
				}, signal);
			}
		} catch (error) {
			if (signal.aborted) return;
			logger.error('Render failed', error);
		}
	}

	/**
	 * Render the search box
	 */
	private renderSearchBox(): void {
		const searchContainer = this.sidebarContentEl.createDiv({ cls: 'sidebar-search-container' });

		const placeholder = this.selectedPodcast ? 'Search episodes...' :
			this.selectedPlaylist ? 'Search playlist episodes...' :
				this.viewMode === 'podcasts' ? 'Search podcasts...' : 'Search playlists...';

		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: placeholder,
			cls: 'sidebar-search-input',
			value: this.searchQuery
		});

		const searchBtn = searchContainer.createEl('button', {
			cls: 'sidebar-search-button clickable-icon',
			attr: { 'aria-label': 'Search' }
		});
		setIcon(searchBtn, 'search');

		const performSearch = () => {

			this.searchQuery = searchInput.value;
			void this.render();
		};

		// Handle search button click
		searchBtn.addEventListener('click', (e) => {

			performSearch();
		});

		// Handle Enter key
		searchInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault(); // Prevent default form submission if any

				performSearch();
			}
		});

		// Clear button (if there's a search query)
		if (this.searchQuery) {
			const clearBtn = searchContainer.createEl('button', {
				cls: 'sidebar-search-clear clickable-icon',
				attr: { 'aria-label': 'Clear search' }
			});
			setIcon(clearBtn, 'x');
			clearBtn.addEventListener('click', () => {

				this.searchQuery = '';
				void this.render();
			});
		}

		// Sort button (added to search container)
		// Determine current context
		let currentDirection: 'asc' | 'desc' = 'asc';
		let currentSortBy = '';

		if (this.selectedPodcast || this.selectedPlaylist) {
			currentDirection = this.episodeSortDirection;
			currentSortBy = this.episodeSortBy;
		} else if (this.viewMode === 'playlists') {
			currentDirection = this.playlistSortDirection;
			currentSortBy = this.playlistSortBy;
		} else {
			currentDirection = this.podcastSortDirection;
			currentSortBy = this.podcastSortBy;
		}

		// Sort button (Icon only)
		const sortBtn = searchContainer.createEl('button', {
			cls: 'sort-direction-button clickable-icon',
			attr: { 'aria-label': 'Sort options' }
		});
		setIcon(sortBtn, currentDirection === 'asc' ? 'arrow-up' : 'arrow-down');

		sortBtn.addEventListener('click', (event) => {
			const menu = new Menu();

			menu.addItem((item) => item.setIsLabel(true).setTitle('Sort by'));

			if (this.selectedPodcast || this.selectedPlaylist) {
				// Episode sort options
				menu.addItem((item) => item.setTitle('Title').setChecked(currentSortBy === 'title').onClick(() => { this.episodeSortBy = 'title'; void this.render(); }));
				menu.addItem((item) => item.setTitle('Date').setChecked(currentSortBy === 'date').onClick(() => { this.episodeSortBy = 'date'; void this.render(); }));
				menu.addItem((item) => item.setTitle('Duration').setChecked(currentSortBy === 'duration').onClick(() => { this.episodeSortBy = 'duration'; void this.render(); }));
			} else if (this.viewMode === 'playlists') {
				// Playlist sort options
				menu.addItem((item) => item.setTitle('Name').setChecked(currentSortBy === 'name').onClick(() => { this.playlistSortBy = 'name'; void this.render(); }));
				menu.addItem((item) => item.setTitle('Date').setChecked(currentSortBy === 'date').onClick(() => { this.playlistSortBy = 'date'; void this.render(); }));
				menu.addItem((item) => item.setTitle('Episode count').setChecked(currentSortBy === 'count').onClick(() => { this.playlistSortBy = 'count'; void this.render(); }));
			} else {
				// Podcast sort options
				menu.addItem((item) => item.setTitle('Title').setChecked(currentSortBy === 'title').onClick(() => { this.podcastSortBy = 'title'; void this.render(); }));
				menu.addItem((item) => item.setTitle('Author').setChecked(currentSortBy === 'author').onClick(() => { this.podcastSortBy = 'author'; void this.render(); }));
				menu.addItem((item) => item.setTitle('Subscribed date').setChecked(currentSortBy === 'date').onClick(() => { this.podcastSortBy = 'date'; void this.render(); }));
				menu.addItem((item) => item.setTitle('Latest episode').setChecked(currentSortBy === 'latest').onClick(() => { this.podcastSortBy = 'latest'; void this.render(); }));
				menu.addItem((item) => item.setTitle('Total episodes').setChecked(currentSortBy === 'count').onClick(() => { this.podcastSortBy = 'count'; void this.render(); }));
				menu.addItem((item) => item.setTitle('Unplayed count').setChecked(currentSortBy === 'unplayed').onClick(() => { this.podcastSortBy = 'unplayed'; void this.render(); }));
			}

			menu.addSeparator();
			menu.addItem((item) => item.setIsLabel(true).setTitle('Order'));

			menu.addItem((item) => item
				.setTitle('Ascending')
				.setChecked(currentDirection === 'asc')
				.onClick(() => this.setSortDirection('asc')));

			menu.addItem((item) => item
				.setTitle('Descending')
				.setChecked(currentDirection === 'desc')
				.onClick(() => this.setSortDirection('desc')));

			menu.showAtMouseEvent(event);
		});
	}



	private setSortDirection(dir: 'asc' | 'desc'): void {
		if (this.selectedPodcast || this.selectedPlaylist) {
			this.episodeSortDirection = dir;
		} else if (this.viewMode === 'playlists') {
			this.playlistSortDirection = dir;
		} else {
			this.podcastSortDirection = dir;
		}
		void this.render();
	}




	/**
	 * Render the header with action buttons
	 */
	private renderHeader(): void {
		// Header container with title and actions
		const header = this.sidebarContentEl.createDiv({ cls: 'sidebar-header' });

		// Back button (if viewing details) - now inside header
		if (this.selectedPodcast || this.selectedPlaylist || this.selectedQueue) {
			const backBtn = header.createEl('button', {
				cls: 'sidebar-back-button clickable-icon',
				attr: { 'aria-label': 'Back to list' }
			});
			setIcon(backBtn, 'arrow-left');
			backBtn.createSpan({ text: ' Back' });
			backBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();

				this.selectedPodcast = null;
				this.selectedPlaylist = null;
				this.selectedQueue = null;
				void this.render();
			});
		}

		// Title
		let title = '';
		if (this.selectedPodcast) {
			title = this.selectedPodcast.title;
		} else if (this.selectedPlaylist) {
			title = this.selectedPlaylist.name;
		} else if (this.selectedQueue) {
			title = this.selectedQueue.name;
		} else if (this.viewMode === 'podcasts') {
			title = this.feedsViewMode === 'feeds' ? 'My feeds' : 'All episodes';
		} else {
			title = 'My lists';
		}

		header.createEl('h2', { text: title, cls: 'sidebar-title' });

		// Action buttons
		const actions = header.createDiv({ cls: 'sidebar-actions' });

		if (!this.selectedPodcast && !this.selectedPlaylist && !this.selectedQueue) {
			if (this.viewMode === 'podcasts') {
				// Toggle view mode button (feeds vs all episodes)
				const toggleViewBtn = actions.createEl('button', {
					cls: 'sidebar-action-button clickable-icon',
					attr: { 'aria-label': this.feedsViewMode === 'feeds' ? 'Show all episodes' : 'Show feeds' }
				});
				setIcon(toggleViewBtn, this.feedsViewMode === 'feeds' ? 'list' : 'rss');
				toggleViewBtn.addEventListener('click', () => {
					this.feedsViewMode = this.feedsViewMode === 'feeds' ? 'episodes' : 'feeds';
					void this.render();
				});

				// Add podcast button
				const addBtn = actions.createEl('button', {
					cls: 'sidebar-action-button clickable-icon',
					attr: { 'aria-label': 'Subscribe to podcast' }
				});
				setIcon(addBtn, 'plus');
				addBtn.addEventListener('click', () => this.handleAddPodcast());

				// Refresh button
				const refreshBtn = actions.createEl('button', {
					cls: 'sidebar-action-button clickable-icon',
					attr: { 'aria-label': 'Refresh feeds' }
				});
				setIcon(refreshBtn, 'refresh-cw');
				refreshBtn.addEventListener('click', () => void this.handleRefreshFeeds());
			} else {
				// Create new (queue or playlist) button
				const addBtn = actions.createEl('button', {
					cls: 'sidebar-action-button clickable-icon',
					attr: { 'aria-label': 'Create new' }
				});
				setIcon(addBtn, 'plus');
				addBtn.addEventListener('click', (e) => {
					const menu = new Menu();

					menu.addItem((item) =>
						item
							.setTitle('New queue')
							.setIcon('list-ordered')
							.onClick(() => void this.handleCreateQueue())
					);

					menu.addItem((item) =>
						item
							.setTitle('New playlist')
							.setIcon('folder-plus')
							.onClick(() => void this.handleCreatePlaylist())
					);

					menu.showAtMouseEvent(e);
				});
			}
		} else if (this.selectedPodcast) {
			// Settings button (for selected podcast)
			const settingsBtn = actions.createEl('button', {
				cls: 'sidebar-action-button clickable-icon',
				attr: { 'aria-label': 'Podcast settings' }
			});
			setIcon(settingsBtn, 'settings');
			settingsBtn.addEventListener('click', () => this.handlePodcastSettings());
		} else if (this.selectedPlaylist) {
			// Rename button (for selected playlist)
			const renameBtn = actions.createEl('button', {
				cls: 'sidebar-action-button clickable-icon',
				attr: { 'aria-label': 'Rename playlist' }
			});
			setIcon(renameBtn, 'pencil');
			renameBtn.addEventListener('click', () => this.handleRenamePlaylist());
		} else if (this.selectedQueue) {
			// Rename button (for selected queue)
			const renameBtn = actions.createEl('button', {
				cls: 'sidebar-action-button clickable-icon',
				attr: { 'aria-label': 'Rename queue' }
			});
			setIcon(renameBtn, 'pencil');
			renameBtn.addEventListener('click', () => this.handleRenameQueue());
		}

		// Mode toggle - always visible to allow quick switching
		const modeToggle = this.sidebarContentEl.createDiv({ cls: 'sidebar-mode-toggle' });

		const podcastsBtn = modeToggle.createEl('button', {
			text: 'Feeds',
			cls: this.viewMode === 'podcasts' && !this.selectedPlaylist && !this.selectedQueue ? 'mode-active' : 'mode-inactive'
		});
		podcastsBtn.addEventListener('click', () => {
			// Clear selection to go back to main list
			this.selectedPodcast = null;
			this.selectedPlaylist = null;
			this.selectedQueue = null;

			this.viewMode = 'podcasts';
			void this.render();
		});

		const playlistsBtn = modeToggle.createEl('button', {
			text: 'Lists',
			cls: this.viewMode === 'playlists' || this.selectedPlaylist || this.selectedQueue ? 'mode-active' : 'mode-inactive'
		});
		playlistsBtn.addEventListener('click', () => {
			// Clear selection to go back to main list
			this.selectedPodcast = null;
			this.selectedPlaylist = null;
			this.selectedQueue = null;

			this.viewMode = 'playlists';
			void this.render();
		});
	}

	/**
	 * Handle add podcast button click
	 */
	private handleAddPodcast(): void {
		new SubscribePodcastModal(
			this.app,
			this.plugin,
			async (podcastId) => {
				// Callback after successful subscription

				// Refresh the view to show the new podcast
				await this.render();
			}
		).open();
	}

	/**
	 * Handle refresh feeds button click
	 */
	private async handleRefreshFeeds(): Promise<void> {
		try {
			const feedSyncManager = this.plugin.getFeedSyncManager();
			// Show progress notification
			const notice = new Notice('Refreshing feeds...', 0);

			const result = await feedSyncManager.syncAll();

			notice.hide();

			new Notice(`Refreshed ${result.successCount} feeds. ${result.failureCount} failed.`);

			// Refresh the view to show updated data
			await this.render();
		} catch (error) {
			logger.error('Failed to refresh feeds', error);
			new Notice('Failed to refresh feeds');
		}
	}

	/**
	 * Handle podcast settings button click
	 */
	private handlePodcastSettings(): void {
		if (!this.selectedPodcast) return;

		new PodcastSettingsModal(
			this.app,
			this.plugin,
			this.selectedPodcast,
			(settings, autoAddRule) => {
				void (async () => {
					// Save the settings to the podcast
					try {
						const subscriptionStore = this.plugin.getSubscriptionStore();
						this.selectedPodcast!.settings = settings;
						this.selectedPodcast!.autoAddRule = autoAddRule;
						await subscriptionStore.updatePodcast(this.selectedPodcast!);

						new Notice('Podcast settings updated');

						// Refresh the view
						await this.render();
					} catch (error) {
						logger.error('Failed to save podcast settings', error);
						new Notice('Failed to save settings');
					}
				})();
			}
		).open();
	}

	/**
	 * Show add to playlist menu
	 */
	private async showAddToPlaylistMenu(episode: Episode, event: MouseEvent): Promise<void> {
		const menu = new Menu();
		const playlistManager = this.plugin.getPlaylistManager();
		const queueManager = this.plugin.getQueueManager();

		// Queues Section
		menu.addItem((item) => item.setTitle('Queues').setIsLabel(true));

		const queues = await queueManager.getAllQueues();
		queues.forEach(queue => {
			menu.addItem((item) =>
				item
					.setTitle(queue.name)
					.setIcon('list-ordered')
					.onClick(() => {
						void (async () => {
							try {
								await queueManager.addEpisode(queue.id, episode.id);
								new Notice(`Added to queue: ${queue.name}`);
							} catch (e) {
								logger.error('Operation failed', e);
								new Notice('Failed to add to queue');
							}
						})();
					})
			);
		});

		// New Queue Option
		menu.addItem((item) =>
			item
				.setTitle('New queue...')
				.setIcon('plus')
				.onClick(() => {
					void (async () => {
						const name = await this.promptForInput('New Queue', 'Enter queue name:');
						if (name) {
							const newQueue = await queueManager.createQueue(name);
							await queueManager.addEpisode(newQueue.id, episode.id);
							new Notice(`Created queue "${name}" and added episode`);
							await this.render();
						}
					})();
				})
		);

		menu.addSeparator();

		// Playlists Section
		menu.addItem((item) => item.setTitle('Playlists').setIsLabel(true));

		const playlists = await playlistManager.getAllPlaylists();
		playlists.forEach(playlist => {
			menu.addItem((item) =>
				item
					.setTitle(playlist.name)
					.setIcon('list')
					.onClick(() => {
						void (async () => {
							try {
								await playlistManager.addEpisode(playlist.id, episode.id);
								new Notice(`Added to playlist: ${playlist.name}`);
							} catch (e) {
								logger.error('Operation failed', e);
								new Notice('Failed to add to playlist');
							}
						})();
					})
			);
		});

		// New Playlist Option
		menu.addItem((item) =>
			item
				.setTitle('New playlist...')
				.setIcon('plus')
				.onClick(() => {
					void (async () => {
						const name = await this.promptForInput('New Playlist', 'Enter playlist name:');
						if (name) {
							const newPlaylist = await playlistManager.createPlaylist(name);
							await playlistManager.addEpisode(newPlaylist.id, episode.id);
							new Notice(`Created playlist "${name}" and added episode`);
							await this.render();
						}
					})();
				})
		);

		menu.showAtMouseEvent(event);
	}

	/**
	 * Handle play episode button click
	 */
	private async handlePlayEpisode(episode: Episode, addToQueue = false, fromPlaylist?: Playlist): Promise<void> {
		try {
			const playerController = this.plugin.playerController;
			const queueManager = this.plugin.getQueueManager();

			// If playing from a playlist, play directly without creating a queue
			if (fromPlaylist) {
				// Find the index of the episode in the playlist
				const episodeIndex = fromPlaylist.episodeIds.indexOf(episode.id);

				// Set the playlist in PlayerController for prev/next navigation
				playerController.setCurrentPlaylist(fromPlaylist, episodeIndex >= 0 ? episodeIndex : 0);

				// Load and play the episode - no queue creation
				await playerController.loadEpisode(episode, true, true);
				new Notice(`Now playing: ${episode.title}`);
				return;
			} else if (addToQueue) {
				// Get or create default queue
				let queue = await queueManager.getCurrentQueue();
				if (!queue) {
					const queues = await queueManager.getAllQueues();
					if (queues.length > 0) {
						queue = queues[0];
					} else {
						queue = await queueManager.createQueue('Default Queue');
					}
					queueManager.setCurrentQueue(queue.id);
				}

				// Add to front (insert at 0)
				await queueManager.insertEpisode(queue.id, episode.id, 0);
				// Update current index to 0 so the queue continues from here
				await queueManager.jumpTo(queue.id, 0);
			} else {
				// Playing from podcast list - create queue with all visible episodes
				if (this.selectedPodcast) {
					const queueName = `Podcast: ${this.selectedPodcast.title}`;

					// Get episodes and apply current filter/sort
					let episodes = this.selectedPodcast.episodes || [];

					if (this.searchQuery) {
						episodes = this.filterEpisodes(episodes, this.searchQuery);
					}

					episodes = this.sortEpisodes(episodes, this.episodeSortBy, this.episodeSortDirection);

					// Find or create queue
					const allQueues = await queueManager.getAllQueues();
					let queue = allQueues.find(q => q.name === queueName);

					if (!queue) {
						queue = await queueManager.createQueue(queueName);
					}

					// Update queue episodes
					await queueManager.clearQueue(queue.id);
					const episodeIds = episodes.map(e => e.id);
					await queueManager.addEpisodes(queue.id, episodeIds);

					// Jump to clicked episode
					const index = episodeIds.indexOf(episode.id);
					if (index !== -1) {
						await queueManager.jumpTo(queue.id, index);
					}

					// Set as current queue
					queueManager.setCurrentQueue(queue.id);
				}
			}

			// Load the episode into the player with autoPlay = true
			await playerController.loadEpisode(episode, true, true);

			new Notice(`Now playing: ${episode.title}`);
		} catch (error) {
			logger.error('Failed to play episode', error);
			new Notice('Failed to start playback');
		}
	}

	/**
	 * Handle episode item click (show details)
	 */
	private handleEpisodeClick(episode: Episode): void {
		new EpisodeDetailModal(this.app, this.plugin, episode).open();
	}

	/**
	 * Show context menu for podcast
	 */
	private showPodcastContextMenu(podcast: Podcast, event: MouseEvent): void {
		const menu = new Menu();

		menu.addItem((item) =>
			item
				.setTitle('View episodes')
				.setIcon('list')
				.onClick(() => {
					this.selectedPodcast = podcast;
					void this.render();
				})
		);

		menu.addItem((item) =>
			item
				.setTitle('Refresh feed')
				.setIcon('refresh-cw')
				.onClick(() => {
					void (async () => {
						try {
							const feedSyncManager = this.plugin.getFeedSyncManager();
							new Notice('Refreshing feed...');
							await feedSyncManager.syncPodcast(podcast.id);
							new Notice('Feed refreshed');
							await this.render();
						} catch (error) {
							logger.error('Failed to refresh feed', error);
							new Notice('Failed to refresh feed');
						}
					})();
				})
		);

		menu.addSeparator();

		menu.addItem((item) =>
			item
				.setTitle('Unsubscribe')
				.setIcon('trash')
				.onClick(() => {
					void (async () => {
						try {
							const podcastService = this.plugin.getPodcastService();
							await podcastService.unsubscribe(podcast.id);
							new Notice(`Unsubscribed from ${podcast.title}`);
							await this.render();
						} catch (error) {
							logger.error('Failed to unsubscribe', error);
							new Notice('Failed to unsubscribe');
						}
					})();
				})
		);

		menu.showAtMouseEvent(event);
	}

	/**
	 * Show context menu for episode
	 */
	private showEpisodeContextMenu(episode: Episode, event: MouseEvent): void {
		const menu = new Menu();

		menu.addItem((item) =>
			item
				.setTitle('View details')
				.setIcon('info')
				.onClick(() => this.handleEpisodeClick(episode))
		);

		menu.addSeparator();

		menu.addItem((item) =>
			item
				.setTitle('Play')
				.setIcon('play')
				.onClick(() => void this.handlePlayEpisode(episode))
		);

		menu.addItem((item) =>
			item
				.setTitle('Add to queue')
				.setIcon('list-plus')
				.onClick(() => {
					new AddToQueueModal(
						this.app,
						this.plugin,
						[episode],
						(queueId) => {
							// Callback after adding to queue

						}
					).open();
				})
		);

		menu.addItem((item) =>
			item
				.setTitle('Add to playlist')
				.setIcon('folder-plus')
				.onClick(() => {
					new AddToPlaylistModal(
						this.app,
						this.plugin,
						[episode],
						(playlistId) => {
							// Callback after adding to playlist

						}
					).open();
				})
		);

		menu.addSeparator();

		menu.addItem((item) =>
			item
				.setTitle('Export to note')
				.setIcon('file-text')
				.onClick(() => {
					void this.handleExportToNote(episode);
				})
		);

		menu.showAtMouseEvent(event);
	}

	/**
	 * Handle export to note
	 */
	private async handleExportToNote(episode: Episode): Promise<void> {
		try {
			// Show loading notification
			const loadingNotice = new Notice('Exporting episode to note...', 0);

			// Get the podcast information
			const subscriptionStore = this.plugin.getSubscriptionStore();
			const podcast = await subscriptionStore.getPodcast(episode.podcastId);

			if (!podcast) {
				loadingNotice.hide();
				new Notice('Failed to find podcast information');
				return;
			}

			// Get progress information (if available)
			const episodeManager = this.plugin.getEpisodeManager();
			const episodeWithProgress = await episodeManager.getEpisodeWithProgress(episode.id);
			const progress = episodeWithProgress?.progress;

			// Export the episode
			const noteExporter = this.plugin.getNoteExporter();
			const noteFile = await noteExporter.exportEpisode(episode, podcast, progress);

			// Hide loading notification
			loadingNotice.hide();

			// Show success notification
			new Notice(`Note created: ${noteFile.name}`);

			// Open the note (optional)
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(noteFile);

		} catch (error) {
			logger.error('Failed to export to note', error);
			new Notice('Failed to export to note');
		}
	}

	/**
	 * Format duration in seconds to human-readable string
	 */
	private formatDuration(seconds: number): string {
		return formatDurationUtil(seconds);
	}

	/**
	 * Filter episodes based on search query (thin delegate)
	 */
	private filterEpisodes(episodes: Episode[], query: string): Episode[] {
		return filterEpisodesUtil(episodes, query);
	}

	/**
	 * Sort episodes based on criteria (thin delegate)
	 */
	private sortEpisodes(
		episodes: Episode[],
		sortBy: 'title' | 'date' | 'duration',
		direction: 'asc' | 'desc'
	): Episode[] {
		return sortEpisodesUtil(episodes, sortBy, direction);
	}

	/**
	 * Update play state icons without rebuilding the DOM (thin delegate)
	 */
	private updateListIcons(): void {
		updateListIcons(this.sidebarContentEl, this.buildContext());
	}

	/**
	 * Handle create playlist (thin delegate)
	 */
	private async handleCreatePlaylist(): Promise<void> {
		await handleCreatePlaylist(this.buildContext());
	}

	/**
	 * Handle create queue (thin delegate)
	 */
	private async handleCreateQueue(): Promise<void> {
		await handleCreateQueue(this.buildContext());
	}

	/**
	 * Handle rename playlist (thin delegate)
	 */
	private handleRenamePlaylist(): void {
		if (!this.selectedPlaylist) return;
		handleRenamePlaylist(this.selectedPlaylist, this.buildContext());
	}

	/**
	 * Handle rename queue (thin delegate)
	 */
	private handleRenameQueue(): void {
		if (!this.selectedQueue) return;
		handleRenameQueue(this.selectedQueue, this.buildContext());
	}

	/**
	 * Prompt user for text input
	 */
	private async promptForInput(title: string, message: string, defaultValue?: string): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new TextInputModal(
				this.app,
				title,
				message,
				defaultValue || '',
				(result) => resolve(result)
			);
			modal.open();
		});
	}

	/**
	 * Refresh the view
	 */
	public async refresh(): Promise<void> {
		await this.render();
	}
}
