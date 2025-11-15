/**
 * Unit tests for SettingsStore
 */

import { SettingsStore } from '../SettingsStore';
import { MockVault } from '../../../__mocks__/obsidian';
import { DataPathManager } from '../DataPathManager';
import { DEFAULT_SETTINGS, PluginSettings } from '../../model';

describe('SettingsStore', () => {
	let vault: MockVault;
	let pathManager: DataPathManager;
	let settingsStore: SettingsStore;

	beforeEach(() => {
		vault = new MockVault();
		pathManager = new DataPathManager(vault as any, '.obsidian/plugins/podcast-player/data');
		settingsStore = new SettingsStore(vault as any, pathManager);
	});

	describe('getSettings', () => {
		it('should return default settings when no settings file exists', async () => {
			vault.adapter.exists = jest.fn().mockResolvedValue(false);

			const settings = await settingsStore.getSettings();

			expect(settings).toEqual(DEFAULT_SETTINGS);
		});

		it('should return saved settings when file exists', async () => {
			const customSettings: PluginSettings = {
				...DEFAULT_SETTINGS,
				dataFolderPath: 'custom/path',
				defaultPlaybackSettings: {
					volume: 0.8,
					playbackSpeed: 1.5,
					skipIntroSeconds: 10,
					skipOutroSeconds: 5,
				},
			};

			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify(customSettings));

			const settings = await settingsStore.getSettings();

			expect(settings).toEqual(customSettings);
		});
	});

	describe('updateSettings', () => {
		it('should save settings to file', async () => {
			const newSettings: PluginSettings = {
				...DEFAULT_SETTINGS,
				dataFolderPath: 'new/path',
			};

			vault.adapter.write = jest.fn().mockResolvedValue(undefined);

			await settingsStore.updateSettings(newSettings);

			expect(vault.adapter.write).toHaveBeenCalled();
		});
	});

	describe('updateSetting', () => {
		it('should update a specific setting field', async () => {
			const mockRead = jest.fn().mockResolvedValue(JSON.stringify(DEFAULT_SETTINGS));
			const mockWrite = jest.fn().mockResolvedValue(undefined);
			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = mockRead;
			vault.adapter.write = mockWrite;
			vault.adapter.mkdir = jest.fn().mockResolvedValue(undefined);

			await settingsStore.updateSetting('dataFolderPath', 'updated/path');

			expect(mockWrite).toHaveBeenCalled();
			const writeCall = mockWrite.mock.calls[mockWrite.mock.calls.length - 1];
			const savedData = JSON.parse(writeCall[1]);
			expect(savedData.dataFolderPath).toBe('updated/path');
		});
	});

	describe('updateDefaultVolume', () => {
		it('should update default volume within valid range', async () => {
			const mockRead = jest.fn().mockResolvedValue(JSON.stringify(DEFAULT_SETTINGS));
			const mockWrite = jest.fn().mockResolvedValue(undefined);
			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = mockRead;
			vault.adapter.write = mockWrite;

			await settingsStore.updateDefaultVolume(0.5);

			const writeCall = mockWrite.mock.calls[mockWrite.mock.calls.length - 1];
			const savedData = JSON.parse(writeCall[1]);
			expect(savedData.defaultPlaybackSettings.volume).toBe(0.5);
		});

		it('should clamp volume to maximum of 1.0', async () => {
			const mockRead = jest.fn().mockResolvedValue(JSON.stringify(DEFAULT_SETTINGS));
			const mockWrite = jest.fn().mockResolvedValue(undefined);
			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = mockRead;
			vault.adapter.write = mockWrite;

			await settingsStore.updateDefaultVolume(1.5);

			const writeCall = mockWrite.mock.calls[mockWrite.mock.calls.length - 1];
			const savedData = JSON.parse(writeCall[1]);
			expect(savedData.defaultPlaybackSettings.volume).toBe(1.0);
		});

		it('should clamp volume to minimum of 0.0', async () => {
			const mockRead = jest.fn().mockResolvedValue(JSON.stringify(DEFAULT_SETTINGS));
			const mockWrite = jest.fn().mockResolvedValue(undefined);
			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = mockRead;
			vault.adapter.write = mockWrite;

			await settingsStore.updateDefaultVolume(-0.5);

			const writeCall = mockWrite.mock.calls[mockWrite.mock.calls.length - 1];
			const savedData = JSON.parse(writeCall[1]);
			expect(savedData.defaultPlaybackSettings.volume).toBe(0.0);
		});
	});

	describe('updateDefaultPlaybackSpeed', () => {
		it('should update default playback speed within valid range', async () => {
			const mockRead = jest.fn().mockResolvedValue(JSON.stringify(DEFAULT_SETTINGS));
			const mockWrite = jest.fn().mockResolvedValue(undefined);
			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = mockRead;
			vault.adapter.write = mockWrite;

			await settingsStore.updateDefaultPlaybackSpeed(1.5);

			const writeCall = mockWrite.mock.calls[mockWrite.mock.calls.length - 1];
			const savedData = JSON.parse(writeCall[1]);
			expect(savedData.defaultPlaybackSettings.playbackSpeed).toBe(1.5);
		});

		it('should clamp speed to maximum of 3.0', async () => {
			const mockRead = jest.fn().mockResolvedValue(JSON.stringify(DEFAULT_SETTINGS));
			const mockWrite = jest.fn().mockResolvedValue(undefined);
			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = mockRead;
			vault.adapter.write = mockWrite;

			await settingsStore.updateDefaultPlaybackSpeed(5.0);

			const writeCall = mockWrite.mock.calls[mockWrite.mock.calls.length - 1];
			const savedData = JSON.parse(writeCall[1]);
			expect(savedData.defaultPlaybackSettings.playbackSpeed).toBe(3.0);
		});

		it('should clamp speed to minimum of 0.5', async () => {
			const mockRead = jest.fn().mockResolvedValue(JSON.stringify(DEFAULT_SETTINGS));
			const mockWrite = jest.fn().mockResolvedValue(undefined);
			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = mockRead;
			vault.adapter.write = mockWrite;

			await settingsStore.updateDefaultPlaybackSpeed(0.1);

			const writeCall = mockWrite.mock.calls[mockWrite.mock.calls.length - 1];
			const savedData = JSON.parse(writeCall[1]);
			expect(savedData.defaultPlaybackSettings.playbackSpeed).toBe(0.5);
		});
	});

	describe('resetToDefaults', () => {
		it('should reset settings to default values', async () => {
			const mockWrite = jest.fn().mockResolvedValue(undefined);
			vault.adapter.write = mockWrite;
			vault.adapter.mkdir = jest.fn().mockResolvedValue(undefined);

			await settingsStore.resetToDefaults();

			expect(mockWrite).toHaveBeenCalled();
			const writeCall = mockWrite.mock.calls[mockWrite.mock.calls.length - 1];
			const savedData = JSON.parse(writeCall[1]);
			expect(savedData).toMatchObject({
				dataFolderPath: DEFAULT_SETTINGS.dataFolderPath,
				autoDownload: DEFAULT_SETTINGS.autoDownload,
				maxCacheEpisodes: DEFAULT_SETTINGS.maxCacheEpisodes,
				feedUpdateInterval: DEFAULT_SETTINGS.feedUpdateInterval,
				enableNotifications: DEFAULT_SETTINGS.enableNotifications,
			});
			expect(savedData.defaultPlaybackSettings).toMatchObject({
				volume: DEFAULT_SETTINGS.defaultPlaybackSettings.volume,
				playbackSpeed: DEFAULT_SETTINGS.defaultPlaybackSettings.playbackSpeed,
				skipIntroSeconds: DEFAULT_SETTINGS.defaultPlaybackSettings.skipIntroSeconds,
			});
		});
	});

	describe('loadWithMigration', () => {
		it('should merge with defaults for missing fields', async () => {
			const partialSettings = {
				dataFolderPath: 'custom/path',
				defaultPlaybackSettings: {
					volume: 0.8,
					playbackSpeed: 1.0,
					skipIntroSeconds: 0,
					// Missing skipOutroSeconds
				},
				autoDownload: false,
				maxCacheEpisodes: 50,
				feedUpdateInterval: 60,
				enableNotifications: true,
			};

			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify(partialSettings));
			vault.adapter.write = jest.fn().mockResolvedValue(undefined);

			const settings = await settingsStore.loadWithMigration();

			expect(settings.defaultPlaybackSettings.skipOutroSeconds).toBeDefined();
			expect(settings.defaultPlaybackSettings.skipOutroSeconds).toBe(0);
		});

		it('should save migrated settings if they changed', async () => {
			// Create settings missing the skipOutroSeconds field (added in later version)
			const partialSettings = {
				dataFolderPath: 'custom/path',
				defaultPlaybackSettings: {
					volume: 0.8,
					playbackSpeed: 1.0,
					skipIntroSeconds: 0,
					// Missing skipOutroSeconds - this should trigger migration
				},
				autoDownload: false,
				maxCacheEpisodes: 50,
				feedUpdateInterval: 60,
				enableNotifications: true,
			};

			const mockWrite = jest.fn().mockResolvedValue(undefined);
			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify(partialSettings));
			vault.adapter.write = mockWrite;
			vault.adapter.mkdir = jest.fn().mockResolvedValue(undefined);

			const settings = await settingsStore.loadWithMigration();

			// The settings should have the missing field filled in
			expect(settings.defaultPlaybackSettings.skipOutroSeconds).toBeDefined();
			expect(settings.defaultPlaybackSettings.skipOutroSeconds).toBe(0);

			// Migration should save the updated settings
			expect(mockWrite).toHaveBeenCalled();
		});
	});

	describe('validation', () => {
		it('should return default settings for invalid data', async () => {
			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue('invalid json');

			const settings = await settingsStore.getSettings();

			expect(settings).toEqual(DEFAULT_SETTINGS);
		});

		it('should return default settings for non-object data', async () => {
			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify('string'));

			const settings = await settingsStore.getSettings();

			expect(settings).toEqual(DEFAULT_SETTINGS);
		});
	});
});
