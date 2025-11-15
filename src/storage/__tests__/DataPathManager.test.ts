/**
 * Unit tests for DataPathManager
 */

import { DataPathManager } from '../DataPathManager';
import { Vault, normalizePath } from 'obsidian';
import { StorageError } from '../../utils/errorUtils';

// Mock logger
jest.mock('../../utils/Logger', () => ({
	logger: {
		info: jest.fn(),
		debug: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	},
}));

// Mock normalizePath
jest.mock('obsidian', () => ({
	normalizePath: jest.fn((path: string) => path.replace(/\\/g, '/')),
}));

describe('DataPathManager', () => {
	let manager: DataPathManager;
	let mockVault: jest.Mocked<Vault>;
	let mockAdapter: any;

	beforeEach(() => {
		jest.clearAllMocks();

		mockAdapter = {
			exists: jest.fn(),
			mkdir: jest.fn(),
			list: jest.fn(),
			read: jest.fn(),
			write: jest.fn(),
			remove: jest.fn(),
			stat: jest.fn(),
		};

		mockVault = {
			adapter: mockAdapter,
		} as any;

		manager = new DataPathManager(mockVault, '.obsidian/plugins/podcast-player/data');
	});

	describe('constructor', () => {
		it('should create manager with vault and base path', () => {
			expect(manager).toBeInstanceOf(DataPathManager);
			expect(normalizePath).toHaveBeenCalledWith('.obsidian/plugins/podcast-player/data');
		});

		it('should build folder structure', () => {
			const structure = manager.getStructure();
			expect(structure).toHaveProperty('root');
			expect(structure).toHaveProperty('subscriptions');
			expect(structure).toHaveProperty('progress');
			expect(structure).toHaveProperty('playlists');
			expect(structure).toHaveProperty('queues');
			expect(structure).toHaveProperty('cache');
			expect(structure).toHaveProperty('cacheFeed');
			expect(structure).toHaveProperty('cacheImages');
			expect(structure).toHaveProperty('backups');
		});
	});

	describe('getStructure', () => {
		it('should return folder structure', () => {
			const structure = manager.getStructure();
			expect(structure.root).toBe('.obsidian/plugins/podcast-player/data');
			expect(structure.subscriptions).toBe('.obsidian/plugins/podcast-player/data/subscriptions');
			expect(structure.playlists).toBe('.obsidian/plugins/podcast-player/data/playlists');
		});

		it('should return a copy of structure', () => {
			const structure1 = manager.getStructure();
			const structure2 = manager.getStructure();
			expect(structure1).not.toBe(structure2);
			expect(structure1).toEqual(structure2);
		});
	});

	describe('getBasePath', () => {
		it('should return base path', () => {
			const basePath = manager.getBasePath();
			expect(basePath).toBe('.obsidian/plugins/podcast-player/data');
		});
	});

	describe('updateBasePath', () => {
		it('should update base path and rebuild structure', () => {
			manager.updateBasePath('.obsidian/plugins/podcast-player/new-data');

			const basePath = manager.getBasePath();
			expect(basePath).toBe('.obsidian/plugins/podcast-player/new-data');

			const structure = manager.getStructure();
			expect(structure.root).toBe('.obsidian/plugins/podcast-player/new-data');
			expect(structure.subscriptions).toBe('.obsidian/plugins/podcast-player/new-data/subscriptions');
		});
	});

	describe('ensureDirectories', () => {
		it('should create all directories', async () => {
			mockAdapter.exists.mockResolvedValue(false);

			await manager.ensureDirectories();

			// Should create base directory + 8 subdirectories
			expect(mockAdapter.mkdir).toHaveBeenCalledTimes(9);
			expect(mockAdapter.mkdir).toHaveBeenCalledWith('.obsidian/plugins/podcast-player/data');
			expect(mockAdapter.mkdir).toHaveBeenCalledWith('.obsidian/plugins/podcast-player/data/subscriptions');
			expect(mockAdapter.mkdir).toHaveBeenCalledWith('.obsidian/plugins/podcast-player/data/playlists');
		});

		it('should not create directories if they exist', async () => {
			mockAdapter.exists.mockResolvedValue(true);

			await manager.ensureDirectories();

			expect(mockAdapter.mkdir).not.toHaveBeenCalled();
		});

		it('should create only missing directories', async () => {
			mockAdapter.exists
				.mockResolvedValueOnce(true) // base exists
				.mockResolvedValueOnce(false) // subscriptions missing
				.mockResolvedValueOnce(true) // progress exists
				.mockResolvedValueOnce(false) // playlists missing
				.mockResolvedValue(true); // rest exist

			await manager.ensureDirectories();

			expect(mockAdapter.mkdir).toHaveBeenCalledTimes(2);
			expect(mockAdapter.mkdir).toHaveBeenCalledWith('.obsidian/plugins/podcast-player/data/subscriptions');
			expect(mockAdapter.mkdir).toHaveBeenCalledWith('.obsidian/plugins/podcast-player/data/playlists');
		});

		it('should throw StorageError on failure', async () => {
			mockAdapter.exists.mockRejectedValue(new Error('Permission denied'));

			await expect(manager.ensureDirectories()).rejects.toThrow(StorageError);
		});
	});

	describe('getFilePath', () => {
		it('should return full path for file in subdirectory', () => {
			const path = manager.getFilePath('subscriptions', 'podcast.json');
			expect(path).toBe('.obsidian/plugins/podcast-player/data/subscriptions/podcast.json');
		});

		it('should normalize path', () => {
			const path = manager.getFilePath('playlists', 'my-playlist.json');
			expect(normalizePath).toHaveBeenCalled();
		});

		it('should work with different subdirectories', () => {
			const cachePath = manager.getFilePath('cacheFeed', 'feed-123.json');
			expect(cachePath).toBe('.obsidian/plugins/podcast-player/data/cache/feeds/feed-123.json');

			const backupPath = manager.getFilePath('backups', 'backup.json');
			expect(backupPath).toBe('.obsidian/plugins/podcast-player/data/backups/backup.json');
		});
	});

	describe('directoryExists', () => {
		it('should return true if directory exists', async () => {
			mockAdapter.exists.mockResolvedValue(true);

			const result = await manager.directoryExists('some/path');
			expect(result).toBe(true);
			expect(mockAdapter.exists).toHaveBeenCalledWith('some/path');
		});

		it('should return false if directory does not exist', async () => {
			mockAdapter.exists.mockResolvedValue(false);

			const result = await manager.directoryExists('some/path');
			expect(result).toBe(false);
		});

		it('should return false on error', async () => {
			mockAdapter.exists.mockRejectedValue(new Error('Access denied'));

			const result = await manager.directoryExists('some/path');
			expect(result).toBe(false);
		});
	});

	describe('fileExists', () => {
		it('should return true if file exists', async () => {
			mockAdapter.exists.mockResolvedValue(true);

			const result = await manager.fileExists('some/file.json');
			expect(result).toBe(true);
		});

		it('should return false if file does not exist', async () => {
			mockAdapter.exists.mockResolvedValue(false);

			const result = await manager.fileExists('some/file.json');
			expect(result).toBe(false);
		});

		it('should return false on error', async () => {
			mockAdapter.exists.mockRejectedValue(new Error('Access denied'));

			const result = await manager.fileExists('some/file.json');
			expect(result).toBe(false);
		});
	});

	describe('listFiles', () => {
		it('should list files in subdirectory', async () => {
			mockAdapter.exists.mockResolvedValue(true);
			mockAdapter.list.mockResolvedValue({
				files: ['file1.json', 'file2.json'],
				folders: [],
			});

			const files = await manager.listFiles('subscriptions');

			expect(files).toEqual(['file1.json', 'file2.json']);
			expect(mockAdapter.list).toHaveBeenCalledWith('.obsidian/plugins/podcast-player/data/subscriptions');
		});

		it('should return empty array if directory does not exist', async () => {
			mockAdapter.exists.mockResolvedValue(false);

			const files = await manager.listFiles('subscriptions');

			expect(files).toEqual([]);
			expect(mockAdapter.list).not.toHaveBeenCalled();
		});

		it('should throw StorageError on failure', async () => {
			mockAdapter.exists.mockResolvedValue(true);
			mockAdapter.list.mockRejectedValue(new Error('Read error'));

			await expect(manager.listFiles('subscriptions')).rejects.toThrow(StorageError);
		});
	});

	describe('deleteFile', () => {
		it('should delete file', async () => {
			await manager.deleteFile('some/file.json');

			expect(mockAdapter.remove).toHaveBeenCalledWith('some/file.json');
		});

		it('should throw StorageError on failure', async () => {
			mockAdapter.remove.mockRejectedValue(new Error('Delete failed'));

			await expect(manager.deleteFile('some/file.json')).rejects.toThrow(StorageError);
		});
	});

	describe('createBackup', () => {
		it('should create backup with auto-generated name', async () => {
			const sourceContent = '{"data": "test"}';
			mockAdapter.read.mockResolvedValue(sourceContent);

			const backupPath = await manager.createBackup('source.json');

			expect(mockAdapter.read).toHaveBeenCalledWith('source.json');
			expect(mockAdapter.write).toHaveBeenCalled();
			expect(backupPath).toMatch(/backups\/backup-.*\.json$/);
		});

		it('should create backup with custom name', async () => {
			const sourceContent = '{"data": "test"}';
			mockAdapter.read.mockResolvedValue(sourceContent);

			const backupPath = await manager.createBackup('source.json', 'custom-backup.json');

			expect(backupPath).toBe('.obsidian/plugins/podcast-player/data/backups/custom-backup.json');
			expect(mockAdapter.write).toHaveBeenCalledWith(backupPath, sourceContent);
		});

		it('should throw StorageError on read failure', async () => {
			mockAdapter.read.mockRejectedValue(new Error('Read failed'));

			await expect(manager.createBackup('source.json')).rejects.toThrow(StorageError);
		});

		it('should throw StorageError on write failure', async () => {
			mockAdapter.read.mockResolvedValue('content');
			mockAdapter.write.mockRejectedValue(new Error('Write failed'));

			await expect(manager.createBackup('source.json')).rejects.toThrow(StorageError);
		});
	});

	describe('cleanupOldBackups', () => {
		it('should not delete if within keep count', async () => {
			mockAdapter.exists.mockResolvedValue(true);
			mockAdapter.list.mockResolvedValue({
				files: ['backup1.json', 'backup2.json', 'backup3.json'],
				folders: [],
			});

			await manager.cleanupOldBackups(5);

			expect(mockAdapter.remove).not.toHaveBeenCalled();
		});

		it('should delete old backups exceeding keep count', async () => {
			mockAdapter.exists.mockResolvedValue(true);
			mockAdapter.list.mockResolvedValue({
				files: [
					'backup1.json',
					'backup2.json',
					'backup3.json',
					'backup4.json',
					'backup5.json',
					'backup6.json',
				],
				folders: [],
			});

			mockAdapter.stat.mockImplementation((file: string) => {
				// Simulate different modification times
				const times: Record<string, number> = {
					'backup1.json': 1000,
					'backup2.json': 2000,
					'backup3.json': 3000,
					'backup4.json': 4000,
					'backup5.json': 5000,
					'backup6.json': 6000,
				};
				return Promise.resolve({ mtime: times[file] || 0, size: 100 });
			});

			await manager.cleanupOldBackups(3);

			// Should delete the 3 oldest backups
			expect(mockAdapter.remove).toHaveBeenCalledTimes(3);
			expect(mockAdapter.remove).toHaveBeenCalledWith('backup1.json');
			expect(mockAdapter.remove).toHaveBeenCalledWith('backup2.json');
			expect(mockAdapter.remove).toHaveBeenCalledWith('backup3.json');
		});

		it('should handle errors gracefully', async () => {
			mockAdapter.exists.mockResolvedValue(true);
			mockAdapter.list.mockRejectedValue(new Error('List failed'));

			await expect(manager.cleanupOldBackups()).resolves.not.toThrow();
		});
	});

	describe('getDirectorySize', () => {
		it('should calculate total size of directory', async () => {
			mockAdapter.exists.mockResolvedValue(true);
			mockAdapter.list.mockResolvedValue({
				files: ['file1.json', 'file2.json', 'file3.json'],
				folders: [],
			});

			mockAdapter.stat.mockImplementation((file: string) => {
				const sizes: Record<string, number> = {
					'file1.json': 100,
					'file2.json': 200,
					'file3.json': 300,
				};
				return Promise.resolve({ mtime: 1000, size: sizes[file] || 0 });
			});

			const size = await manager.getDirectorySize('subscriptions');

			expect(size).toBe(600);
		});

		it('should return 0 for empty directory', async () => {
			mockAdapter.exists.mockResolvedValue(true);
			mockAdapter.list.mockResolvedValue({
				files: [],
				folders: [],
			});

			const size = await manager.getDirectorySize('subscriptions');

			expect(size).toBe(0);
		});

		it('should return 0 on error', async () => {
			mockAdapter.exists.mockResolvedValue(true);
			mockAdapter.list.mockRejectedValue(new Error('List failed'));

			const size = await manager.getDirectorySize('subscriptions');

			expect(size).toBe(0);
		});
	});
});
