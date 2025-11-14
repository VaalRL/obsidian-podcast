/**
 * SettingsStore - Manages plugin settings
 *
 * Stores plugin configuration and user preferences in a single JSON file.
 * Provides methods for loading, saving, and updating settings.
 */

import { Vault, normalizePath } from 'obsidian';
import { logger } from '../utils/Logger';
import { StorageError } from '../utils/errorUtils';
import { PluginSettings, DEFAULT_SETTINGS } from '../model';
import { DataPathManager } from './DataPathManager';
import { SingleFileStore } from './FileSystemStore';

/**
 * SettingsStore - Manages plugin settings
 */
export class SettingsStore extends SingleFileStore<PluginSettings> {
	constructor(vault: Vault, pathManager: DataPathManager) {
		const filePath = pathManager.getFilePath('root', 'settings.json');
		super(vault, pathManager, filePath);
	}

	/**
	 * Validate settings data
	 */
	protected validate(data: PluginSettings): boolean {
		if (!data || typeof data !== 'object') {
			logger.warn('Invalid settings data: not an object');
			return false;
		}

		// Validate required string fields
		if (typeof data.dataFolderPath !== 'string') {
			logger.warn('Invalid settings: dataFolderPath is not a string');
			return false;
		}

		// Validate defaultPlaybackSettings
		if (!data.defaultPlaybackSettings || typeof data.defaultPlaybackSettings !== 'object') {
			logger.warn('Invalid settings: defaultPlaybackSettings is not an object');
			return false;
		}

		const playbackSettings = data.defaultPlaybackSettings;
		if (
			typeof playbackSettings.volume !== 'number' ||
			typeof playbackSettings.playbackSpeed !== 'number' ||
			typeof playbackSettings.skipIntroSeconds !== 'number'
		) {
			logger.warn('Invalid settings: defaultPlaybackSettings has invalid fields');
			return false;
		}

		// Validate boolean fields
		if (typeof data.autoDownload !== 'boolean') {
			logger.warn('Invalid settings: autoDownload is not a boolean');
			return false;
		}

		if (typeof data.enableNotifications !== 'boolean') {
			logger.warn('Invalid settings: enableNotifications is not a boolean');
			return false;
		}

		// Validate number fields
		if (typeof data.maxCacheEpisodes !== 'number' || data.maxCacheEpisodes < 0) {
			logger.warn('Invalid settings: maxCacheEpisodes is invalid');
			return false;
		}

		if (typeof data.feedUpdateInterval !== 'number' || data.feedUpdateInterval < 0) {
			logger.warn('Invalid settings: feedUpdateInterval is invalid');
			return false;
		}

		return true;
	}

	/**
	 * Get default settings
	 */
	protected getDefaultValue(): PluginSettings {
		return { ...DEFAULT_SETTINGS };
	}

	/**
	 * Get current settings
	 */
	async getSettings(): Promise<PluginSettings> {
		logger.methodEntry('SettingsStore', 'getSettings');
		const settings = await this.load();
		logger.methodExit('SettingsStore', 'getSettings');
		return settings;
	}

	/**
	 * Update settings
	 */
	async updateSettings(settings: PluginSettings): Promise<void> {
		logger.methodEntry('SettingsStore', 'updateSettings');
		await this.save(settings);
		logger.methodExit('SettingsStore', 'updateSettings');
	}

	/**
	 * Update a specific setting
	 */
	async updateSetting<K extends keyof PluginSettings>(
		key: K,
		value: PluginSettings[K]
	): Promise<void> {
		logger.methodEntry('SettingsStore', 'updateSetting', key);

		const settings = await this.load();
		settings[key] = value;

		await this.save(settings);
		logger.methodExit('SettingsStore', 'updateSetting');
	}

	/**
	 * Get a specific setting value
	 */
	async getSetting<K extends keyof PluginSettings>(key: K): Promise<PluginSettings[K]> {
		const settings = await this.load();
		return settings[key];
	}

	/**
	 * Update data folder path
	 */
	async updateDataFolderPath(path: string): Promise<void> {
		logger.methodEntry('SettingsStore', 'updateDataFolderPath', path);
		await this.updateSetting('dataFolderPath', normalizePath(path));
		logger.methodExit('SettingsStore', 'updateDataFolderPath');
	}

	/**
	 * Update default playback volume
	 */
	async updateDefaultVolume(volume: number): Promise<void> {
		logger.methodEntry('SettingsStore', 'updateDefaultVolume', volume);

		const settings = await this.load();
		settings.defaultPlaybackSettings.volume = Math.max(0, Math.min(1, volume));

		await this.save(settings);
		logger.methodExit('SettingsStore', 'updateDefaultVolume');
	}

