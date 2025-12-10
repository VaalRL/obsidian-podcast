/**
 * Unit tests for PodcastService
 */

import { PodcastService } from '../PodcastService';
import { FeedService } from '../../feed/FeedService';
import { SubscriptionStore } from '../../storage/SubscriptionStore';
import { ImageCacheStore } from '../../storage/CacheStore';
import { Podcast, Episode, PodcastSettings } from '../../model';

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

// Mock global fetch
global.fetch = jest.fn();

describe('PodcastService', () => {
	let service: PodcastService;
	let mockFeedService: jest.Mocked<FeedService>;
	let mockSubscriptionStore: jest.Mocked<SubscriptionStore>;
	let mockImageCache: jest.Mocked<ImageCacheStore>;

	const samplePodcast: Podcast = {
		id: 'podcast-123',
		title: 'Test Podcast',
		author: 'Test Author',
		description: 'Test Description',
		feedUrl: 'https://example.com/feed.rss',
		subscribedAt: new Date('2024-01-01'),
		lastFetchedAt: new Date('2024-01-01'),
		imageUrl: 'https://example.com/image.jpg',
	};

	const sampleEpisode: Episode = {
		id: 'episode-123',
		podcastId: 'podcast-123',
		title: 'Test Episode',
		description: 'Test Episode Description',
		audioUrl: 'https://example.com/episode.mp3',
		duration: 3600,
		publishDate: new Date('2024-01-01'),
	};

	beforeEach(() => {
		// Create mocks
		mockFeedService = {
			fetchFeed: jest.fn(),
			updateFeed: jest.fn(),
			clearCache: jest.fn(),
		} as any;

		mockSubscriptionStore = {
			getPodcast: jest.fn(),
			getPodcastByFeedUrl: jest.fn(),
			getAllPodcasts: jest.fn(),
			addPodcast: jest.fn(),
			updatePodcast: jest.fn(),
			removePodcast: jest.fn(),
			getSubscriptionCount: jest.fn(),
			isSubscribed: jest.fn(),
			isSubscribedByFeedUrl: jest.fn(),
			searchPodcasts: jest.fn(),
			updatePodcastSettings: jest.fn(),
			getPodcastsNeedingUpdate: jest.fn(),
			exportSubscriptions: jest.fn(),
			importSubscriptions: jest.fn(),
		} as any;

		mockImageCache = {
			getCachedImage: jest.fn(),
			cacheImage: jest.fn(),
			removeCachedImage: jest.fn(),
		} as any;

		service = new PodcastService(mockFeedService, mockSubscriptionStore, mockImageCache);

		// Reset mocks
		jest.clearAllMocks();
		(global.fetch as jest.Mock).mockReset();
	});

	describe('constructor', () => {
		it('should create service with all dependencies', () => {
			expect(service).toBeInstanceOf(PodcastService);
		});

		it('should create service without image cache', () => {
			const serviceWithoutCache = new PodcastService(mockFeedService, mockSubscriptionStore);
			expect(serviceWithoutCache).toBeInstanceOf(PodcastService);
		});
	});

	describe('subscribe', () => {
		it('should successfully subscribe to a new podcast', async () => {
			mockSubscriptionStore.getPodcastByFeedUrl.mockResolvedValue(null);
			mockFeedService.fetchFeed.mockResolvedValue({
				podcast: samplePodcast,
				episodes: [sampleEpisode],
			});

			const result = await service.subscribe('https://example.com/feed.rss');

			expect(result.success).toBe(true);
			expect(result.podcast).toBeDefined();
			expect(result.podcast?.episodes).toEqual([sampleEpisode]);
			expect(mockSubscriptionStore.addPodcast).toHaveBeenCalled();
		});

		it('should reject invalid feed URLs', async () => {
			const result = await service.subscribe('not a url');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invalid feed URL');
		});

		it('should return existing podcast if already subscribed', async () => {
			mockSubscriptionStore.getPodcastByFeedUrl.mockResolvedValue(samplePodcast);

			const result = await service.subscribe('https://example.com/feed.rss');

			expect(result.success).toBe(true);
			expect(result.podcast).toEqual(samplePodcast);
			expect(mockFeedService.fetchFeed).not.toHaveBeenCalled();
		});

		it('should cache podcast image if available', async () => {
			mockSubscriptionStore.getPodcastByFeedUrl.mockResolvedValue(null);
			mockFeedService.fetchFeed.mockResolvedValue({
				podcast: samplePodcast,
				episodes: [sampleEpisode],
			});
			mockImageCache.getCachedImage.mockResolvedValue(null);
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
			});

			await service.subscribe('https://example.com/feed.rss');

			expect(mockImageCache.cacheImage).toHaveBeenCalledWith(
				samplePodcast.imageUrl,
				expect.any(ArrayBuffer)
			);
		});

		it('should handle image caching failures gracefully', async () => {
			mockSubscriptionStore.getPodcastByFeedUrl.mockResolvedValue(null);
			mockFeedService.fetchFeed.mockResolvedValue({
				podcast: samplePodcast,
				episodes: [sampleEpisode],
			});
			mockImageCache.getCachedImage.mockResolvedValue(null);
			(global.fetch as jest.Mock).mockRejectedValue(new Error('Image fetch failed'));

			const result = await service.subscribe('https://example.com/feed.rss');

			expect(result.success).toBe(true); // Should succeed despite image failure
			expect(mockSubscriptionStore.addPodcast).toHaveBeenCalled();
		});

		it('should handle feed fetch errors', async () => {
			mockSubscriptionStore.getPodcastByFeedUrl.mockResolvedValue(null);
			mockFeedService.fetchFeed.mockRejectedValue(new Error('Network error'));

			const result = await service.subscribe('https://example.com/feed.rss');

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});
	});

	describe('unsubscribe', () => {
		it('should successfully unsubscribe from a podcast', async () => {
			mockSubscriptionStore.getPodcast.mockResolvedValue(samplePodcast);

			await service.unsubscribe('podcast-123');

			expect(mockSubscriptionStore.removePodcast).toHaveBeenCalledWith('podcast-123');
			expect(mockFeedService.clearCache).toHaveBeenCalledWith(samplePodcast.feedUrl);
		});

		it('should throw error if podcast not found', async () => {
			mockSubscriptionStore.getPodcast.mockResolvedValue(null);

			await expect(service.unsubscribe('podcast-123')).rejects.toThrow('Podcast not found');
		});
	});

	describe('getPodcast', () => {
		it('should get a podcast by ID', async () => {
			mockSubscriptionStore.getPodcast.mockResolvedValue(samplePodcast);

			const result = await service.getPodcast('podcast-123');

			expect(result).toEqual(samplePodcast);
		});

		it('should return null if podcast not found', async () => {
			mockSubscriptionStore.getPodcast.mockResolvedValue(null);

			const result = await service.getPodcast('podcast-123');

			expect(result).toBeNull();
		});
	});

	describe('getPodcastByFeedUrl', () => {
		it('should get a podcast by feed URL', async () => {
			mockSubscriptionStore.getPodcastByFeedUrl.mockResolvedValue(samplePodcast);

			const result = await service.getPodcastByFeedUrl('https://example.com/feed.rss');

			expect(result).toEqual(samplePodcast);
		});
	});

	describe('getAllPodcasts', () => {
		it('should get all podcasts', async () => {
			const podcasts = [samplePodcast];
			mockSubscriptionStore.getAllPodcasts.mockResolvedValue(podcasts);

			const result = await service.getAllPodcasts();

			expect(result).toEqual(podcasts);
		});
	});

	describe('subscription checks', () => {
		it('should check if subscribed by ID', async () => {
			mockSubscriptionStore.isSubscribed.mockResolvedValue(true);

			const result = await service.isSubscribed('podcast-123');

			expect(result).toBe(true);
		});

		it('should check if subscribed by feed URL', async () => {
			mockSubscriptionStore.isSubscribedByFeedUrl.mockResolvedValue(false);

			const result = await service.isSubscribedByFeedUrl('https://example.com/feed.rss');

			expect(result).toBe(false);
		});

		it('should get subscription count', async () => {
			mockSubscriptionStore.getSubscriptionCount.mockResolvedValue(5);

			const result = await service.getSubscriptionCount();

			expect(result).toBe(5);
		});
	});

	describe('searchPodcasts', () => {
		it('should search podcasts', async () => {
			const podcasts = [samplePodcast];
			mockSubscriptionStore.searchPodcasts.mockResolvedValue(podcasts);

			const result = await service.searchPodcasts('test');

			expect(result).toEqual(podcasts);
			expect(mockSubscriptionStore.searchPodcasts).toHaveBeenCalledWith('test');
		});
	});

	describe('updatePodcastMetadata', () => {
		it('should update podcast metadata', async () => {
			mockSubscriptionStore.getPodcast.mockResolvedValue(samplePodcast);

			await service.updatePodcastMetadata('podcast-123', {
				title: 'Updated Title',
			});

			expect(mockSubscriptionStore.updatePodcast).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 'podcast-123',
					title: 'Updated Title',
					feedUrl: samplePodcast.feedUrl, // Preserved
					subscribedAt: samplePodcast.subscribedAt, // Preserved
				})
			);
		});

		it('should preserve immutable fields', async () => {
			mockSubscriptionStore.getPodcast.mockResolvedValue(samplePodcast);

			await service.updatePodcastMetadata('podcast-123', {
				id: 'different-id',
				feedUrl: 'https://evil.com/feed.rss',
				subscribedAt: new Date(),
			} as any);

			expect(mockSubscriptionStore.updatePodcast).toHaveBeenCalledWith(
				expect.objectContaining({
					id: samplePodcast.id,
					feedUrl: samplePodcast.feedUrl,
					subscribedAt: samplePodcast.subscribedAt,
				})
			);
		});

		it('should throw error if podcast not found', async () => {
			mockSubscriptionStore.getPodcast.mockResolvedValue(null);

			await expect(
				service.updatePodcastMetadata('podcast-123', { title: 'New' })
			).rejects.toThrow('Podcast not found');
		});
	});

	describe('podcast settings', () => {
		const settings: PodcastSettings = {
			playbackSpeed: 1.5,
			volume: 0.8,
			skipIntroSeconds: 30,
		};

		it('should update podcast settings', async () => {
			await service.updatePodcastSettings('podcast-123', settings);

			expect(mockSubscriptionStore.updatePodcastSettings).toHaveBeenCalledWith(
				'podcast-123',
				settings
			);
		});

		it('should get podcast settings', async () => {
			mockSubscriptionStore.getPodcast.mockResolvedValue({
				...samplePodcast,
				settings,
			});

			const result = await service.getPodcastSettings('podcast-123');

			expect(result).toEqual(settings);
		});

		it('should clear podcast settings', async () => {
			await service.clearPodcastSettings('podcast-123');

			expect(mockSubscriptionStore.updatePodcastSettings).toHaveBeenCalledWith(
				'podcast-123',
				undefined
			);
		});
	});

	describe('episodes', () => {
		it('should get episodes for a podcast', async () => {
			const podcastWithEpisodes = {
				...samplePodcast,
				episodes: [sampleEpisode],
			};
			mockSubscriptionStore.getPodcast.mockResolvedValue(podcastWithEpisodes);

			const result = await service.getEpisodes('podcast-123');

			expect(result).toEqual([sampleEpisode]);
		});

		it('should return empty array if no episodes', async () => {
			const podcastWithoutEpisodes = { ...samplePodcast, episodes: undefined };
			mockSubscriptionStore.getPodcast.mockResolvedValue(podcastWithoutEpisodes);

			const result = await service.getEpisodes('podcast-123');

			expect(result).toEqual([]);
		});

		it('should throw error if podcast not found', async () => {
			mockSubscriptionStore.getPodcast.mockResolvedValue(null);

			await expect(service.getEpisodes('podcast-123')).rejects.toThrow('Podcast not found');
		});

		it('should get a specific episode', async () => {
			const podcastWithEpisodes = {
				...samplePodcast,
				episodes: [sampleEpisode],
			};
			mockSubscriptionStore.getPodcast.mockResolvedValue(podcastWithEpisodes);

			const result = await service.getEpisode('podcast-123', 'episode-123');

			expect(result).toEqual(sampleEpisode);
		});

		it('should return null if episode not found', async () => {
			const podcastWithEpisodes = {
				...samplePodcast,
				episodes: [sampleEpisode],
			};
			mockSubscriptionStore.getPodcast.mockResolvedValue(podcastWithEpisodes);

			const result = await service.getEpisode('podcast-123', 'nonexistent');

			expect(result).toBeNull();
		});

		it('should get latest episodes across all podcasts', async () => {
			const episode1 = { ...sampleEpisode, id: 'ep1', publishDate: new Date('2024-01-03') };
			const episode2 = { ...sampleEpisode, id: 'ep2', publishDate: new Date('2024-01-02') };
			const episode3 = { ...sampleEpisode, id: 'ep3', publishDate: new Date('2024-01-01') };

			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([
				{ ...samplePodcast, episodes: [episode1, episode2] },
				{ ...samplePodcast, id: 'podcast-456', episodes: [episode3] },
			]);

			const result = await service.getLatestEpisodes(2);

			expect(result).toHaveLength(2);
			expect(result[0].id).toBe('ep1'); // Newest first
			expect(result[1].id).toBe('ep2');
		});
	});

	describe('getPodcastsNeedingUpdate', () => {
		it('should get podcasts needing update', async () => {
			const podcasts = [samplePodcast];
			mockSubscriptionStore.getPodcastsNeedingUpdate.mockResolvedValue(podcasts);

			const result = await service.getPodcastsNeedingUpdate(3600000);

			expect(result).toEqual(podcasts);
		});
	});

	describe('image caching', () => {
		it('should get cached image path', async () => {
			mockImageCache.getCachedImage.mockResolvedValue('/path/to/image.jpg');

			const result = await service.getCachedImagePath('https://example.com/image.jpg');

			expect(result).toBe('/path/to/image.jpg');
		});

		it('should return null if no image cache', async () => {
			const serviceWithoutCache = new PodcastService(mockFeedService, mockSubscriptionStore);

			const result = await serviceWithoutCache.getCachedImagePath('https://example.com/image.jpg');

			expect(result).toBeNull();
		});
	});

	describe('import/export', () => {
		it('should export subscriptions', async () => {
			const exportData = { podcasts: [samplePodcast], version: 1 };
			mockSubscriptionStore.exportSubscriptions.mockResolvedValue(exportData);

			const result = await service.exportSubscriptions();

			expect(result).toEqual(exportData);
		});

		it('should import subscriptions', async () => {
			const importData = { version: 1, podcasts: [samplePodcast] };

			await service.importSubscriptions(importData, false);

			expect(mockSubscriptionStore.importSubscriptions).toHaveBeenCalledWith(importData, false);
		});

		it('should import subscriptions with replace flag', async () => {
			const importData = { version: 1, podcasts: [samplePodcast] };

			await service.importSubscriptions(importData, true);

			expect(mockSubscriptionStore.importSubscriptions).toHaveBeenCalledWith(importData, true);
		});
	});
});
