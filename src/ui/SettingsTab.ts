/**
 * SettingsTab - Obsidian settings UI for Podcast Player
 *
 * Provides a user-friendly interface for configuring plugin settings.
 */

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type PodcastPlayerPlugin from '../../main';
import { PluginSettings } from '../model';

/**
 * PodcastPlayerSettingTab - Settings UI for the Podcast Player plugin
 */
export class PodcastPlayerSettingTab extends PluginSettingTab {
	plugin: PodcastPlayerPlugin;
	private settings: PluginSettings;

	constructor(app: App, plugin: PodcastPlayerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * Display the settings UI
	 */
	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// Load current settings
		this.loadSettings();

		// Header
		containerEl.createEl('h2', { text: 'Podcast Player Settings' });

		// === Data Storage ===
		this.addStorageSection(containerEl);

		// === Default Playback Settings ===
		this.addPlaybackSection(containerEl);

		// === Download & Cache ===
		this.addCacheSection(containerEl);

		// === Sync Settings ===
		this.addSyncSection(containerEl);

		// === Notification Settings ===
		this.addNotificationSection(containerEl);

		// === Advanced ===
		this.addAdvancedSection(containerEl);
	}

	/**
	 * Load current settings from plugin
	 */
	private async loadSettings(): Promise<void> {
		// In future, this will load from SettingsStore
		// For now, we use default settings as placeholder
		this.settings = this.plugin.settings;
	}

	/**
	 * Save settings to plugin and store
	 */
	private async saveSettings(): Promise<void> {
		// In future, this will save to SettingsStore
		await this.plugin.saveSettings();
	}

	/**
	 * Add storage section
	 */
	private addStorageSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Data Storage' });

