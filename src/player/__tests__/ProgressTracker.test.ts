/**
 * Unit tests for ProgressTracker
 */

import { ProgressTracker, ProgressTrackingOptions } from '../ProgressTracker';
import { ProgressStore } from '../../storage/ProgressStore';
import { Episode, PlayProgress } from '../../model';

// Mock ProgressStore
jest.mock('../../storage/ProgressStore');

// Mock window.setInterval and clearInterval
jest.useFakeTimers();

// Mock window object for timer functions
global.window = {
	setInterval: jest.fn((callback, delay) => setInterval(callback, delay)),
	clearInterval: jest.fn((id) => clearInterval(id)),
} as any;

describe('ProgressTracker', () => {
	let progressTracker: ProgressTracker;
	let mockProgressStore: jest.Mocked<ProgressStore>;

	const testEpisode: Episode = {
		id: 'ep-123',
		podcastId: 'podcast-456',
		title: 'Test Episode',
		description: 'Test Description',
		audioUrl: 'https://example.com/audio.mp3',
		duration: 3600,
		publishDate: new Date('2024-01-01'),
	};

	beforeEach(() => {
		// Create mocked ProgressStore
		mockProgressStore = {
			getProgress: jest.fn().mockResolvedValue(null),
			updateProgress: jest.fn().mockResolvedValue(undefined),
			markCompleted: jest.fn().mockResolvedValue(undefined),
			resetProgress: jest.fn().mockResolvedValue(undefined),
		} as any;

		progressTracker = new ProgressTracker(mockProgressStore);
	});

	afterEach(() => {
		jest.clearAllTimers();
	});

	describe('constructor', () => {
		it('should initialize with default options', () => {
			expect(progressTracker).toBeDefined();
			expect(progressTracker.isCurrentlyTracking()).toBe(false);
			expect(progressTracker.getCurrentEpisode()).toBeNull();
		});

		it('should accept custom options', () => {
			const options: ProgressTrackingOptions = {
				saveInterval: 10000,
				minPositionChange: 5,
				completionThreshold: 60,
			};

			const tracker = new ProgressTracker(mockProgressStore, options);

			expect(tracker).toBeDefined();
		});
	});

	describe('startTracking', () => {
		it('should start tracking an episode', async () => {
			await progressTracker.startTracking(testEpisode);

			expect(progressTracker.isCurrentlyTracking()).toBe(true);
			expect(progressTracker.getCurrentEpisode()).toEqual(testEpisode);
			expect(mockProgressStore.getProgress).toHaveBeenCalledWith(testEpisode.id);
		});

		it('should load existing progress when available', async () => {
			const existingProgress: PlayProgress = {
				episodeId: testEpisode.id,
				podcastId: testEpisode.podcastId,
				position: 120,
				duration: testEpisode.duration,
				lastPlayedAt: new Date(),
				completed: false,
			};

			mockProgressStore.getProgress.mockResolvedValue(existingProgress);

			await progressTracker.startTracking(testEpisode);

			expect(progressTracker.getLastSavedPosition()).toBe(120);
		});

		it('should initialize position to 0 when no existing progress', async () => {
			mockProgressStore.getProgress.mockResolvedValue(null);

			await progressTracker.startTracking(testEpisode);

			expect(progressTracker.getLastSavedPosition()).toBe(0);
		});

		it('should stop tracking previous episode before starting new one', async () => {
			await progressTracker.startTracking(testEpisode);

			const newEpisode = { ...testEpisode, id: 'ep-456' };
			await progressTracker.startTracking(newEpisode);

			expect(progressTracker.getCurrentEpisode()).toEqual(newEpisode);
		});

		it('should start periodic save timer', async () => {
			await progressTracker.startTracking(testEpisode);

			expect(jest.getTimerCount()).toBeGreaterThan(0);
		});
	});

	describe('stopTracking', () => {
		it('should stop tracking and save progress', async () => {
			await progressTracker.startTracking(testEpisode);
			progressTracker.updatePosition(150);

			await progressTracker.stopTracking(true);

			expect(progressTracker.isCurrentlyTracking()).toBe(false);
			expect(progressTracker.getCurrentEpisode()).toBeNull();
			expect(mockProgressStore.updateProgress).toHaveBeenCalled();
		});

		it('should stop tracking without saving when requested', async () => {
			await progressTracker.startTracking(testEpisode);
			progressTracker.updatePosition(150);

			mockProgressStore.updateProgress.mockClear();
			await progressTracker.stopTracking(false);

			expect(progressTracker.isCurrentlyTracking()).toBe(false);
			expect(mockProgressStore.updateProgress).not.toHaveBeenCalled();
		});

		it('should clear periodic save timer', async () => {
			await progressTracker.startTracking(testEpisode);
			const timerCount = jest.getTimerCount();

			await progressTracker.stopTracking();

			expect(jest.getTimerCount()).toBeLessThan(timerCount);
		});

		it('should do nothing if not tracking', async () => {
			await progressTracker.stopTracking();

			expect(mockProgressStore.updateProgress).not.toHaveBeenCalled();
		});
	});

	describe('updatePosition', () => {
		it('should update current position', async () => {
			await progressTracker.startTracking(testEpisode);

			progressTracker.updatePosition(100);
			expect(progressTracker.getLastSavedPosition()).toBe(100);

			progressTracker.updatePosition(200);
			expect(progressTracker.getLastSavedPosition()).toBe(200);
		});

		it('should do nothing if not tracking', () => {
			progressTracker.updatePosition(100);

			expect(progressTracker.getLastSavedPosition()).toBe(0);
		});
	});

	describe('forceSave', () => {
		it('should save progress immediately', async () => {
			await progressTracker.startTracking(testEpisode);
			progressTracker.updatePosition(150);

			await progressTracker.forceSave();

			expect(mockProgressStore.updateProgress).toHaveBeenCalledWith(
				expect.objectContaining({
					episodeId: testEpisode.id,
					position: 150,
				})
			);
		});

		it('should save custom position if provided', async () => {
			await progressTracker.startTracking(testEpisode);
			progressTracker.updatePosition(150);

			await progressTracker.forceSave(200);

			expect(mockProgressStore.updateProgress).toHaveBeenCalledWith(
				expect.objectContaining({
					position: 200,
				})
			);
		});

		it('should do nothing if no episode is being tracked', async () => {
			await progressTracker.forceSave(100);

			expect(mockProgressStore.updateProgress).not.toHaveBeenCalled();
		});
	});

	describe('markCompleted', () => {
		it('should mark episode as completed', async () => {
			await progressTracker.startTracking(testEpisode);

			await progressTracker.markCompleted();

			expect(mockProgressStore.markCompleted).toHaveBeenCalledWith(
				testEpisode.id,
				testEpisode.podcastId,
				testEpisode.duration
			);
		});

		it('should do nothing if no episode is being tracked', async () => {
			await progressTracker.markCompleted();

			expect(mockProgressStore.markCompleted).not.toHaveBeenCalled();
		});
	});

	describe('getResumePosition', () => {
		it('should return saved position for incomplete episode', async () => {
			const progress: PlayProgress = {
				episodeId: 'ep-123',
				podcastId: 'podcast-456',
				position: 250,
				duration: 3600,
				lastPlayedAt: new Date(),
				completed: false,
			};

			mockProgressStore.getProgress.mockResolvedValue(progress);

			const resumePosition = await progressTracker.getResumePosition('ep-123');

			expect(resumePosition).toBe(250);
		});

		it('should return 0 for completed episode', async () => {
			const progress: PlayProgress = {
				episodeId: 'ep-123',
				podcastId: 'podcast-456',
				position: 3600,
				duration: 3600,
				lastPlayedAt: new Date(),
				completed: true,
			};

			mockProgressStore.getProgress.mockResolvedValue(progress);

			const resumePosition = await progressTracker.getResumePosition('ep-123');

			expect(resumePosition).toBe(0);
		});

		it('should return 0 if no progress exists', async () => {
			mockProgressStore.getProgress.mockResolvedValue(null);

			const resumePosition = await progressTracker.getResumePosition('ep-123');

			expect(resumePosition).toBe(0);
		});
	});

	describe('shouldResume', () => {
		it('should return true if position is above minimum', async () => {
			const progress: PlayProgress = {
				episodeId: 'ep-123',
				podcastId: 'podcast-456',
				position: 50,
				duration: 3600,
				lastPlayedAt: new Date(),
				completed: false,
			};

			mockProgressStore.getProgress.mockResolvedValue(progress);

			const shouldResume = await progressTracker.shouldResume('ep-123', 10);

			expect(shouldResume).toBe(true);
		});

		it('should return false if position is below minimum', async () => {
			const progress: PlayProgress = {
				episodeId: 'ep-123',
				podcastId: 'podcast-456',
				position: 5,
				duration: 3600,
				lastPlayedAt: new Date(),
				completed: false,
			};

			mockProgressStore.getProgress.mockResolvedValue(progress);

			const shouldResume = await progressTracker.shouldResume('ep-123', 10);

			expect(shouldResume).toBe(false);
		});

		it('should return false if episode is completed', async () => {
			const progress: PlayProgress = {
				episodeId: 'ep-123',
				podcastId: 'podcast-456',
				position: 3600,
				duration: 3600,
				lastPlayedAt: new Date(),
				completed: true,
			};

			mockProgressStore.getProgress.mockResolvedValue(progress);

			const shouldResume = await progressTracker.shouldResume('ep-123');

			expect(shouldResume).toBe(false);
		});

		it('should use default minimum position of 10 seconds', async () => {
			const progress: PlayProgress = {
				episodeId: 'ep-123',
				podcastId: 'podcast-456',
				position: 15,
				duration: 3600,
				lastPlayedAt: new Date(),
				completed: false,
			};

			mockProgressStore.getProgress.mockResolvedValue(progress);

			const shouldResume = await progressTracker.shouldResume('ep-123');

			expect(shouldResume).toBe(true);
		});
	});

	describe('resetProgress', () => {
		it('should reset progress for an episode', async () => {
			await progressTracker.resetProgress('ep-123');

			expect(mockProgressStore.resetProgress).toHaveBeenCalledWith('ep-123');
		});

		it('should update internal state if resetting current episode', async () => {
			await progressTracker.startTracking(testEpisode);
			progressTracker.updatePosition(150);

			await progressTracker.resetProgress(testEpisode.id);

			expect(progressTracker.getLastSavedPosition()).toBe(0);
		});

		it('should not affect internal state if resetting different episode', async () => {
			await progressTracker.startTracking(testEpisode);
			progressTracker.updatePosition(150);

			await progressTracker.resetProgress('different-episode-id');

			expect(progressTracker.getLastSavedPosition()).toBe(150);
		});
	});

	describe('periodic save', () => {
		it('should save progress periodically', async () => {
			mockProgressStore.getProgress.mockResolvedValue(null);
			await progressTracker.startTracking(testEpisode);
			progressTracker.updatePosition(100);

			// Fast-forward time by save interval (default 5000ms)
			jest.advanceTimersByTime(5000);
			await Promise.resolve(); // Let async operations complete

			expect(mockProgressStore.updateProgress).toHaveBeenCalled();
		});

		it('should not save if position has not changed significantly', async () => {
			const existingProgress: PlayProgress = {
				episodeId: testEpisode.id,
				podcastId: testEpisode.podcastId,
				position: 100,
				duration: testEpisode.duration,
				lastPlayedAt: new Date(),
				completed: false,
			};

			mockProgressStore.getProgress.mockResolvedValue(existingProgress);
			await progressTracker.startTracking(testEpisode);

			// Update to position within minPositionChange threshold (default 2 seconds)
			progressTracker.updatePosition(101);
			mockProgressStore.updateProgress.mockClear();

			// Fast-forward time
			jest.advanceTimersByTime(5000);
			await Promise.resolve();

			expect(mockProgressStore.updateProgress).not.toHaveBeenCalled();
		});

		it('should save if position has changed significantly', async () => {
			const existingProgress: PlayProgress = {
				episodeId: testEpisode.id,
				podcastId: testEpisode.podcastId,
				position: 100,
				duration: testEpisode.duration,
				lastPlayedAt: new Date(),
				completed: false,
			};

			mockProgressStore.getProgress.mockResolvedValue(existingProgress);
			await progressTracker.startTracking(testEpisode);

			// Update to position beyond minPositionChange threshold
			progressTracker.updatePosition(105);
			mockProgressStore.updateProgress.mockClear();

			// Fast-forward time
			jest.advanceTimersByTime(5000);
			await Promise.resolve();

			expect(mockProgressStore.updateProgress).toHaveBeenCalled();
		});

		it('should handle save errors gracefully', async () => {
			mockProgressStore.getProgress.mockResolvedValue(null);
			mockProgressStore.updateProgress.mockRejectedValue(new Error('Save failed'));

			await progressTracker.startTracking(testEpisode);
			progressTracker.updatePosition(100);

			// Fast-forward time
			jest.advanceTimersByTime(5000);
			await Promise.resolve();

			// Should not throw error
			expect(progressTracker.isCurrentlyTracking()).toBe(true);
		});
	});

	describe('getters', () => {
		it('should get last saved position', async () => {
			await progressTracker.startTracking(testEpisode);
			progressTracker.updatePosition(250);

			expect(progressTracker.getLastSavedPosition()).toBe(250);
		});

		it('should get tracking status', async () => {
			expect(progressTracker.isCurrentlyTracking()).toBe(false);

			await progressTracker.startTracking(testEpisode);
			expect(progressTracker.isCurrentlyTracking()).toBe(true);

			await progressTracker.stopTracking();
			expect(progressTracker.isCurrentlyTracking()).toBe(false);
		});

		it('should get current episode', async () => {
			expect(progressTracker.getCurrentEpisode()).toBeNull();

			await progressTracker.startTracking(testEpisode);
			expect(progressTracker.getCurrentEpisode()).toEqual(testEpisode);

			await progressTracker.stopTracking();
			expect(progressTracker.getCurrentEpisode()).toBeNull();
		});

		it('should get time since last save', async () => {
			await progressTracker.startTracking(testEpisode);
			progressTracker.updatePosition(100);

			// Initially should be small
			expect(progressTracker.getTimeSinceLastSave()).toBeGreaterThanOrEqual(0);

			// Advance time
			jest.advanceTimersByTime(3000);

			// Should reflect elapsed time
			expect(progressTracker.getTimeSinceLastSave()).toBeGreaterThan(0);
		});
	});

	describe('completion detection', () => {
		it('should mark episode as completed when near end', async () => {
			await progressTracker.startTracking(testEpisode);

			// Position near end (within completion threshold of 30 seconds by default)
			const nearEndPosition = testEpisode.duration - 20;
			progressTracker.updatePosition(nearEndPosition);

			await progressTracker.forceSave();

			expect(mockProgressStore.updateProgress).toHaveBeenCalledWith(
				expect.objectContaining({
					completed: true,
				})
			);
		});

		it('should not mark as completed when far from end', async () => {
			await progressTracker.startTracking(testEpisode);

			// Position far from end
			progressTracker.updatePosition(1000);

			await progressTracker.forceSave();

			expect(mockProgressStore.updateProgress).toHaveBeenCalledWith(
				expect.objectContaining({
					completed: false,
				})
			);
		});
	});

	describe('custom options', () => {
		it('should use custom save interval', async () => {
			const tracker = new ProgressTracker(mockProgressStore, {
				saveInterval: 2000,
			});

			mockProgressStore.getProgress.mockResolvedValue(null);
			await tracker.startTracking(testEpisode);
			tracker.updatePosition(100);

			// Should save after 2000ms instead of default 5000ms
			jest.advanceTimersByTime(2000);
			await Promise.resolve();

			expect(mockProgressStore.updateProgress).toHaveBeenCalled();
		});

		it('should use custom min position change', async () => {
			const tracker = new ProgressTracker(mockProgressStore, {
				minPositionChange: 10,
			});

			const existingProgress: PlayProgress = {
				episodeId: testEpisode.id,
				podcastId: testEpisode.podcastId,
				position: 100,
				duration: testEpisode.duration,
				lastPlayedAt: new Date(),
				completed: false,
			};

			mockProgressStore.getProgress.mockResolvedValue(existingProgress);
			await tracker.startTracking(testEpisode);

			// Change by 5 seconds (less than custom threshold of 10)
			tracker.updatePosition(105);
			mockProgressStore.updateProgress.mockClear();

			jest.advanceTimersByTime(5000);
			await Promise.resolve();

			// Should not save due to insufficient position change
			expect(mockProgressStore.updateProgress).not.toHaveBeenCalled();
		});
	});
});
