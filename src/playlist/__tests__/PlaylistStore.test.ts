/**
 * Unit tests for PlaylistStore
 */

import { PlaylistStore } from '../PlaylistStore';
import { Vault } from 'obsidian';
import { DataPathManager } from '../../storage/DataPathManager';
import { Playlist } from '../../model';
import { StorageError } from '../../utils/errorUtils';

// Mock logger
jest.mock('../../utils/Logger', () => ({
	logger: {
		methodEntry: jest.fn(),
		methodExit: jest.fn(),
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	},
}));

// Mock the parent class
jest.mock('../../storage/FileSystemStore', () => {
	const itemsStore = new Map<string, any>();

	return {
		MultiFileStore: class {
			protected dirPath: string;

			constructor(vault: any, pathManager: any, dirPath: string) {
				this.dirPath = dirPath;
			}

			async listItemIds(): Promise<string[]> {
				return Array.from(itemsStore.keys());
			}

			async loadItem(id: string, defaultValue: any): Promise<any> {
				return itemsStore.get(id) || defaultValue;
			}

			async saveItem(id: string, data: any): Promise<void> {
				itemsStore.set(id, data);
			}

			async deleteItem(id: string): Promise<void> {
				itemsStore.delete(id);
			}

			async clear(): Promise<void> {
				itemsStore.clear();
			}
		},
	};
});

