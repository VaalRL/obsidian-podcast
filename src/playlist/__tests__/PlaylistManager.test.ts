/**
 * Unit tests for PlaylistManager
 */

import { PlaylistManager } from '../PlaylistManager';
import { PlaylistStore } from '../PlaylistStore';
import { Playlist } from '../../model';

// Mock PlaylistStore
jest.mock('../PlaylistStore');

describe('PlaylistManager', () => {
	let playlistManager: PlaylistManager;
	let mockPlaylistStore: jest.Mocked<PlaylistStore>;

	beforeEach(() => {
		// Create mocked PlaylistStore
		mockPlaylistStore = {
			savePlaylist: jest.fn().mockResolvedValue(undefined),
			getPlaylist: jest.fn().mockResolvedValue(null),
			load: jest.fn().mockResolvedValue([]),
			deletePlaylist: jest.fn().mockResolvedValue(undefined),
			getCount: jest.fn().mockResolvedValue(0),
			exists: jest.fn().mockResolvedValue(false),
		} as any;

		playlistManager = new PlaylistManager(mockPlaylistStore);
	});

	describe('createPlaylist', () => {
		it('should create a new playlist with name only', async () => {
			const playlist = await playlistManager.createPlaylist('My Playlist');

			expect(playlist.name).toBe('My Playlist');
			expect(playlist.episodeIds).toEqual([]);
			expect(playlist.description).toBeUndefined();
			expect(playlist.imageUrl).toBeUndefined();
			expect(mockPlaylistStore.savePlaylist).toHaveBeenCalledWith(expect.objectContaining({
				name: 'My Playlist',
			}));
		});

		it('should create a playlist with name, description, and imageUrl', async () => {
			const playlist = await playlistManager.createPlaylist(
				'My Playlist',
				'A great playlist',
				'https://example.com/image.jpg'
			);

			expect(playlist.name).toBe('My Playlist');
			expect(playlist.description).toBe('A great playlist');
			expect(playlist.imageUrl).toBe('https://example.com/image.jpg');
		});

		it('should generate a unique ID for each playlist', async () => {
			const playlist1 = await playlistManager.createPlaylist('Playlist 1');
			const playlist2 = await playlistManager.createPlaylist('Playlist 2');

			expect(playlist1.id).not.toBe(playlist2.id);
		});
	});

	describe('getPlaylist', () => {
		it('should retrieve a playlist by ID', async () => {
			const testPlaylist: Playlist = {
				id: 'playlist-123',
				name: 'Test Playlist',
				episodeIds: ['ep1', 'ep2'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockResolvedValue(testPlaylist);

			const playlist = await playlistManager.getPlaylist('playlist-123');

			expect(playlist).toEqual(testPlaylist);
			expect(mockPlaylistStore.getPlaylist).toHaveBeenCalledWith('playlist-123');
		});

		it('should return null if playlist does not exist', async () => {
			mockPlaylistStore.getPlaylist.mockResolvedValue(null);

			const playlist = await playlistManager.getPlaylist('non-existent');

			expect(playlist).toBeNull();
		});
	});

	describe('getAllPlaylists', () => {
		it('should return all playlists sorted by updated date', async () => {
			const playlists: Playlist[] = [
				{
					id: 'playlist-1',
					name: 'Playlist 1',
					episodeIds: [],
					createdAt: new Date('2024-01-01'),
					updatedAt: new Date('2024-01-05'),
				},
				{
					id: 'playlist-2',
					name: 'Playlist 2',
					episodeIds: [],
					createdAt: new Date('2024-01-02'),
					updatedAt: new Date('2024-01-10'),
				},
			];

			mockPlaylistStore.load.mockResolvedValue(playlists);

			const result = await playlistManager.getAllPlaylists();

			expect(result[0].id).toBe('playlist-2'); // Most recent first
			expect(result[1].id).toBe('playlist-1');
		});
	});

	describe('updatePlaylist', () => {
		it('should update playlist metadata', async () => {
			const testPlaylist: Playlist = {
				id: 'playlist-123',
				name: 'Original Name',
				episodeIds: ['ep1'],
				createdAt: new Date('2024-01-01'),
				updatedAt: new Date('2024-01-01'),
			};

			mockPlaylistStore.getPlaylist.mockResolvedValue({ ...testPlaylist });

			await playlistManager.updatePlaylist('playlist-123', {
				name: 'Updated Name',
				description: 'New description',
			});

			expect(mockPlaylistStore.savePlaylist).toHaveBeenCalledWith(expect.objectContaining({
				id: 'playlist-123',
				name: 'Updated Name',
				description: 'New description',
				createdAt: testPlaylist.createdAt, // Preserved
			}));
		});

		it('should throw error if playlist does not exist', async () => {
			mockPlaylistStore.getPlaylist.mockResolvedValue(null);

			await expect(playlistManager.updatePlaylist('non-existent', { name: 'New Name' }))
				.rejects.toThrow('Playlist not found');
		});
	});

	describe('deletePlaylist', () => {
		it('should delete a playlist', async () => {
			await playlistManager.deletePlaylist('playlist-123');

			expect(mockPlaylistStore.deletePlaylist).toHaveBeenCalledWith('playlist-123');
		});
	});

	describe('addEpisode', () => {
		it('should add an episode to a playlist', async () => {
			const testPlaylist: Playlist = {
				id: 'playlist-123',
				name: 'Test Playlist',
				episodeIds: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockResolvedValue({ ...testPlaylist });

			await playlistManager.addEpisode('playlist-123', 'ep-456');

			expect(mockPlaylistStore.savePlaylist).toHaveBeenCalledWith(expect.objectContaining({
				episodeIds: ['ep-456'],
			}));
		});

		it('should not add duplicate episodes', async () => {
			const testPlaylist: Playlist = {
				id: 'playlist-123',
				name: 'Test Playlist',
				episodeIds: ['ep-456'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockResolvedValue({ ...testPlaylist });

			await playlistManager.addEpisode('playlist-123', 'ep-456');

			// Should not save since episode already exists
			expect(mockPlaylistStore.savePlaylist).not.toHaveBeenCalled();
		});

		it('should throw error if playlist does not exist', async () => {
			mockPlaylistStore.getPlaylist.mockResolvedValue(null);

			await expect(playlistManager.addEpisode('non-existent', 'ep-456')).rejects.toThrow();
		});
	});

	describe('addEpisodes', () => {
		it('should add multiple episodes to a playlist', async () => {
			const testPlaylist: Playlist = {
				id: 'playlist-123',
				name: 'Test Playlist',
				episodeIds: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockResolvedValue({ ...testPlaylist });

			await playlistManager.addEpisodes('playlist-123', ['ep1', 'ep2', 'ep3']);

			expect(mockPlaylistStore.savePlaylist).toHaveBeenCalledWith(expect.objectContaining({
				episodeIds: ['ep1', 'ep2', 'ep3'],
			}));
		});

		it('should only add new episodes', async () => {
			const testPlaylist: Playlist = {
				id: 'playlist-123',
				name: 'Test Playlist',
				episodeIds: ['ep1'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockResolvedValue({ ...testPlaylist });

			await playlistManager.addEpisodes('playlist-123', ['ep1', 'ep2', 'ep3']);

			expect(mockPlaylistStore.savePlaylist).toHaveBeenCalledWith(expect.objectContaining({
				episodeIds: ['ep1', 'ep2', 'ep3'], // ep1 not duplicated
			}));
		});

		it('should not save if no new episodes to add', async () => {
			const testPlaylist: Playlist = {
				id: 'playlist-123',
				name: 'Test Playlist',
				episodeIds: ['ep1', 'ep2'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockResolvedValue({ ...testPlaylist });

			await playlistManager.addEpisodes('playlist-123', ['ep1', 'ep2']);

			// Should not save since all episodes already exist
			expect(mockPlaylistStore.savePlaylist).not.toHaveBeenCalled();
		});
	});

	describe('removeEpisode', () => {
		it('should remove an episode from a playlist', async () => {
			const testPlaylist: Playlist = {
				id: 'playlist-123',
				name: 'Test Playlist',
				episodeIds: ['ep1', 'ep2', 'ep3'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockResolvedValue({ ...testPlaylist });

			await playlistManager.removeEpisode('playlist-123', 'ep2');

			expect(mockPlaylistStore.savePlaylist).toHaveBeenCalledWith(expect.objectContaining({
				episodeIds: ['ep1', 'ep3'],
			}));
		});

		it('should not save if episode not found in playlist', async () => {
			const testPlaylist: Playlist = {
				id: 'playlist-123',
				name: 'Test Playlist',
				episodeIds: ['ep1', 'ep2'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockResolvedValue({ ...testPlaylist });

			await playlistManager.removeEpisode('playlist-123', 'ep-nonexistent');

			expect(mockPlaylistStore.savePlaylist).not.toHaveBeenCalled();
		});
	});

	describe('removeEpisodes', () => {
		it('should remove multiple episodes from a playlist', async () => {
			const testPlaylist: Playlist = {
				id: 'playlist-123',
				name: 'Test Playlist',
				episodeIds: ['ep1', 'ep2', 'ep3', 'ep4'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockResolvedValue({ ...testPlaylist });

			await playlistManager.removeEpisodes('playlist-123', ['ep2', 'ep4']);

			expect(mockPlaylistStore.savePlaylist).toHaveBeenCalledWith(expect.objectContaining({
				episodeIds: ['ep1', 'ep3'],
			}));
		});
	});

	describe('reorderEpisodes', () => {
		it('should reorder episodes in a playlist', async () => {
			const testPlaylist: Playlist = {
				id: 'playlist-123',
				name: 'Test Playlist',
				episodeIds: ['ep1', 'ep2', 'ep3'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockResolvedValue({ ...testPlaylist });

			await playlistManager.reorderEpisodes('playlist-123', ['ep3', 'ep1', 'ep2']);

			expect(mockPlaylistStore.savePlaylist).toHaveBeenCalledWith(expect.objectContaining({
				episodeIds: ['ep3', 'ep1', 'ep2'],
			}));
		});

		it('should throw error if invalid episode IDs provided', async () => {
			const testPlaylist: Playlist = {
				id: 'playlist-123',
				name: 'Test Playlist',
				episodeIds: ['ep1', 'ep2'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockResolvedValue({ ...testPlaylist });

			await expect(playlistManager.reorderEpisodes('playlist-123', ['ep1', 'ep-invalid']))
				.rejects.toThrow('Invalid episode IDs');
		});
	});

	describe('moveEpisode', () => {
		it('should move an episode to a new position', async () => {
			const testPlaylist: Playlist = {
				id: 'playlist-123',
				name: 'Test Playlist',
				episodeIds: ['ep1', 'ep2', 'ep3', 'ep4'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockResolvedValue({ ...testPlaylist });

			await playlistManager.moveEpisode('playlist-123', 'ep2', 3);

			expect(mockPlaylistStore.savePlaylist).toHaveBeenCalledWith(expect.objectContaining({
				episodeIds: ['ep1', 'ep3', 'ep4', 'ep2'],
			}));
		});

		it('should throw error if episode not found', async () => {
			const testPlaylist: Playlist = {
				id: 'playlist-123',
				name: 'Test Playlist',
				episodeIds: ['ep1', 'ep2'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockResolvedValue({ ...testPlaylist });

			await expect(playlistManager.moveEpisode('playlist-123', 'ep-nonexistent', 0))
				.rejects.toThrow('Episode not found in playlist');
		});
	});

	describe('clearPlaylist', () => {
		it('should clear all episodes from a playlist', async () => {
			const testPlaylist: Playlist = {
				id: 'playlist-123',
				name: 'Test Playlist',
				episodeIds: ['ep1', 'ep2', 'ep3'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockResolvedValue({ ...testPlaylist });

			await playlistManager.clearPlaylist('playlist-123');

			expect(mockPlaylistStore.savePlaylist).toHaveBeenCalledWith(expect.objectContaining({
				episodeIds: [],
			}));
		});
	});

	describe('getEpisodeCount', () => {
		it('should return the number of episodes in a playlist', async () => {
			const testPlaylist: Playlist = {
				id: 'playlist-123',
				name: 'Test Playlist',
				episodeIds: ['ep1', 'ep2', 'ep3'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockResolvedValue(testPlaylist);

			const count = await playlistManager.getEpisodeCount('playlist-123');

			expect(count).toBe(3);
		});

		it('should return 0 if playlist does not exist', async () => {
			mockPlaylistStore.getPlaylist.mockResolvedValue(null);

			const count = await playlistManager.getEpisodeCount('non-existent');

			expect(count).toBe(0);
		});
	});

	describe('hasEpisode', () => {
		it('should return true if episode is in playlist', async () => {
			const testPlaylist: Playlist = {
				id: 'playlist-123',
				name: 'Test Playlist',
				episodeIds: ['ep1', 'ep2'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockResolvedValue(testPlaylist);

			const hasEpisode = await playlistManager.hasEpisode('playlist-123', 'ep1');

			expect(hasEpisode).toBe(true);
		});

		it('should return false if episode is not in playlist', async () => {
			const testPlaylist: Playlist = {
				id: 'playlist-123',
				name: 'Test Playlist',
				episodeIds: ['ep1', 'ep2'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockResolvedValue(testPlaylist);

			const hasEpisode = await playlistManager.hasEpisode('playlist-123', 'ep-nonexistent');

			expect(hasEpisode).toBe(false);
		});
	});

	describe('searchPlaylists', () => {
		it('should search playlists by name', async () => {
			const playlists: Playlist[] = [
				{
					id: 'playlist-1',
					name: 'Tech Talks',
					episodeIds: [],
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				{
					id: 'playlist-2',
					name: 'Music Mix',
					episodeIds: [],
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			];

			mockPlaylistStore.load.mockResolvedValue(playlists);

			const results = await playlistManager.searchPlaylists('Tech');

			expect(results).toHaveLength(1);
			expect(results[0].name).toBe('Tech Talks');
		});

		it('should search playlists by description', async () => {
			const playlists: Playlist[] = [
				{
					id: 'playlist-1',
					name: 'Playlist 1',
					description: 'Tech podcasts',
					episodeIds: [],
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				{
					id: 'playlist-2',
					name: 'Playlist 2',
					description: 'Music shows',
					episodeIds: [],
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			];

			mockPlaylistStore.load.mockResolvedValue(playlists);

			const results = await playlistManager.searchPlaylists('Tech');

			expect(results).toHaveLength(1);
			expect(results[0].id).toBe('playlist-1');
		});

		it('should be case insensitive', async () => {
			const playlists: Playlist[] = [
				{
					id: 'playlist-1',
					name: 'TECH TALKS',
					episodeIds: [],
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			];

			mockPlaylistStore.load.mockResolvedValue(playlists);

			const results = await playlistManager.searchPlaylists('tech');

			expect(results).toHaveLength(1);
		});
	});

	describe('duplicatePlaylist', () => {
		it('should duplicate a playlist', async () => {
			const testPlaylist: Playlist = {
				id: 'playlist-123',
				name: 'Original',
				description: 'Original description',
				episodeIds: ['ep1', 'ep2'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockResolvedValue(testPlaylist);

			const duplicate = await playlistManager.duplicatePlaylist('playlist-123');

			expect(duplicate.name).toBe('Original (Copy)');
			expect(duplicate.description).toBe('Original description');
			expect(duplicate.episodeIds).toEqual(['ep1', 'ep2']);
			expect(duplicate.id).not.toBe('playlist-123');
		});

		it('should duplicate with custom name', async () => {
			const testPlaylist: Playlist = {
				id: 'playlist-123',
				name: 'Original',
				episodeIds: ['ep1'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockResolvedValue(testPlaylist);

			const duplicate = await playlistManager.duplicatePlaylist('playlist-123', 'Custom Name');

			expect(duplicate.name).toBe('Custom Name');
		});

		it('should throw error if source playlist does not exist', async () => {
			mockPlaylistStore.getPlaylist.mockResolvedValue(null);

			await expect(playlistManager.duplicatePlaylist('non-existent'))
				.rejects.toThrow('Playlist not found');
		});
	});

	describe('mergePlaylists', () => {
		it('should merge multiple playlists', async () => {
			const playlist1: Playlist = {
				id: 'playlist-1',
				name: 'Playlist 1',
				episodeIds: ['ep1', 'ep2'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const playlist2: Playlist = {
				id: 'playlist-2',
				name: 'Playlist 2',
				episodeIds: ['ep3', 'ep4'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockImplementation(async (id: string) => {
				if (id === 'playlist-1') return playlist1;
				if (id === 'playlist-2') return playlist2;
				return null;
			});

			const merged = await playlistManager.mergePlaylists(['playlist-1', 'playlist-2'], 'Merged');

			expect(merged.name).toBe('Merged');
			expect(merged.episodeIds).toEqual(['ep1', 'ep2', 'ep3', 'ep4']);
		});

		it('should remove duplicate episodes when merging', async () => {
			const playlist1: Playlist = {
				id: 'playlist-1',
				name: 'Playlist 1',
				episodeIds: ['ep1', 'ep2'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const playlist2: Playlist = {
				id: 'playlist-2',
				name: 'Playlist 2',
				episodeIds: ['ep2', 'ep3'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockImplementation(async (id: string) => {
				if (id === 'playlist-1') return playlist1;
				if (id === 'playlist-2') return playlist2;
				return null;
			});

			const merged = await playlistManager.mergePlaylists(['playlist-1', 'playlist-2'], 'Merged');

			expect(merged.episodeIds).toEqual(['ep1', 'ep2', 'ep3']);
		});
	});

	describe('importPlaylist', () => {
		it('should import a playlist', async () => {
			const importData: Playlist = {
				id: 'imported-playlist',
				name: 'Imported',
				episodeIds: ['ep1'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.exists.mockResolvedValue(false);

			const imported = await playlistManager.importPlaylist(importData);

			expect(imported.id).toBe('imported-playlist');
			expect(mockPlaylistStore.savePlaylist).toHaveBeenCalledWith(importData);
		});

		it('should generate new ID if playlist ID already exists', async () => {
			const importData: Playlist = {
				id: 'existing-id',
				name: 'Imported',
				episodeIds: ['ep1'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.exists.mockResolvedValue(true);

			const imported = await playlistManager.importPlaylist(importData);

			expect(imported.id).not.toBe('existing-id');
			expect(mockPlaylistStore.savePlaylist).toHaveBeenCalled();
		});
	});

	describe('exportPlaylist', () => {
		it('should export a playlist', async () => {
			const testPlaylist: Playlist = {
				id: 'playlist-123',
				name: 'Export Test',
				episodeIds: ['ep1', 'ep2'],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPlaylistStore.getPlaylist.mockResolvedValue(testPlaylist);

			const exported = await playlistManager.exportPlaylist('playlist-123');

			expect(exported).toEqual(testPlaylist);
		});

		it('should throw error if playlist does not exist', async () => {
			mockPlaylistStore.getPlaylist.mockResolvedValue(null);

			await expect(playlistManager.exportPlaylist('non-existent'))
				.rejects.toThrow('Playlist not found');
		});
	});
});
