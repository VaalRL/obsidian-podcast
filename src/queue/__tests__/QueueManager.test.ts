/**
 * Unit tests for QueueManager
 */

import { QueueManager } from '../QueueManager';
import { QueueStore } from '../QueueStore';
import { Queue } from '../../model';

// Mock QueueStore
jest.mock('../QueueStore');

describe('QueueManager', () => {
	let queueManager: QueueManager;
	let mockQueueStore: jest.Mocked<QueueStore>;

	beforeEach(() => {
		// Create mocked QueueStore
		mockQueueStore = {
			saveQueue: jest.fn().mockResolvedValue(undefined),
			getQueue: jest.fn().mockResolvedValue(null),
			load: jest.fn().mockResolvedValue([]),
			deleteQueue: jest.fn().mockResolvedValue(undefined),
			getCount: jest.fn().mockResolvedValue(0),
		} as any;

		queueManager = new QueueManager(mockQueueStore);
	});

	describe('createQueue', () => {
		it('should create a new queue with default values', async () => {
			const queueName = 'Test Queue';

			const queue = await queueManager.createQueue(queueName);

			expect(queue.name).toBe(queueName);
			expect(queue.episodeIds).toEqual([]);
			expect(queue.currentIndex).toBe(0);
			expect(queue.autoPlayNext).toBe(true);
			expect(queue.shuffle).toBe(false);
			expect(queue.repeat).toBe('none');
			expect(mockQueueStore.saveQueue).toHaveBeenCalledWith(expect.objectContaining({
				name: queueName,
			}));
		});

		it('should generate a unique ID for each queue', async () => {
			const queue1 = await queueManager.createQueue('Queue 1');
			const queue2 = await queueManager.createQueue('Queue 2');

			expect(queue1.id).not.toBe(queue2.id);
		});
	});

	describe('getQueue', () => {
		it('should retrieve a queue by ID', async () => {
			const testQueue: Queue = {
				id: 'queue-123',
				name: 'Test Queue',
				episodeIds: ['ep1', 'ep2'],
				currentIndex: 0,
				autoPlayNext: true,
				shuffle: false,
				repeat: 'none',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockQueueStore.getQueue.mockResolvedValue(testQueue);

			const queue = await queueManager.getQueue('queue-123');

			expect(queue).toEqual(testQueue);
			expect(mockQueueStore.getQueue).toHaveBeenCalledWith('queue-123');
		});

		it('should return null if queue does not exist', async () => {
			mockQueueStore.getQueue.mockResolvedValue(null);

			const queue = await queueManager.getQueue('non-existent');

			expect(queue).toBeNull();
		});
	});

	describe('getAllQueues', () => {
		it('should return all queues sorted by updated date', async () => {
			const queues: Queue[] = [
				{
					id: 'queue-1',
					name: 'Queue 1',
					episodeIds: [],
					currentIndex: 0,
					autoPlayNext: true,
					shuffle: false,
					repeat: 'none',
					createdAt: new Date('2024-01-01'),
					updatedAt: new Date('2024-01-05'),
				},
				{
					id: 'queue-2',
					name: 'Queue 2',
					episodeIds: [],
					currentIndex: 0,
					autoPlayNext: true,
					shuffle: false,
					repeat: 'none',
					createdAt: new Date('2024-01-02'),
					updatedAt: new Date('2024-01-10'),
				},
			];

			mockQueueStore.load.mockResolvedValue(queues);

			const result = await queueManager.getAllQueues();

			expect(result[0].id).toBe('queue-2'); // Most recent first
			expect(result[1].id).toBe('queue-1');
		});
	});

	describe('addEpisode', () => {
		it('should add an episode to a queue', async () => {
			const testQueue: Queue = {
				id: 'queue-123',
				name: 'Test Queue',
				episodeIds: [],
				currentIndex: 0,
				autoPlayNext: true,
				shuffle: false,
				repeat: 'none',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockQueueStore.getQueue.mockResolvedValue({ ...testQueue });

			await queueManager.addEpisode('queue-123', 'ep-456');

			expect(mockQueueStore.saveQueue).toHaveBeenCalledWith(expect.objectContaining({
				episodeIds: ['ep-456'],
			}));
		});

		it('should throw error if queue does not exist', async () => {
			mockQueueStore.getQueue.mockResolvedValue(null);

			await expect(queueManager.addEpisode('non-existent', 'ep-456')).rejects.toThrow();
		});
	});

	describe('addEpisodes', () => {
		it('should add multiple episodes to a queue', async () => {
			const testQueue: Queue = {
				id: 'queue-123',
				name: 'Test Queue',
				episodeIds: [],
				currentIndex: 0,
				autoPlayNext: true,
				shuffle: false,
				repeat: 'none',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockQueueStore.getQueue.mockResolvedValue({ ...testQueue });

			await queueManager.addEpisodes('queue-123', ['ep1', 'ep2', 'ep3']);

			expect(mockQueueStore.saveQueue).toHaveBeenCalledWith(expect.objectContaining({
				episodeIds: ['ep1', 'ep2', 'ep3'],
			}));
		});
	});

	describe('removeEpisode', () => {
		it('should remove an episode from a queue', async () => {
			const testQueue: Queue = {
				id: 'queue-123',
				name: 'Test Queue',
				episodeIds: ['ep1', 'ep2', 'ep3'],
				currentIndex: 1,
				autoPlayNext: true,
				shuffle: false,
				repeat: 'none',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockQueueStore.getQueue.mockResolvedValue({ ...testQueue });

			await queueManager.removeEpisode('queue-123', 'ep2');

			expect(mockQueueStore.saveQueue).toHaveBeenCalledWith(expect.objectContaining({
				episodeIds: ['ep1', 'ep3'],
			}));
		});

		it('should adjust current index when removing earlier episode', async () => {
			const testQueue: Queue = {
				id: 'queue-123',
				name: 'Test Queue',
				episodeIds: ['ep1', 'ep2', 'ep3'],
				currentIndex: 2,
				autoPlayNext: true,
				shuffle: false,
				repeat: 'none',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockQueueStore.getQueue.mockResolvedValue({ ...testQueue });

			await queueManager.removeEpisode('queue-123', 'ep1');

			expect(mockQueueStore.saveQueue).toHaveBeenCalledWith(expect.objectContaining({
				currentIndex: 1, // Adjusted down
			}));
		});
	});

	describe('next', () => {
		it('should move to next episode', async () => {
			const testQueue: Queue = {
				id: 'queue-123',
				name: 'Test Queue',
				episodeIds: ['ep1', 'ep2', 'ep3'],
				currentIndex: 0,
				autoPlayNext: true,
				shuffle: false,
				repeat: 'none',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockQueueStore.getQueue.mockResolvedValue({ ...testQueue });

			const nextEpisodeId = await queueManager.next('queue-123');

			expect(nextEpisodeId).toBe('ep2');
			expect(mockQueueStore.saveQueue).toHaveBeenCalledWith(expect.objectContaining({
				currentIndex: 1,
			}));
		});

		it('should return null at end of queue when repeat is none', async () => {
			const testQueue: Queue = {
				id: 'queue-123',
				name: 'Test Queue',
				episodeIds: ['ep1', 'ep2', 'ep3'],
				currentIndex: 2, // Last episode
				autoPlayNext: true,
				shuffle: false,
				repeat: 'none',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockQueueStore.getQueue.mockResolvedValue({ ...testQueue });

			const nextEpisodeId = await queueManager.next('queue-123');

			expect(nextEpisodeId).toBeNull();
		});

		it('should loop to first episode when repeat is all', async () => {
			const testQueue: Queue = {
				id: 'queue-123',
				name: 'Test Queue',
				episodeIds: ['ep1', 'ep2', 'ep3'],
				currentIndex: 2, // Last episode
				autoPlayNext: true,
				shuffle: false,
				repeat: 'all',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockQueueStore.getQueue.mockResolvedValue({ ...testQueue });

			const nextEpisodeId = await queueManager.next('queue-123');

			expect(nextEpisodeId).toBe('ep1');
			expect(mockQueueStore.saveQueue).toHaveBeenCalledWith(expect.objectContaining({
				currentIndex: 0,
			}));
		});

		it('should repeat current episode when repeat is one', async () => {
			const testQueue: Queue = {
				id: 'queue-123',
				name: 'Test Queue',
				episodeIds: ['ep1', 'ep2', 'ep3'],
				currentIndex: 1,
				autoPlayNext: true,
				shuffle: false,
				repeat: 'one',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockQueueStore.getQueue.mockResolvedValue({ ...testQueue });

			const nextEpisodeId = await queueManager.next('queue-123');

			expect(nextEpisodeId).toBe('ep2');
		});
	});

	describe('previous', () => {
		it('should move to previous episode', async () => {
			const testQueue: Queue = {
				id: 'queue-123',
				name: 'Test Queue',
				episodeIds: ['ep1', 'ep2', 'ep3'],
				currentIndex: 2,
				autoPlayNext: true,
				shuffle: false,
				repeat: 'none',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockQueueStore.getQueue.mockResolvedValue({ ...testQueue });

			const prevEpisodeId = await queueManager.previous('queue-123');

			expect(prevEpisodeId).toBe('ep2');
			expect(mockQueueStore.saveQueue).toHaveBeenCalledWith(expect.objectContaining({
				currentIndex: 1,
			}));
		});

		it('should stay at first episode when repeat is none', async () => {
			const testQueue: Queue = {
				id: 'queue-123',
				name: 'Test Queue',
				episodeIds: ['ep1', 'ep2', 'ep3'],
				currentIndex: 0, // First episode
				autoPlayNext: true,
				shuffle: false,
				repeat: 'none',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockQueueStore.getQueue.mockResolvedValue({ ...testQueue });

			const prevEpisodeId = await queueManager.previous('queue-123');

			expect(prevEpisodeId).toBe('ep1');
		});

		it('should loop to last episode when repeat is all', async () => {
			const testQueue: Queue = {
				id: 'queue-123',
				name: 'Test Queue',
				episodeIds: ['ep1', 'ep2', 'ep3'],
				currentIndex: 0, // First episode
				autoPlayNext: true,
				shuffle: false,
				repeat: 'all',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockQueueStore.getQueue.mockResolvedValue({ ...testQueue });

			const prevEpisodeId = await queueManager.previous('queue-123');

			expect(prevEpisodeId).toBe('ep3');
			expect(mockQueueStore.saveQueue).toHaveBeenCalledWith(expect.objectContaining({
				currentIndex: 2,
			}));
		});
	});

	describe('toggleShuffle', () => {
		it('should toggle shuffle from false to true', async () => {
			const testQueue: Queue = {
				id: 'queue-123',
				name: 'Test Queue',
				episodeIds: ['ep1', 'ep2', 'ep3', 'ep4', 'ep5'],
				currentIndex: 2,
				autoPlayNext: true,
				shuffle: false,
				repeat: 'none',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockQueueStore.getQueue.mockResolvedValue({ ...testQueue });

			const shuffleState = await queueManager.toggleShuffle('queue-123');

			expect(shuffleState).toBe(true);
			expect(mockQueueStore.saveQueue).toHaveBeenCalled();
		});

		it('should toggle shuffle from true to false', async () => {
			const testQueue: Queue = {
				id: 'queue-123',
				name: 'Test Queue',
				episodeIds: ['ep1', 'ep2', 'ep3'],
				currentIndex: 0,
				autoPlayNext: true,
				shuffle: true,
				repeat: 'none',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockQueueStore.getQueue.mockResolvedValue({ ...testQueue });

			const shuffleState = await queueManager.toggleShuffle('queue-123');

			expect(shuffleState).toBe(false);
		});
	});

	describe('cycleRepeat', () => {
		it('should cycle from none to one', async () => {
			const testQueue: Queue = {
				id: 'queue-123',
				name: 'Test Queue',
				episodeIds: ['ep1', 'ep2'],
				currentIndex: 0,
				autoPlayNext: true,
				shuffle: false,
				repeat: 'none',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockQueueStore.getQueue.mockResolvedValue({ ...testQueue });

			const newRepeat = await queueManager.cycleRepeat('queue-123');

			expect(newRepeat).toBe('one');
		});

		it('should cycle from one to all', async () => {
			const testQueue: Queue = {
				id: 'queue-123',
				name: 'Test Queue',
				episodeIds: ['ep1', 'ep2'],
				currentIndex: 0,
				autoPlayNext: true,
				shuffle: false,
				repeat: 'one',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockQueueStore.getQueue.mockResolvedValue({ ...testQueue });

			const newRepeat = await queueManager.cycleRepeat('queue-123');

			expect(newRepeat).toBe('all');
		});

		it('should cycle from all to none', async () => {
			const testQueue: Queue = {
				id: 'queue-123',
				name: 'Test Queue',
				episodeIds: ['ep1', 'ep2'],
				currentIndex: 0,
				autoPlayNext: true,
				shuffle: false,
				repeat: 'all',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockQueueStore.getQueue.mockResolvedValue({ ...testQueue });

			const newRepeat = await queueManager.cycleRepeat('queue-123');

			expect(newRepeat).toBe('none');
		});
	});

	describe('hasNext', () => {
		it('should return true when not at end of queue', async () => {
			const testQueue: Queue = {
				id: 'queue-123',
				name: 'Test Queue',
				episodeIds: ['ep1', 'ep2', 'ep3'],
				currentIndex: 0,
				autoPlayNext: true,
				shuffle: false,
				repeat: 'none',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockQueueStore.getQueue.mockResolvedValue(testQueue);

			const hasNext = await queueManager.hasNext('queue-123');

			expect(hasNext).toBe(true);
		});

		it('should return false at end of queue when repeat is none', async () => {
			const testQueue: Queue = {
				id: 'queue-123',
				name: 'Test Queue',
				episodeIds: ['ep1', 'ep2', 'ep3'],
				currentIndex: 2,
				autoPlayNext: true,
				shuffle: false,
				repeat: 'none',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockQueueStore.getQueue.mockResolvedValue(testQueue);

			const hasNext = await queueManager.hasNext('queue-123');

			expect(hasNext).toBe(false);
		});

		it('should return true at end of queue when repeat is all', async () => {
			const testQueue: Queue = {
				id: 'queue-123',
				name: 'Test Queue',
				episodeIds: ['ep1', 'ep2', 'ep3'],
				currentIndex: 2,
				autoPlayNext: true,
				shuffle: false,
				repeat: 'all',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockQueueStore.getQueue.mockResolvedValue(testQueue);

			const hasNext = await queueManager.hasNext('queue-123');

			expect(hasNext).toBe(true);
		});
	});
});