		new Setting(containerEl)
			.setName('Data folder path')
			.setDesc('Folder where podcast data will be stored (relative to vault root)')
			.addText(text => text
				.setPlaceholder('.obsidian/plugins/podcast-player/data')
				.setValue(this.settings.dataFolderPath)
				.onChange(async (value) => {
					this.settings.dataFolderPath = value;
					await this.saveSettings();
				}));
	}

	/**
	 * Add playback settings section
	 */
	private addPlaybackSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Default Playback Settings' });
		containerEl.createEl('p', {
			text: 'These settings apply to all podcasts by default. Individual podcasts can override these.',
			cls: 'setting-item-description'
		});

		// Volume
		new Setting(containerEl)
			.setName('Default volume')
			.setDesc('Default playback volume (0.0 to 1.0)')
			.addSlider(slider => slider
				.setLimits(0, 100, 5)
				.setValue(this.settings.defaultPlaybackSettings.volume * 100)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.settings.defaultPlaybackSettings.volume = value / 100;
					await this.saveSettings();
				}));

		// Playback Speed
		new Setting(containerEl)
			.setName('Default playback speed')
			.setDesc('Default playback speed (0.5x to 3.0x)')
			.addSlider(slider => slider
				.setLimits(50, 300, 5)
				.setValue(this.settings.defaultPlaybackSettings.playbackSpeed * 100)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.settings.defaultPlaybackSettings.playbackSpeed = value / 100;
					await this.saveSettings();
				}));

		// Skip Intro
		new Setting(containerEl)
			.setName('Skip intro seconds')
			.setDesc('Number of seconds to skip at the beginning of each episode')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(String(this.settings.defaultPlaybackSettings.skipIntroSeconds))
				.onChange(async (value) => {
					const seconds = parseInt(value, 10);
					if (!isNaN(seconds) && seconds >= 0) {
						this.settings.defaultPlaybackSettings.skipIntroSeconds = seconds;
						await this.saveSettings();
					}
				}));

		// Skip Outro
		new Setting(containerEl)
			.setName('Skip outro seconds')
			.setDesc('Number of seconds to skip at the end of each episode')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(String(this.settings.defaultPlaybackSettings.skipOutroSeconds || 0))
				.onChange(async (value) => {
					const seconds = parseInt(value, 10);
					if (!isNaN(seconds) && seconds >= 0) {
						this.settings.defaultPlaybackSettings.skipOutroSeconds = seconds;
						await this.saveSettings();
					}
				}));
	}

	/**
	 * Add cache settings section
	 */
	private addCacheSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Download & Cache' });

		// Auto Download
		new Setting(containerEl)
			.setName('Auto download new episodes')
			.setDesc('Automatically download new episodes when feeds are updated')
			.addToggle(toggle => toggle
				.setValue(this.settings.autoDownload)
				.onChange(async (value) => {
					this.settings.autoDownload = value;
					await this.saveSettings();
				}));

		// Max Cache Episodes
		new Setting(containerEl)
			.setName('Maximum cached episodes')
			.setDesc('Maximum number of episodes to keep in cache. Older episodes will be removed.')
			.addText(text => text
				.setPlaceholder('50')
				.setValue(String(this.settings.maxCacheEpisodes))
				.onChange(async (value) => {
					const count = parseInt(value, 10);
					if (!isNaN(count) && count >= 0) {
						this.settings.maxCacheEpisodes = count;
						await this.saveSettings();
					}
				}));
	}

	/**
	 * Add sync settings section
	 */
	private addSyncSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Feed Sync' });

		// Feed Update Interval
		new Setting(containerEl)
			.setName('Feed update interval')
			.setDesc('How often to check for new episodes (in minutes)')
			.addDropdown(dropdown => dropdown
				.addOption('15', '15 minutes')
				.addOption('30', '30 minutes')
				.addOption('60', '1 hour')
				.addOption('120', '2 hours')
				.addOption('360', '6 hours')
				.addOption('720', '12 hours')
				.addOption('1440', '24 hours')
				.setValue(String(this.settings.feedUpdateInterval))
				.onChange(async (value) => {
					this.settings.feedUpdateInterval = parseInt(value, 10);
					await this.saveSettings();
				}));
	}

	/**
	 * Add notification settings section
	 */
	private addNotificationSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Notifications' });

		new Setting(containerEl)
			.setName('Enable notifications')
			.setDesc('Show notifications for new episodes and playback events')
			.addToggle(toggle => toggle
				.setValue(this.settings.enableNotifications)
				.onChange(async (value) => {
					this.settings.enableNotifications = value;
					await this.saveSettings();
				}));
	}

	/**
	 * Add advanced section
	 */
	private addAdvancedSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Advanced' });

		// Reset to defaults
		new Setting(containerEl)
			.setName('Reset to defaults')
			.setDesc('Reset all settings to their default values')
			.addButton(button => button
				.setButtonText('Reset')
				.setWarning()
				.onClick(async () => {
					if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
						await this.plugin.resetSettings();
						this.display(); // Refresh the display
						new Notice('Settings reset to defaults');
					}
				}));

		// Export settings
		new Setting(containerEl)
			.setName('Export settings')
			.setDesc('Export your settings to a JSON file for backup or sharing')
			.addButton(button => button
				.setButtonText('Export')
				.onClick(async () => {
					await this.exportSettings();
				}));

		// Import settings
		new Setting(containerEl)
			.setName('Import settings')
			.setDesc('Import settings from a JSON file')
			.addButton(button => button
				.setButtonText('Import')
				.onClick(async () => {
					await this.importSettings();
				}));
	}

	/**
	 * Export settings to JSON file
	 */
	private async exportSettings(): Promise<void> {
		try {
			const settingsJson = JSON.stringify(this.settings, null, 2);
			const blob = new Blob([settingsJson], { type: 'application/json' });
			const url = URL.createObjectURL(blob);

			const a = document.createElement('a');
			a.href = url;
			a.download = `podcast-player-settings-${Date.now()}.json`;
			a.click();

			URL.revokeObjectURL(url);
			new Notice('Settings exported successfully');
		} catch (error) {
			console.error('Failed to export settings:', error);
			new Notice('Failed to export settings');
		}
	}

	/**
	 * Import settings from JSON file
	 */
	private async importSettings(): Promise<void> {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';

		input.onchange = async (e: Event) => {
			const target = e.target as HTMLInputElement;
			const file = target.files?.[0];

			if (!file) {
				return;
			}

			try {
				const text = await file.text();
				const importedSettings = JSON.parse(text) as PluginSettings;

				// Validate imported settings (basic check)
				if (!importedSettings.dataFolderPath || !importedSettings.defaultPlaybackSettings) {
					throw new Error('Invalid settings file format');
				}

				// Apply imported settings
				this.settings = importedSettings;
				await this.saveSettings();
				this.display(); // Refresh the display

				new Notice('Settings imported successfully');
			} catch (error) {
				console.error('Failed to import settings:', error);
				new Notice('Failed to import settings: Invalid file format');
			}
		};

		input.click();
	}
}
