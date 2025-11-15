/**
 * Unit tests for QueueStore
 */

import { QueueStore } from '../QueueStore';
import { Vault } from 'obsidian';
import { DataPathManager } from '../../storage/DataPathManager';
import { Queue } from '../../model';
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

describe('QueueStore', () => {
	let store: QueueStore;
	let mockVault: jest.Mocked<Vault>;
	let mockPathManager: jest.Mocked<DataPathManager>;

	const sampleQueue: Queue = {
		id: 'queue-123',
		name: 'My Queue',
		episodeIds: ['ep-1', 'ep-2', 'ep-3'],
		currentIndex: 0,
		autoPlayNext: true,
		shuffle: false,
		repeat: 'none',
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
				queues: 'queues',
			}),
		} as any;

		store = new QueueStore(mockVault, mockPathManager);
	});

	describe('constructor', () => {
		it('should create store with vault and path manager', () => {
			const freshPathManager = {
				getStructure: jest.fn().mockReturnValue({
					queues: 'queues',
				}),
			} as any;
			const freshStore = new QueueStore(mockVault, freshPathManager);
			expect(freshStore).toBeInstanceOf(QueueStore);
			expect(freshPathManager.getStructure).toHaveBeenCalled();
		});
	});

	describe('validation', () => {
		it('should validate correct queue array', () => {
			const validData = [sampleQueue];
			const result = (store as any).validate(validData);
			expect(result).toBe(true);
		});

		it('should reject non-array data', () => {
			const result = (store as any).validate('not an array');
			expect(result).toBe(false);
		});

		it('should reject array with invalid queue', () => {
			const invalidData = [{ id: 'test' }]; // Missing required fields
			const result = (store as any).validate(invalidData);
			expect(result).toBe(false);
		});

		it('should validate individual queue', () => {
			const result = (store as any).validateQueue(sampleQueue);
			expect(result).toBe(true);
		});

		it('should reject queue missing required fields', () => {
			const invalidQueue = {
				id: 'test',
				name: 'Test',
			};
			const result = (store as any).validateQueue(invalidQueue);
			expect(result).toBe(false);
		});

		it('should reject non-object queue', () => {
			const result = (store as any).validateQueue('not an object');
			expect(result).toBe(false);
		});

		it('should reject queue with non-array episodeIds', () => {
			const invalidQueue = {
				...sampleQueue,
				episodeIds: 'not an array',
			};
			const result = (store as any).validateQueue(invalidQueue);
			expect(result).toBe(false);
		});

		it('should reject queue with non-number currentIndex', () => {
			const invalidQueue = {
				...sampleQueue,
				currentIndex: 'not a number',
			};
			const result = (store as any).validateQueue(invalidQueue);
			expect(result).toBe(false);
		});

		it('should reject queue with non-boolean autoPlayNext', () => {
			const invalidQueue = {
				...sampleQueue,
				autoPlayNext: 'not a boolean',
			};
			const result = (store as any).validateQueue(invalidQueue);
			expect(result).toBe(false);
		});

		it('should reject queue with non-boolean shuffle', () => {
			const invalidQueue = {
				...sampleQueue,
				shuffle: 'not a boolean',
			};
			const result = (store as any).validateQueue(invalidQueue);
			expect(result).toBe(false);
		});

		it('should reject queue with invalid repeat value', () => {
			const invalidQueue = {
				...sampleQueue,
				repeat: 'invalid',
			};
			const result = (store as any).validateQueue(invalidQueue);
			expect(result).toBe(false);
		});

		it('should accept queue with repeat value "one"', () => {
			const validQueue = {
				...sampleQueue,
				repeat: 'one',
			};
			const result = (store as any).validateQueue(validQueue);
			expect(result).toBe(true);
		});

		it('should accept queue with repeat value "all"', () => {
			const validQueue = {
				...sampleQueue,
				repeat: 'all',
			};
			const result = (store as any).validateQueue(validQueue);
			expect(result).toBe(true);
		});
	});

	describe('getDefaultValue', () => {
		it('should return empty array', () => {
			const result = (store as any).getDefaultValue();
			expect(result).toEqual([]);
		});
	});

	describe('saveQueue and getQueue', () => {
		it('should save and get queue', async () => {
			await store.saveQueue(sampleQueue);

			const result = await store.getQueue(sampleQueue.id);
			expect(result).toEqual(sampleQueue);
		});

		it('should return null for non-existent queue', async () => {
			const result = await store.getQueue('non-existent');
			expect(result).toBeNull();
		});

		it('should throw error for invalid queue', async () => {
			const invalidQueue = { id: 'test' } as any;
			await expect(store.saveQueue(invalidQueue)).rejects.toThrow(StorageError);
		});

		it('should return null for invalid stored queue', async () => {
			const invalidQueue = { id: 'test' };
			const id = 'test';
			await (store as any).saveItem(id, invalidQueue);

			const result = await store.getQueue(id);
			expect(result).toBeNull();
		});
	});

	describe('deleteQueue', () => {
		it('should delete queue', async () => {
			await store.saveQueue(sampleQueue);

			await store.deleteQueue(sampleQueue.id);

			const result = await store.getQueue(sampleQueue.id);
			expect(result).toBeNull();
		});

		it('should not throw error when deleting non-existent queue', async () => {
			await expect(store.deleteQueue('non-existent')).resolves.not.toThrow();
		});
	});

	describe('load', () => {
		it('should load all queues', async () => {
			const queue1: Queue = { ...sampleQueue, id: 'q-1', name: 'Queue 1' };
			const queue2: Queue = { ...sampleQueue, id: 'q-2', name: 'Queue 2' };

			await store.saveQueue(queue1);
			await store.saveQueue(queue2);

			const result = await store.load();

			expect(result).toHaveLength(2);
			expect(result.some(q => q.id === 'q-1')).toBe(true);
			expect(result.some(q => q.id === 'q-2')).toBe(true);
		});

		it('should return empty array when no queues', async () => {
			const result = await store.load();
			expect(result).toEqual([]);
		});

		it('should skip invalid queues', async () => {
			await store.saveQueue(sampleQueue);

			// Add an invalid queue
			await (store as any).saveItem('invalid', { id: 'invalid' });

			const result = await store.load();

			// Should only load the valid queue
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe(sampleQueue.id);
		});
	});

	describe('save', () => {
		it('should save all queues', async () => {
			const queues: Queue[] = [
				{ ...sampleQueue, id: 'q-1', name: 'Queue 1' },
				{ ...sampleQueue, id: 'q-2', name: 'Queue 2' },
			];

			await store.save(queues);

			const result = await store.load();
			expect(result).toHaveLength(2);
		});

		it('should clear existing queues before saving', async () => {
			await store.saveQueue({ ...sampleQueue, id: 'old' });

			const newQueues: Queue[] = [
				{ ...sampleQueue, id: 'new-1', name: 'New 1' },
			];

			await store.save(newQueues);

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
		it('should return true for existing queue', async () => {
			await store.saveQueue(sampleQueue);

			const result = await store.exists(sampleQueue.id);
			expect(result).toBe(true);
		});

		it('should return false for non-existent queue', async () => {
			const result = await store.exists('non-existent');
			expect(result).toBe(false);
		});
	});

	describe('getAllIds', () => {
		it('should return all queue IDs', async () => {
			await store.saveQueue({ ...sampleQueue, id: 'q-1' });
			await store.saveQueue({ ...sampleQueue, id: 'q-2' });

			const result = await store.getAllIds();

			expect(result).toHaveLength(2);
			expect(result).toContain('q-1');
			expect(result).toContain('q-2');
		});

		it('should return empty array when no queues', async () => {
			const result = await store.getAllIds();
			expect(result).toEqual([]);
		});
	});

	describe('getCount', () => {
		it('should return queue count', async () => {
			await store.saveQueue({ ...sampleQueue, id: 'q-1' });
			await store.saveQueue({ ...sampleQueue, id: 'q-2' });

			const result = await store.getCount();
			expect(result).toBe(2);
		});

		it('should return 0 when no queues', async () => {
			const result = await store.getCount();
			expect(result).toBe(0);
		});
	});

	describe('clear', () => {
		it('should clear all queues', async () => {
			await store.saveQueue({ ...sampleQueue, id: 'q-1' });
			await store.saveQueue({ ...sampleQueue, id: 'q-2' });

			await store.clear();

			const result = await store.load();
			expect(result).toEqual([]);
		});

		it('should not throw error when clearing empty store', async () => {
			await expect(store.clear()).resolves.not.toThrow();
		});
	});
});
