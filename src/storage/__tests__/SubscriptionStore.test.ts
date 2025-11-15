/**
 * Unit tests for SubscriptionStore
 */

import { SubscriptionStore, SubscriptionData } from '../SubscriptionStore';
import { Vault } from 'obsidian';
import { DataPathManager } from '../DataPathManager';
import { Podcast } from '../../model';
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

// Mock the parent class methods
jest.mock('../FileSystemStore', () => {
	return {
		SingleFileStore: class {
			protected filePath: string;
			protected data: any = null;

			constructor(vault: any, pathManager: any, filePath: string) {
				this.filePath = filePath;
			}

			async load(): Promise<any> {
				return this.data || this['getDefaultValue']();
			}

			async save(data: any): Promise<void> {
				this.data = data;
			}

			protected validate(data: any): boolean {
				return true;
			}

			protected getDefaultValue(): any {
				return {};
			}
		},
	};
});

describe('SubscriptionStore', () => {
	let store: SubscriptionStore;
	let mockVault: jest.Mocked<Vault>;
	let mockPathManager: jest.Mocked<DataPathManager>;

	const samplePodcast1: Podcast = {
		id: 'podcast-1',
		title: 'Test Podcast 1',
		author: 'Author 1',
		description: 'Description 1',
		feedUrl: 'https://example.com/feed1.rss',
		subscribedAt: new Date('2024-01-01'),
		lastFetchedAt: new Date('2024-01-01'),
	};

	const samplePodcast2: Podcast = {
		id: 'podcast-2',
		title: 'Test Podcast 2',
		author: 'Author 2',
		description: 'Description 2',
		feedUrl: 'https://example.com/feed2.rss',
		subscribedAt: new Date('2024-01-02'),
		lastFetchedAt: new Date('2024-01-02'),
	};

	beforeEach(() => {
		mockVault = {} as any;
		mockPathManager = {
			getFilePath: jest.fn().mockReturnValue('subscriptions.json'),
		} as any;

		store = new SubscriptionStore(mockVault, mockPathManager);
		jest.clearAllMocks();
	});

	describe('constructor', () => {
		it('should create store with vault and path manager', () => {
			// Create a fresh instance to test constructor
			const freshPathManager = {
				getFilePath: jest.fn().mockReturnValue('subscriptions.json'),
			} as any;

			const freshStore = new SubscriptionStore(mockVault, freshPathManager);

			expect(freshStore).toBeInstanceOf(SubscriptionStore);
			expect(freshPathManager.getFilePath).toHaveBeenCalledWith(
				'subscriptions',
				'subscriptions.json'
			);
		});
	});

	describe('getAllPodcasts', () => {
		it('should return all podcasts', async () => {
			const data: SubscriptionData = {
				podcasts: [samplePodcast1, samplePodcast2],
				version: 1,
			};
			(store as any).data = data;

			const result = await store.getAllPodcasts();

			expect(result).toEqual([samplePodcast1, samplePodcast2]);
		});

		it('should return empty array when no podcasts', async () => {
			const result = await store.getAllPodcasts();

			expect(result).toEqual([]);
		});
	});

	describe('getPodcast', () => {
		it('should get podcast by ID', async () => {
			const data: SubscriptionData = {
				podcasts: [samplePodcast1, samplePodcast2],
				version: 1,
			};
			(store as any).data = data;

			const result = await store.getPodcast('podcast-1');

			expect(result).toEqual(samplePodcast1);
		});

		it('should return null if podcast not found', async () => {
			const data: SubscriptionData = {
				podcasts: [samplePodcast1],
				version: 1,
			};
			(store as any).data = data;

			const result = await store.getPodcast('nonexistent');

			expect(result).toBeNull();
		});
	});

	describe('getPodcastByFeedUrl', () => {
		it('should get podcast by feed URL', async () => {
			const data: SubscriptionData = {
				podcasts: [samplePodcast1, samplePodcast2],
				version: 1,
			};
			(store as any).data = data;

			const result = await store.getPodcastByFeedUrl('https://example.com/feed1.rss');

			expect(result).toEqual(samplePodcast1);
		});

		it('should return null if feed URL not found', async () => {
			const data: SubscriptionData = {
				podcasts: [samplePodcast1],
				version: 1,
			};
			(store as any).data = data;

			const result = await store.getPodcastByFeedUrl('https://example.com/nonexistent.rss');

			expect(result).toBeNull();
		});
	});

	describe('addPodcast', () => {
		it('should add a new podcast', async () => {
			await store.addPodcast(samplePodcast1);

			const allPodcasts = await store.getAllPodcasts();
			expect(allPodcasts).toContainEqual(samplePodcast1);
		});

		it('should update existing podcast if ID already exists', async () => {
			await store.addPodcast(samplePodcast1);

			const updatedPodcast = { ...samplePodcast1, title: 'Updated Title' };
			await store.addPodcast(updatedPodcast);

			const result = await store.getPodcast('podcast-1');
			expect(result?.title).toBe('Updated Title');

			const allPodcasts = await store.getAllPodcasts();
			expect(allPodcasts).toHaveLength(1); // Should not duplicate
		});

		it('should throw error for invalid podcast', async () => {
			const invalidPodcast = { id: 'test' } as Podcast; // Missing required fields

			await expect(store.addPodcast(invalidPodcast)).rejects.toThrow(StorageError);
		});
	});

	describe('updatePodcast', () => {
		it('should update existing podcast', async () => {
			await store.addPodcast(samplePodcast1);

			const updatedPodcast = { ...samplePodcast1, title: 'Updated Title' };
			await store.updatePodcast(updatedPodcast);

			const result = await store.getPodcast('podcast-1');
			expect(result?.title).toBe('Updated Title');
		});

		it('should throw error if podcast not found', async () => {
			await expect(store.updatePodcast(samplePodcast1)).rejects.toThrow(StorageError);
		});

		it('should throw error for invalid podcast', async () => {
			await store.addPodcast(samplePodcast1);

			const invalidPodcast = { id: 'podcast-1' } as Podcast;

			await expect(store.updatePodcast(invalidPodcast)).rejects.toThrow(StorageError);
		});
	});

	describe('removePodcast', () => {
		it('should remove a podcast', async () => {
			await store.addPodcast(samplePodcast1);
			await store.addPodcast(samplePodcast2);

			await store.removePodcast('podcast-1');

			const result = await store.getPodcast('podcast-1');
			expect(result).toBeNull();

			const allPodcasts = await store.getAllPodcasts();
			expect(allPodcasts).toHaveLength(1);
		});

		it('should not throw error if podcast not found', async () => {
			await expect(store.removePodcast('nonexistent')).resolves.not.toThrow();
		});
	});

	describe('isSubscribed', () => {
		it('should return true for subscribed podcast', async () => {
			await store.addPodcast(samplePodcast1);

			const result = await store.isSubscribed('podcast-1');

			expect(result).toBe(true);
		});

		it('should return false for unsubscribed podcast', async () => {
			const result = await store.isSubscribed('nonexistent');

			expect(result).toBe(false);
		});
	});

	describe('isSubscribedByFeedUrl', () => {
		it('should return true for subscribed feed URL', async () => {
			await store.addPodcast(samplePodcast1);

			const result = await store.isSubscribedByFeedUrl('https://example.com/feed1.rss');

			expect(result).toBe(true);
		});

		it('should return false for unsubscribed feed URL', async () => {
			const result = await store.isSubscribedByFeedUrl('https://example.com/nonexistent.rss');

			expect(result).toBe(false);
		});
	});

	describe('getSubscriptionCount', () => {
		it('should return subscription count', async () => {
			await store.addPodcast(samplePodcast1);
			await store.addPodcast(samplePodcast2);

			const count = await store.getSubscriptionCount();

			expect(count).toBe(2);
		});

		it('should return 0 when no subscriptions', async () => {
			const count = await store.getSubscriptionCount();

			expect(count).toBe(0);
		});
	});

	describe('updatePodcastEpisodes', () => {
		it('should update podcast episodes', async () => {
			await store.addPodcast(samplePodcast1);

			const episodes = [
				{
					id: 'ep-1',
					podcastId: 'podcast-1',
					title: 'Episode 1',
					description: 'Description',
					audioUrl: 'https://example.com/ep1.mp3',
					duration: 3600,
					publishDate: new Date(),
				},
			];

			await store.updatePodcastEpisodes('podcast-1', episodes);

			const result = await store.getPodcast('podcast-1');
			expect(result?.episodes).toEqual(episodes);
			expect(result?.lastFetchedAt).toBeInstanceOf(Date);
		});

		it('should throw error if podcast not found', async () => {
			await expect(store.updatePodcastEpisodes('nonexistent', [])).rejects.toThrow(
				StorageError
			);
		});
	});

	describe('updatePodcastSettings', () => {
		it('should update podcast settings', async () => {
			await store.addPodcast(samplePodcast1);

			const settings = {
				playbackSpeed: 1.5,
				volume: 0.8,
				skipIntro: 30,
			};

			await store.updatePodcastSettings('podcast-1', settings);

			const result = await store.getPodcast('podcast-1');
			expect(result?.settings).toEqual(settings);
		});

		it('should clear settings when undefined is passed', async () => {
			const podcastWithSettings = {
				...samplePodcast1,
				settings: { playbackSpeed: 1.5 },
			};
			await store.addPodcast(podcastWithSettings);

			await store.updatePodcastSettings('podcast-1', undefined);

			const result = await store.getPodcast('podcast-1');
			expect(result?.settings).toBeUndefined();
		});

		it('should throw error if podcast not found', async () => {
			await expect(
				store.updatePodcastSettings('nonexistent', { playbackSpeed: 1.0 })
			).rejects.toThrow(StorageError);
		});
	});

	describe('getPodcastsNeedingUpdate', () => {
		it('should return podcasts that need update', async () => {
			const oldPodcast = {
				...samplePodcast1,
				lastFetchedAt: new Date(Date.now() - 7200000), // 2 hours ago
			};
			const recentPodcast = {
				...samplePodcast2,
				lastFetchedAt: new Date(Date.now() - 1800000), // 30 minutes ago
			};

			await store.addPodcast(oldPodcast);
			await store.addPodcast(recentPodcast);

			const updateInterval = 3600000; // 1 hour
			const result = await store.getPodcastsNeedingUpdate(updateInterval);

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('podcast-1');
		});

		it('should return podcasts never fetched', async () => {
			const neverFetched = { ...samplePodcast1, lastFetchedAt: undefined };
			await store.addPodcast(neverFetched as any);

			const result = await store.getPodcastsNeedingUpdate(3600000);

			expect(result).toHaveLength(1);
		});
	});

	describe('searchPodcasts', () => {
		it('should search podcasts by title', async () => {
			await store.addPodcast(samplePodcast1);
			await store.addPodcast(samplePodcast2);

			const result = await store.searchPodcasts('Podcast 1');

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('podcast-1');
		});

		it('should search podcasts by author', async () => {
			await store.addPodcast(samplePodcast1);
			await store.addPodcast(samplePodcast2);

			const result = await store.searchPodcasts('Author 2');

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('podcast-2');
		});

		it('should be case insensitive', async () => {
			await store.addPodcast(samplePodcast1);

			const result = await store.searchPodcasts('PODCAST');

			expect(result).toHaveLength(1);
		});

		it('should return empty array when no matches', async () => {
			await store.addPodcast(samplePodcast1);

			const result = await store.searchPodcasts('nonexistent');

			expect(result).toEqual([]);
		});
	});

	describe('exportSubscriptions', () => {
		it('should export all subscription data', async () => {
			await store.addPodcast(samplePodcast1);
			await store.addPodcast(samplePodcast2);

			const result = await store.exportSubscriptions();

			expect(result.podcasts).toHaveLength(2);
			expect(result.version).toBe(1);
		});
	});

	describe('importSubscriptions', () => {
		it('should import subscriptions with replace', async () => {
			await store.addPodcast(samplePodcast1);

			const importData: SubscriptionData = {
				podcasts: [samplePodcast2],
				version: 1,
			};

			await store.importSubscriptions(importData, true);

			const allPodcasts = await store.getAllPodcasts();
			expect(allPodcasts).toHaveLength(1);
			expect(allPodcasts[0].id).toBe('podcast-2');
		});

		it('should merge subscriptions by default', async () => {
			await store.addPodcast(samplePodcast1);

			const importData: SubscriptionData = {
				podcasts: [samplePodcast2],
				version: 1,
			};

			await store.importSubscriptions(importData, false);

			const allPodcasts = await store.getAllPodcasts();
			expect(allPodcasts).toHaveLength(2);
		});

		it('should update existing podcasts when merging', async () => {
			await store.addPodcast(samplePodcast1);

			const updatedPodcast = { ...samplePodcast1, title: 'Updated Title' };
			const importData: SubscriptionData = {
				podcasts: [updatedPodcast],
				version: 1,
			};

			await store.importSubscriptions(importData, false);

			const result = await store.getPodcast('podcast-1');
			expect(result?.title).toBe('Updated Title');

			const allPodcasts = await store.getAllPodcasts();
			expect(allPodcasts).toHaveLength(1); // Should not duplicate
		});

		it('should throw error for invalid import data', async () => {
			const invalidData = {
				podcasts: 'not an array',
				version: 1,
			} as any;

			await expect(store.importSubscriptions(invalidData, false)).rejects.toThrow(
				StorageError
			);
		});
	});

	describe('data validation', () => {
		it('should validate correct subscription data', () => {
			const validData: SubscriptionData = {
				podcasts: [samplePodcast1],
				version: 1,
			};

			const result = (store as any).validate(validData);

			expect(result).toBe(true);
		});

		it('should reject non-object data', () => {
			const result = (store as any).validate('not an object');

			expect(result).toBe(false);
		});

		it('should reject data without podcasts array', () => {
			const invalidData = {
				podcasts: 'not an array',
				version: 1,
			};

			const result = (store as any).validate(invalidData);

			expect(result).toBe(false);
		});

		it('should reject data without version number', () => {
			const invalidData = {
				podcasts: [],
				version: 'not a number',
			};

			const result = (store as any).validate(invalidData);

			expect(result).toBe(false);
		});

		it('should reject data with invalid podcast', () => {
			const invalidData = {
				podcasts: [{ id: 'test' }], // Missing required fields
				version: 1,
			};

			const result = (store as any).validate(invalidData);

			expect(result).toBe(false);
		});
	});

	describe('getDefaultValue', () => {
		it('should return default subscription data', () => {
			const result = (store as any).getDefaultValue();

			expect(result).toEqual({
				podcasts: [],
				version: 1,
			});
		});
	});
});
