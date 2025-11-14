import { Plugin, Notice } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS } from './src/model';
import { SettingsStore, DataPathManager } from './src/storage';
import { PodcastPlayerSettingTab } from './src/ui';
import { logger } from './src/utils/Logger';

/**
 * Podcast Player Plugin for Obsidian
 *
 * A feature-rich podcast player and manager that allows you to:
 * - Subscribe to and manage podcast feeds (RSS/Atom)
 * - Play podcast episodes with custom settings
 * - Manage playlists and playback queues
 * - Export episode information to notes with timestamps
 */
export default class PodcastPlayerPlugin extends Plugin {
	settings: PluginSettings;
	private settingsStore: SettingsStore;
	private pathManager: DataPathManager;

	/**
	 * Plugin lifecycle: Called when the plugin is loaded
	 */
	async onload() {
		logger.info('Loading Podcast Player plugin');

		// Initialize data path manager with default path
		this.pathManager = new DataPathManager(this.app.vault, DEFAULT_SETTINGS.dataFolderPath);
		this.settingsStore = new SettingsStore(this.app.vault, this.pathManager);

		// Load settings
		await this.loadSettings();

		// Register settings tab
		this.addSettingTab(new PodcastPlayerSettingTab(this.app, this));

		// Add ribbon icon for quick access
		this.addRibbonIcon('podcast', 'Podcast Player', (evt: MouseEvent) => {
			new Notice('Podcast Player - Coming Soon!');
		});

		// Register commands
		this.addCommand({
			id: 'open-podcast-player',
			name: 'Open Podcast Player',
			callback: () => {
				new Notice('Podcast Player view - Coming Soon!');
			}
		});

		this.addCommand({
			id: 'subscribe-to-podcast',
			name: 'Subscribe to Podcast',
			callback: () => {
				new Notice('Subscribe to Podcast - Coming Soon!');
			}
		});

		logger.info('Podcast Player plugin loaded successfully');
	}

	/**
	 * Plugin lifecycle: Called when the plugin is unloaded
	 */
	onunload() {
		logger.info('Unloading Podcast Player plugin');
	}

	/**
	 * Load settings from store
	 */
	async loadSettings() {
		logger.methodEntry('PodcastPlayerPlugin', 'loadSettings');
		try {
			this.settings = await this.settingsStore.loadWithMigration();

			// Update path manager with current data folder path
			this.pathManager.updateBasePath(this.settings.dataFolderPath);

			logger.info('Settings loaded successfully');
		} catch (error) {
			logger.error('Failed to load settings, using defaults', error);
			this.settings = { ...DEFAULT_SETTINGS };
		}
		logger.methodExit('PodcastPlayerPlugin', 'loadSettings');
	}

	/**
	 * Save settings to store
	 */
	async saveSettings() {
		logger.methodEntry('PodcastPlayerPlugin', 'saveSettings');
		try {
			await this.settingsStore.updateSettings(this.settings);

			// Update path manager if data folder path changed
			this.pathManager.updateBasePath(this.settings.dataFolderPath);

			logger.info('Settings saved successfully');
		} catch (error) {
			logger.error('Failed to save settings', error);
			new Notice('Failed to save settings');
		}
		logger.methodExit('PodcastPlayerPlugin', 'saveSettings');
	}

	/**
	 * Reset settings to defaults
	 */
	async resetSettings() {
		logger.methodEntry('PodcastPlayerPlugin', 'resetSettings');
		try {
			await this.settingsStore.resetToDefaults();
			this.settings = { ...DEFAULT_SETTINGS };

			// Update path manager
			this.pathManager.updateBasePath(this.settings.dataFolderPath);

			logger.info('Settings reset to defaults');
		} catch (error) {
			logger.error('Failed to reset settings', error);
			new Notice('Failed to reset settings');
		}
		logger.methodExit('PodcastPlayerPlugin', 'resetSettings');
	}
}
