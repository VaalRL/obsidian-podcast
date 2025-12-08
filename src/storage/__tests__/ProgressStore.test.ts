/**
 * Unit tests for ProgressStore
 */

import { ProgressStore, ProgressData } from '../ProgressStore';
import { MockVault } from '../../../__mocks__/obsidian';
import { DataPathManager } from '../DataPathManager';
import { PlayProgress } from '../../model';

describe('ProgressStore', () => {
	let vault: MockVault;
	let pathManager: DataPathManager;
	let progressStore: ProgressStore;

	beforeEach(() => {
		vault = new MockVault();
		pathManager = new DataPathManager(vault as any, '.obsidian/plugins/podcast-player/data');
		progressStore = new ProgressStore(vault as any, pathManager);
	});

	describe('getProgress', () => {
		it('should return null when no progress exists for episode', async () => {
			vault.adapter.exists = jest.fn().mockResolvedValue(false);

			const progress = await progressStore.getProgress('ep-123');

			expect(progress).toBeNull();
		});

		it('should return progress for a specific episode', async () => {
			const testProgress: PlayProgress = {
				episodeId: 'ep-123',
				podcastId: 'podcast-456',
				position: 100,
				duration: 200,
				lastPlayedAt: new Date(),
				completed: false,
			};

			const data: ProgressData = {
				progress: [testProgress],
				version: 1,
			};

			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify(data));

			const progress = await progressStore.getProgress('ep-123');

			expect(progress).toMatchObject({
				episodeId: 'ep-123',
				position: 100,
				duration: 200,
			});
		});
	});

	describe('getPodcastProgress', () => {
		it('should return all progress for a podcast', async () => {
			const data: ProgressData = {
				progress: [
					{
						episodeId: 'ep-1',
						podcastId: 'podcast-123',
						position: 50,
						duration: 100,
						lastPlayedAt: new Date(),
						completed: false,
					},
					{
						episodeId: 'ep-2',
						podcastId: 'podcast-123',
						position: 80,
						duration: 100,
						lastPlayedAt: new Date(),
						completed: false,
					},
					{
						episodeId: 'ep-3',
						podcastId: 'podcast-456',
						position: 30,
						duration: 100,
						lastPlayedAt: new Date(),
						completed: false,
					},
				],
				version: 1,
			};

			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify(data));

			const podcastProgress = await progressStore.getPodcastProgress('podcast-123');

			expect(podcastProgress).toHaveLength(2);
			expect(podcastProgress.every(p => p.podcastId === 'podcast-123')).toBe(true);
		});
	});

	describe('getAllProgress', () => {
		it('should return all progress entries', async () => {
			const data: ProgressData = {
				progress: [
					{
						episodeId: 'ep-1',
						podcastId: 'podcast-1',
						position: 50,
						duration: 100,
						lastPlayedAt: new Date(),
						completed: false,
					},
					{
						episodeId: 'ep-2',
						podcastId: 'podcast-2',
						position: 80,
						duration: 100,
						lastPlayedAt: new Date(),
						completed: false,
					},
				],
				version: 1,
			};

			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify(data));

			const allProgress = await progressStore.getAllProgress();

			expect(allProgress).toHaveLength(2);
		});
	});

	describe('updateProgress', () => {
		it('should add new progress', async () => {
			const mockWrite = jest.fn().mockResolvedValue(undefined);
			vault.adapter.exists = jest.fn().mockResolvedValue(false);
			vault.adapter.write = mockWrite;
			vault.adapter.mkdir = jest.fn().mockResolvedValue(undefined);

			const newProgress: PlayProgress = {
				episodeId: 'ep-123',
				podcastId: 'podcast-456',
				position: 50,
				duration: 200,
				lastPlayedAt: new Date(),
				completed: false,
			};

			await progressStore.updateProgress(newProgress);

			expect(mockWrite).toHaveBeenCalled();
			const writeCall = mockWrite.mock.calls[mockWrite.mock.calls.length - 1];
			const savedData = JSON.parse(writeCall[1]);
			expect(savedData.progress).toHaveLength(1);
			expect(savedData.progress[0].episodeId).toBe('ep-123');
		});

		it('should update existing progress', async () => {
			const existingProgress: PlayProgress = {
				episodeId: 'ep-123',
				podcastId: 'podcast-456',
				position: 50,
				duration: 200,
				lastPlayedAt: new Date(),
				completed: false,
			};

			const data: ProgressData = {
				progress: [existingProgress],
				version: 1,
			};

			const mockWrite = jest.fn().mockResolvedValue(undefined);
			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify(data));
			vault.adapter.write = mockWrite;
			vault.adapter.mkdir = jest.fn().mockResolvedValue(undefined);

			const updatedProgress: PlayProgress = {
				...existingProgress,
				position: 100,
			};

			await progressStore.updateProgress(updatedProgress);

			expect(mockWrite).toHaveBeenCalled();
			const writeCall = mockWrite.mock.calls[mockWrite.mock.calls.length - 1];
			const savedData = JSON.parse(writeCall[1]);
			expect(savedData.progress).toHaveLength(1);
			expect(savedData.progress[0].position).toBe(100);
		});
	});

	describe('updatePosition', () => {
		it('should update playback position', async () => {
			const mockWrite = jest.fn().mockResolvedValue(undefined);
			vault.adapter.exists = jest.fn().mockResolvedValue(false);
			vault.adapter.write = mockWrite;
			vault.adapter.mkdir = jest.fn().mockResolvedValue(undefined);

			await progressStore.updatePosition('ep-123', 'podcast-456', 75, 200);

			expect(mockWrite).toHaveBeenCalled();
			const writeCall = mockWrite.mock.calls[mockWrite.mock.calls.length - 1];
			const savedData = JSON.parse(writeCall[1]);
			expect(savedData.progress[0].position).toBe(75);
			expect(savedData.progress[0].duration).toBe(200);
		});
	});

	describe('markCompleted', () => {
		it('should mark episode as completed', async () => {
			const mockWrite = jest.fn().mockResolvedValue(undefined);
			vault.adapter.exists = jest.fn().mockResolvedValue(false);
			vault.adapter.write = mockWrite;
			vault.adapter.mkdir = jest.fn().mockResolvedValue(undefined);

			await progressStore.markCompleted('ep-123', 'podcast-456', 200);

			expect(mockWrite).toHaveBeenCalled();
			const writeCall = mockWrite.mock.calls[mockWrite.mock.calls.length - 1];
			const savedData = JSON.parse(writeCall[1]);
			expect(savedData.progress[0].completed).toBe(true);
			expect(savedData.progress[0].position).toBe(200);
		});
	});

	describe('resetProgress', () => {
		it('should remove progress for an episode', async () => {
			const data: ProgressData = {
				progress: [
					{
						episodeId: 'ep-123',
						podcastId: 'podcast-456',
						position: 50,
						duration: 200,
						lastPlayedAt: new Date(),
						completed: false,
					},
				],
				version: 1,
			};

			const mockWrite = jest.fn().mockResolvedValue(undefined);
			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify(data));
			vault.adapter.write = mockWrite;
			vault.adapter.mkdir = jest.fn().mockResolvedValue(undefined);

			await progressStore.resetProgress('ep-123');

			expect(mockWrite).toHaveBeenCalled();
			const writeCall = mockWrite.mock.calls[mockWrite.mock.calls.length - 1];
			const savedData = JSON.parse(writeCall[1]);
			expect(savedData.progress).toHaveLength(0);
		});

		it('should do nothing if episode has no progress', async () => {
			const data: ProgressData = {
				progress: [],
				version: 1,
			};

			const mockWrite = jest.fn().mockResolvedValue(undefined);
			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify(data));
			vault.adapter.write = mockWrite;

			await progressStore.resetProgress('ep-nonexistent');

			// Should not write since nothing changed
			expect(mockWrite).not.toHaveBeenCalled();
		});
	});

	describe('removePodcastProgress', () => {
		it('should remove all progress for a podcast', async () => {
			const data: ProgressData = {
				progress: [
					{
						episodeId: 'ep-1',
						podcastId: 'podcast-123',
						position: 50,
						duration: 100,
						lastPlayedAt: new Date(),
						completed: false,
					},
					{
						episodeId: 'ep-2',
						podcastId: 'podcast-123',
						position: 80,
						duration: 100,
						lastPlayedAt: new Date(),
						completed: false,
					},
					{
						episodeId: 'ep-3',
						podcastId: 'podcast-456',
						position: 30,
						duration: 100,
						lastPlayedAt: new Date(),
						completed: false,
					},
				],
				version: 1,
			};

			const mockWrite = jest.fn().mockResolvedValue(undefined);
			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify(data));
			vault.adapter.write = mockWrite;
			vault.adapter.mkdir = jest.fn().mockResolvedValue(undefined);

			await progressStore.removePodcastProgress('podcast-123');

			expect(mockWrite).toHaveBeenCalled();
			const writeCall = mockWrite.mock.calls[mockWrite.mock.calls.length - 1];
			const savedData = JSON.parse(writeCall[1]);
			expect(savedData.progress).toHaveLength(1);
			expect(savedData.progress[0].podcastId).toBe('podcast-456');
		});
	});

	describe('getInProgressEpisodes', () => {
		it('should return episodes that are started but not completed', async () => {
			const data: ProgressData = {
				progress: [
					{
						episodeId: 'ep-1',
						podcastId: 'podcast-1',
						position: 50,
						duration: 100,
						lastPlayedAt: new Date(),
						completed: false,
					},
					{
						episodeId: 'ep-2',
						podcastId: 'podcast-1',
						position: 0,
						duration: 100,
						lastPlayedAt: new Date(),
						completed: false,
					},
					{
						episodeId: 'ep-3',
						podcastId: 'podcast-1',
						position: 100,
						duration: 100,
						lastPlayedAt: new Date(),
						completed: true,
					},
				],
				version: 1,
			};

			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify(data));

			const inProgress = await progressStore.getInProgressEpisodes();

			expect(inProgress).toHaveLength(1);
			expect(inProgress[0].episodeId).toBe('ep-1');
		});
	});

	describe('getCompletedEpisodes', () => {
		it('should return completed episodes', async () => {
			const data: ProgressData = {
				progress: [
					{
						episodeId: 'ep-1',
						podcastId: 'podcast-1',
						position: 50,
						duration: 100,
						lastPlayedAt: new Date(),
						completed: false,
					},
					{
						episodeId: 'ep-2',
						podcastId: 'podcast-1',
						position: 100,
						duration: 100,
						lastPlayedAt: new Date(),
						completed: true,
					},
				],
				version: 1,
			};

			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify(data));

			const completed = await progressStore.getCompletedEpisodes();

			expect(completed).toHaveLength(1);
			expect(completed[0].episodeId).toBe('ep-2');
		});
	});

	describe('getRecentlyPlayed', () => {
		it('should return recently played episodes', async () => {
			const data: ProgressData = {
				progress: [
					{
						episodeId: 'ep-1',
						podcastId: 'podcast-1',
						position: 50,
						duration: 100,
						lastPlayedAt: new Date('2024-01-01'),
						completed: false,
					},
					{
						episodeId: 'ep-2',
						podcastId: 'podcast-1',
						position: 80,
						duration: 100,
						lastPlayedAt: new Date('2024-01-05'),
						completed: false,
					},
					{
						episodeId: 'ep-3',
						podcastId: 'podcast-1',
						position: 30,
						duration: 100,
						lastPlayedAt: new Date('2024-01-03'),
						completed: false,
					},
				],
				version: 1,
			};

			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify(data));

			const recent = await progressStore.getRecentlyPlayed(2);

			expect(recent).toHaveLength(2);
			expect(recent[0].episodeId).toBe('ep-2'); // Most recent
			expect(recent[1].episodeId).toBe('ep-3');
		});
	});

	describe('getCompletionPercentage', () => {
		it('should return completion percentage', async () => {
			const data: ProgressData = {
				progress: [
					{
						episodeId: 'ep-123',
						podcastId: 'podcast-456',
						position: 50,
						duration: 200,
						lastPlayedAt: new Date(),
						completed: false,
					},
				],
				version: 1,
			};

			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify(data));

			const percentage = await progressStore.getCompletionPercentage('ep-123');

			expect(percentage).toBe(25); // 50/200 * 100
		});

		it('should return 0 if no progress exists', async () => {
			vault.adapter.exists = jest.fn().mockResolvedValue(false);

			const percentage = await progressStore.getCompletionPercentage('ep-nonexistent');

			expect(percentage).toBe(0);
		});
	});

	describe('getTotalListeningTime', () => {
		it('should return total listening time in seconds', async () => {
			const data: ProgressData = {
				progress: [
					{
						episodeId: 'ep-1',
						podcastId: 'podcast-1',
						position: 100,
						duration: 200,
						lastPlayedAt: new Date(),
						completed: false,
					},
					{
						episodeId: 'ep-2',
						podcastId: 'podcast-1',
						position: 150,
						duration: 200,
						lastPlayedAt: new Date(),
						completed: false,
					},
				],
				version: 1,
			};

			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify(data));

			const totalTime = await progressStore.getTotalListeningTime();

			expect(totalTime).toBe(250); // 100 + 150
		});
	});

	describe('getPodcastStatistics', () => {
		it('should return podcast statistics', async () => {
			const data: ProgressData = {
				progress: [
					{
						episodeId: 'ep-1',
						podcastId: 'podcast-123',
						position: 100,
						duration: 100,
						lastPlayedAt: new Date(),
						completed: true,
					},
					{
						episodeId: 'ep-2',
						podcastId: 'podcast-123',
						position: 50,
						duration: 100,
						lastPlayedAt: new Date(),
						completed: false,
					},
					{
						episodeId: 'ep-3',
						podcastId: 'podcast-456',
						position: 30,
						duration: 100,
						lastPlayedAt: new Date(),
						completed: false,
					},
				],
				version: 1,
			};

			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify(data));

			const stats = await progressStore.getPodcastStatistics('podcast-123');

			expect(stats.totalEpisodes).toBe(2);
			expect(stats.completedEpisodes).toBe(1);
			expect(stats.inProgressEpisodes).toBe(1);
			expect(stats.totalListeningTime).toBe(150); // 100 + 50
		});
	});

	describe('cleanupOldProgress', () => {
		it('should keep only recent N progress entries', async () => {
			const data: ProgressData = {
				progress: [
					{
						episodeId: 'ep-1',
						podcastId: 'podcast-1',
						position: 50,
						duration: 100,
						lastPlayedAt: new Date('2024-01-01'),
						completed: false,
					},
					{
						episodeId: 'ep-2',
						podcastId: 'podcast-1',
						position: 80,
						duration: 100,
						lastPlayedAt: new Date('2024-01-05'),
						completed: false,
					},
					{
						episodeId: 'ep-3',
						podcastId: 'podcast-1',
						position: 30,
						duration: 100,
						lastPlayedAt: new Date('2024-01-03'),
						completed: false,
					},
				],
				version: 1,
			};

			const mockWrite = jest.fn().mockResolvedValue(undefined);
			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify(data));
			vault.adapter.write = mockWrite;
			vault.adapter.mkdir = jest.fn().mockResolvedValue(undefined);

			await progressStore.cleanupOldProgress(2);

			expect(mockWrite).toHaveBeenCalled();
			const writeCall = mockWrite.mock.calls[mockWrite.mock.calls.length - 1];
			const savedData = JSON.parse(writeCall[1]);
			expect(savedData.progress).toHaveLength(2);
			// Should keep the 2 most recent
			expect(savedData.progress[0].episodeId).toBe('ep-2');
			expect(savedData.progress[1].episodeId).toBe('ep-3');
		});
	});

	describe('importProgress', () => {
		it('should replace all progress when replace=true', async () => {
			const existingData: ProgressData = {
				progress: [
					{
						episodeId: 'ep-old',
						podcastId: 'podcast-1',
						position: 50,
						duration: 100,
						lastPlayedAt: new Date(),
						completed: false,
					},
				],
				version: 1,
			};

			const importData: ProgressData = {
				progress: [
					{
						episodeId: 'ep-new',
						podcastId: 'podcast-2',
						position: 80,
						duration: 100,
						lastPlayedAt: new Date(),
						completed: false,
					},
				],
				version: 1,
			};

			const mockWrite = jest.fn().mockResolvedValue(undefined);
			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify(existingData));
			vault.adapter.write = mockWrite;
			vault.adapter.mkdir = jest.fn().mockResolvedValue(undefined);

			await progressStore.importProgress(importData, true);

			expect(mockWrite).toHaveBeenCalled();
			const writeCall = mockWrite.mock.calls[mockWrite.mock.calls.length - 1];
			const savedData = JSON.parse(writeCall[1]);
			expect(savedData.progress).toHaveLength(1);
			expect(savedData.progress[0].episodeId).toBe('ep-new');
		});

		it('should merge progress when replace=false', async () => {
			const existingData: ProgressData = {
				progress: [
					{
						episodeId: 'ep-1',
						podcastId: 'podcast-1',
						position: 50,
						duration: 100,
						lastPlayedAt: new Date('2024-01-01'),
						completed: false,
					},
				],
				version: 1,
			};

			const importData: ProgressData = {
				progress: [
					{
						episodeId: 'ep-2',
						podcastId: 'podcast-2',
						position: 80,
						duration: 100,
						lastPlayedAt: new Date('2024-01-05'),
						completed: false,
					},
				],
				version: 1,
			};

			const mockWrite = jest.fn().mockResolvedValue(undefined);
			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify(existingData));
			vault.adapter.write = mockWrite;
			vault.adapter.mkdir = jest.fn().mockResolvedValue(undefined);

			await progressStore.importProgress(importData, false);

			expect(mockWrite).toHaveBeenCalled();
			const writeCall = mockWrite.mock.calls[mockWrite.mock.calls.length - 1];
			const savedData = JSON.parse(writeCall[1]);
			expect(savedData.progress).toHaveLength(2);
		});

		it('should keep more recent progress when merging duplicates', async () => {
			const existingData: ProgressData = {
				progress: [
					{
						episodeId: 'ep-1',
						podcastId: 'podcast-1',
						position: 50,
						duration: 100,
						lastPlayedAt: new Date('2024-01-01'),
						completed: false,
					},
				],
				version: 1,
			};

			const importData: ProgressData = {
				progress: [
					{
						episodeId: 'ep-1',
						podcastId: 'podcast-1',
						position: 80,
						duration: 100,
						lastPlayedAt: new Date('2024-01-10'),
						completed: false,
					},
				],
				version: 1,
			};

			const mockWrite = jest.fn().mockResolvedValue(undefined);
			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify(existingData));
			vault.adapter.write = mockWrite;
			vault.adapter.mkdir = jest.fn().mockResolvedValue(undefined);

			await progressStore.importProgress(importData, false);

			expect(mockWrite).toHaveBeenCalled();
			const writeCall = mockWrite.mock.calls[mockWrite.mock.calls.length - 1];
			const savedData = JSON.parse(writeCall[1]);
			expect(savedData.progress).toHaveLength(1);
			expect(savedData.progress[0].position).toBe(80); // Imported (more recent)
		});
	});

	describe('exportProgress', () => {
		it('should export all progress data', async () => {
			const data: ProgressData = {
				progress: [
					{
						episodeId: 'ep-1',
						podcastId: 'podcast-1',
						position: 50,
						duration: 100,
						lastPlayedAt: new Date(),
						completed: false,
					},
				],
				version: 1,
			};

			vault.adapter.exists = jest.fn().mockResolvedValue(true);
			vault.adapter.read = jest.fn().mockResolvedValue(JSON.stringify(data));

			const exported = await progressStore.exportProgress();

			expect(exported.progress).toHaveLength(1);
			expect(exported.version).toBe(1);
		});
	});
});