	/**
	 * Update default playback speed
	 */
	async updateDefaultPlaybackSpeed(speed: number): Promise<void> {
		logger.methodEntry('SettingsStore', 'updateDefaultPlaybackSpeed', speed);

		const settings = await this.load();
		settings.defaultPlaybackSettings.playbackSpeed = Math.max(0.5, Math.min(3.0, speed));

		await this.save(settings);
		logger.methodExit('SettingsStore', 'updateDefaultPlaybackSpeed');
	}

	/**
	 * Update default skip intro seconds
	 */
	async updateDefaultSkipIntro(seconds: number): Promise<void> {
		logger.methodEntry('SettingsStore', 'updateDefaultSkipIntro', seconds);

		const settings = await this.load();
		settings.defaultPlaybackSettings.skipIntroSeconds = Math.max(0, seconds);

		await this.save(settings);
		logger.methodExit('SettingsStore', 'updateDefaultSkipIntro');
	}

	/**
	 * Update default skip outro seconds
	 */
	async updateDefaultSkipOutro(seconds: number): Promise<void> {
		logger.methodEntry('SettingsStore', 'updateDefaultSkipOutro', seconds);

		const settings = await this.load();
		settings.defaultPlaybackSettings.skipOutroSeconds = Math.max(0, seconds);

		await this.save(settings);
		logger.methodExit('SettingsStore', 'updateDefaultSkipOutro');
	}

	/**
	 * Update auto download setting
	 */
	async updateAutoDownload(enabled: boolean): Promise<void> {
		logger.methodEntry('SettingsStore', 'updateAutoDownload', enabled);
		await this.updateSetting('autoDownload', enabled);
		logger.methodExit('SettingsStore', 'updateAutoDownload');
	}

	/**
	 * Update max cache episodes
	 */
	async updateMaxCacheEpisodes(count: number): Promise<void> {
		logger.methodEntry('SettingsStore', 'updateMaxCacheEpisodes', count);
		await this.updateSetting('maxCacheEpisodes', Math.max(0, count));
		logger.methodExit('SettingsStore', 'updateMaxCacheEpisodes');
	}

	/**
	 * Update feed update interval (in milliseconds)
	 */
	async updateFeedUpdateInterval(interval: number): Promise<void> {
		logger.methodEntry('SettingsStore', 'updateFeedUpdateInterval', interval);
		await this.updateSetting('feedUpdateInterval', Math.max(0, interval));
		logger.methodExit('SettingsStore', 'updateFeedUpdateInterval');
	}

	/**
	 * Update notifications setting
	 */
	async updateNotifications(enabled: boolean): Promise<void> {
		logger.methodEntry('SettingsStore', 'updateNotifications', enabled);
		await this.updateSetting('enableNotifications', enabled);
		logger.methodExit('SettingsStore', 'updateNotifications');
	}

	/**
	 * Reset settings to default
	 */
	async resetToDefaults(): Promise<void> {
		logger.methodEntry('SettingsStore', 'resetToDefaults');
		await this.save(this.getDefaultValue());
		logger.methodExit('SettingsStore', 'resetToDefaults');
	}

	/**
	 * Export settings (for backup or sharing)
	 */
	async exportSettings(): Promise<PluginSettings> {
		logger.methodEntry('SettingsStore', 'exportSettings');
		const settings = await this.load();
		logger.methodExit('SettingsStore', 'exportSettings');
		return settings;
	}

	/**
	 * Import settings (for restore or sharing)
	 */
	async importSettings(importSettings: PluginSettings): Promise<void> {
		logger.methodEntry('SettingsStore', 'importSettings');

		if (!this.validate(importSettings)) {
			throw new StorageError('Invalid import settings', this.filePath);
		}

		await this.save(importSettings);
		logger.methodExit('SettingsStore', 'importSettings');
	}

	/**
	 * Get settings with migration support
	 * If settings are from an older version, migrate them to the current version
	 */
	async loadWithMigration(): Promise<PluginSettings> {
		logger.methodEntry('SettingsStore', 'loadWithMigration');

		const settings = await this.load();

		// Check if migration is needed
		// (In the future, we can check version numbers and migrate accordingly)

		// For now, just ensure all fields exist by merging with defaults
		const migratedSettings: PluginSettings = {
			...this.getDefaultValue(),
			...settings,
			defaultPlaybackSettings: {
				...DEFAULT_SETTINGS.defaultPlaybackSettings,
				...settings.defaultPlaybackSettings,
			},
		};

		// Save migrated settings if they were changed
		if (JSON.stringify(settings) !== JSON.stringify(migratedSettings)) {
			logger.info('Migrating settings to current version');
			await this.save(migratedSettings);
		}

		logger.methodExit('SettingsStore', 'loadWithMigration');
		return migratedSettings;
	}
}