describe('PlaylistStore', () => {
	let store: PlaylistStore;
	let mockVault: jest.Mocked<Vault>;
	let mockPathManager: jest.Mocked<DataPathManager>;

	const samplePlaylist: Playlist = {
		id: 'playlist-123',
		name: 'My Playlist',
		description: 'Test playlist',
		episodeIds: ['ep-1', 'ep-2', 'ep-3'],
		createdAt: new Date('2024-01-01T10:00:00Z'),
		updatedAt: new Date('2024-01-01T11:00:00Z'),
	};

	beforeEach(() => {
		jest.clearAllMocks();
		// Clear the mock store
		const { MultiFileStore } = require('../../storage/FileSystemStore');
		const instance = new MultiFileStore({}, {}, '');
		instance.clear();

		mockVault = {} as any;
		mockPathManager = {
			getStructure: jest.fn().mockReturnValue({
				playlists: 'playlists',
			}),
		} as any;

		store = new PlaylistStore(mockVault, mockPathManager);
	});

	describe('constructor', () => {
		it('should create store with vault and path manager', () => {
			const freshPathManager = {
				getStructure: jest.fn().mockReturnValue({
					playlists: 'playlists',
				}),
			} as any;
			const freshStore = new PlaylistStore(mockVault, freshPathManager);
			expect(freshStore).toBeInstanceOf(PlaylistStore);
			expect(freshPathManager.getStructure).toHaveBeenCalled();
		});
	});

	describe('validation', () => {
		it('should validate correct playlist array', () => {
			const validData = [samplePlaylist];
			const result = (store as any).validate(validData);
			expect(result).toBe(true);
		});

		it('should reject non-array data', () => {
			const result = (store as any).validate('not an array');
			expect(result).toBe(false);
		});

		it('should reject array with invalid playlist', () => {
			const invalidData = [{ id: 'test' }]; // Missing required fields
			const result = (store as any).validate(invalidData);
			expect(result).toBe(false);
		});

		it('should validate individual playlist', () => {
			const result = (store as any).validatePlaylist(samplePlaylist);
			expect(result).toBe(true);
		});

		it('should reject playlist missing required fields', () => {
			const invalidPlaylist = {
				id: 'test',
				name: 'Test',
			};
			const result = (store as any).validatePlaylist(invalidPlaylist);
			expect(result).toBe(false);
		});

		it('should reject non-object playlist', () => {
			const result = (store as any).validatePlaylist('not an object');
			expect(result).toBe(false);
		});

		it('should reject playlist with non-array episodeIds', () => {
			const invalidPlaylist = {
				...samplePlaylist,
				episodeIds: 'not an array',
			};
			const result = (store as any).validatePlaylist(invalidPlaylist);
			expect(result).toBe(false);
		});
	});

	describe('getDefaultValue', () => {
		it('should return empty array', () => {
			const result = (store as any).getDefaultValue();
			expect(result).toEqual([]);
		});
	});

	describe('savePlaylist and getPlaylist', () => {
		it('should save and get playlist', async () => {
			await store.savePlaylist(samplePlaylist);

			const result = await store.getPlaylist(samplePlaylist.id);
			expect(result).toEqual(samplePlaylist);
		});

		it('should return null for non-existent playlist', async () => {
			const result = await store.getPlaylist('non-existent');
			expect(result).toBeNull();
		});

		it('should throw error for invalid playlist', async () => {
			const invalidPlaylist = { id: 'test' } as any;
			await expect(store.savePlaylist(invalidPlaylist)).rejects.toThrow(StorageError);
		});

		it('should return null for invalid stored playlist', async () => {
			const invalidPlaylist = { id: 'test' };
			const id = 'test';
			await (store as any).saveItem(id, invalidPlaylist);

			const result = await store.getPlaylist(id);
			expect(result).toBeNull();
		});
	});

	describe('deletePlaylist', () => {
		it('should delete playlist', async () => {
			await store.savePlaylist(samplePlaylist);

			await store.deletePlaylist(samplePlaylist.id);

			const result = await store.getPlaylist(samplePlaylist.id);
			expect(result).toBeNull();
		});

		it('should not throw error when deleting non-existent playlist', async () => {
			await expect(store.deletePlaylist('non-existent')).resolves.not.toThrow();
		});
	});

	describe('load', () => {
		it('should load all playlists', async () => {
			const playlist1: Playlist = { ...samplePlaylist, id: 'pl-1', name: 'Playlist 1' };
			const playlist2: Playlist = { ...samplePlaylist, id: 'pl-2', name: 'Playlist 2' };

			await store.savePlaylist(playlist1);
			await store.savePlaylist(playlist2);

			const result = await store.load();

			expect(result).toHaveLength(2);
			expect(result.some(p => p.id === 'pl-1')).toBe(true);
			expect(result.some(p => p.id === 'pl-2')).toBe(true);
		});

		it('should return empty array when no playlists', async () => {
			const result = await store.load();
			expect(result).toEqual([]);
		});

		it('should skip invalid playlists', async () => {
			await store.savePlaylist(samplePlaylist);

			// Add an invalid playlist
			await (store as any).saveItem('invalid', { id: 'invalid' });

			const result = await store.load();

			// Should only load the valid playlist
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe(samplePlaylist.id);
		});
	});

	describe('save', () => {
		it('should save all playlists', async () => {
			const playlists: Playlist[] = [
				{ ...samplePlaylist, id: 'pl-1', name: 'Playlist 1' },
				{ ...samplePlaylist, id: 'pl-2', name: 'Playlist 2' },
			];

			await store.save(playlists);

			const result = await store.load();
			expect(result).toHaveLength(2);
		});

		it('should clear existing playlists before saving', async () => {
			await store.savePlaylist({ ...samplePlaylist, id: 'old' });

			const newPlaylists: Playlist[] = [
				{ ...samplePlaylist, id: 'new-1', name: 'New 1' },
			];

			await store.save(newPlaylists);

			const result = await store.load();
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('new-1');
		});

		it('should throw error for invalid data', async () => {
			const invalidData = [{ id: 'test' }] as any;
			await expect(store.save(invalidData)).rejects.toThrow(StorageError);
		});
	});

	describe('exists', () => {
		it('should return true for existing playlist', async () => {
			await store.savePlaylist(samplePlaylist);

			const result = await store.exists(samplePlaylist.id);
			expect(result).toBe(true);
		});

		it('should return false for non-existent playlist', async () => {
			const result = await store.exists('non-existent');
			expect(result).toBe(false);
		});
	});

	describe('getAllIds', () => {
		it('should return all playlist IDs', async () => {
			await store.savePlaylist({ ...samplePlaylist, id: 'pl-1' });
			await store.savePlaylist({ ...samplePlaylist, id: 'pl-2' });

			const result = await store.getAllIds();

			expect(result).toHaveLength(2);
			expect(result).toContain('pl-1');
			expect(result).toContain('pl-2');
		});

		it('should return empty array when no playlists', async () => {
			const result = await store.getAllIds();
			expect(result).toEqual([]);
		});
	});

	describe('getCount', () => {
		it('should return playlist count', async () => {
			await store.savePlaylist({ ...samplePlaylist, id: 'pl-1' });
			await store.savePlaylist({ ...samplePlaylist, id: 'pl-2' });

			const result = await store.getCount();
			expect(result).toBe(2);
		});

		it('should return 0 when no playlists', async () => {
			const result = await store.getCount();
			expect(result).toBe(0);
		});
	});

	describe('clear', () => {
		it('should clear all playlists', async () => {
			await store.savePlaylist({ ...samplePlaylist, id: 'pl-1' });
			await store.savePlaylist({ ...samplePlaylist, id: 'pl-2' });

			await store.clear();

			const result = await store.load();
			expect(result).toEqual([]);
		});

		it('should not throw error when clearing empty store', async () => {
			await expect(store.clear()).resolves.not.toThrow();
		});
	});
});
