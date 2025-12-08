/**
 * Storage Module
 *
 * Provides data persistence layer for the Podcast Player plugin.
 * All data is stored in configurable folders using JSON files.
 */

// Export path manager
export { DataPathManager, type DataFolderStructure } from './DataPathManager';

// Export base stores
export {
	FileSystemStore,
	SingleFileStore,
	MultiFileStore,
	type StorageFormat,
} from './FileSystemStore';

// Export concrete stores
export { SubscriptionStore, type SubscriptionData } from './SubscriptionStore';
export { ProgressStore, type ProgressData } from './ProgressStore';
export { SettingsStore } from './SettingsStore';
export {
	FeedCacheStore,
	ImageCacheStore,
	type CacheEntry,
	type FeedCacheEntry,
	type ImageCacheEntry,
} from './CacheStore';
