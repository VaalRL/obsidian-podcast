/**
 * FileSystemStore - Base class for file-based storage
 *
 * Provides common functionality for storing data in JSON files.
 * Other store classes extend this base class.
 */

import { Vault, normalizePath } from 'obsidian';
import { logger } from '../utils/Logger';
import { StorageError, safeJsonParse } from '../utils/errorUtils';
import { DataPathManager } from './DataPathManager';

/**
 * Storage format type
 */
export type StorageFormat = 'json' | 'yaml' | 'markdown';

/**
 * Base class for file system storage
 */
export abstract class FileSystemStore<T> {
	protected vault: Vault;
	protected pathManager: DataPathManager;
	protected format: StorageFormat;

	constructor(
		vault: Vault,
		pathManager: DataPathManager,
		format: StorageFormat = 'json'
	) {
		this.vault = vault;
		this.pathManager = pathManager;
		this.format = format;
	}

	/**
	 * Read a JSON file and parse its contents
	 */
	protected async readJson<TData>(path: string, fallback: TData): Promise<TData> {
		try {
			const adapter = this.vault.adapter;

			if (!(await adapter.exists(path))) {
				logger.debug('File does not exist, returning fallback', path);
				return fallback;
			}

			const content = await adapter.read(path);
			const data = safeJsonParse<TData>(content, fallback);

			logger.debug('Read JSON file', path);
			return data;
		} catch (error) {
			logger.error('Failed to read JSON file', error);
			throw new StorageError(`Failed to read file ${path}`, path);
		}
	}

	/**
	 * Write data to a JSON file
	 */
	protected async writeJson<TData>(path: string, data: TData, createBackup = false): Promise<void> {
		try {
			const adapter = this.vault.adapter;

			// Create backup if file exists
			if (createBackup && (await adapter.exists(path))) {
				try {
					await this.pathManager.createBackup(path);
				} catch (error) {
					logger.warn('Failed to create backup, continuing', error);
				}
			}

			// Write new content
			const content = JSON.stringify(data, null, 2);
			await adapter.write(path, content);

			logger.debug('Wrote JSON file', path);
		} catch (error) {
			logger.error('Failed to write JSON file', error);
			throw new StorageError(`Failed to write file ${path}`, path);
		}
	}

	/**
	 * Delete a file
	 */
	protected async deleteFile(path: string): Promise<void> {
		try {
			await this.vault.adapter.remove(path);
			logger.debug('Deleted file', path);
		} catch (error) {
			logger.error('Failed to delete file', error);
			throw new StorageError(`Failed to delete file ${path}`, path);
		}
	}

	/**
	 * Check if a file exists
	 */
	protected async fileExists(path: string): Promise<boolean> {
		try {
			return await this.vault.adapter.exists(path);
		} catch (error) {
			logger.error('Failed to check file existence', error);
			return false;
		}
	}

	/**
	 * List all files in a directory
	 */
	protected async listFiles(dirPath: string): Promise<string[]> {
		try {
			const adapter = this.vault.adapter;
			if (!(await adapter.exists(dirPath))) {
				return [];
			}

			const list = await adapter.list(dirPath);
			return list.files;
		} catch (error) {
			logger.error('Failed to list files', error);
			throw new StorageError(`Failed to list files in ${dirPath}`, dirPath);
		}
	}

	/**
	 * Validate data before saving (to be implemented by subclasses)
	 */
	protected abstract validate(data: T): boolean;

	/**
	 * Get the default value for this store (to be implemented by subclasses)
	 */
	protected abstract getDefaultValue(): T;

	/**
	 * Load data from storage
	 */
	abstract load(): Promise<T>;

	/**
	 * Save data to storage
	 */
	abstract save(data: T): Promise<void>;

	/**
	 * Clear all data
	 */
	abstract clear(): Promise<void>;
}

/**
 * SingleFileStore - Stores all data in a single JSON file with caching.
 *
 * CACHE BEHAVIOR:
 * - Reads are cached for up to 2 seconds (configurable via CACHE_TTL_MS)
 * - Writes are debounced by default (1 second delay) to reduce I/O
 * - Cache does NOT auto-invalidate on external file changes
 *
 * USAGE GUIDELINES:
 * - Call flush() before app shutdown to ensure pending writes are saved
 * - Call invalidateCache() after detecting external changes
 * - Use immediate=true for critical saves (e.g., progress on pause)
 *
 * LIMITATIONS:
 * - Not suitable for multi-process scenarios without external coordination
 * - May return stale data if file synced externally within TTL window
 */
export abstract class SingleFileStore<T> extends FileSystemStore<T> {
	protected filePath: string;

	// Performance optimization: in-memory cache
	private cache: T | null = null;
	private cacheTimestamp: number = 0;
	private readonly CACHE_TTL_MS = 2000; // 2 seconds cache TTL (balance between freshness and performance)
	private isDirty: boolean = false;
	private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	private readonly SAVE_DEBOUNCE_MS = 1000; // Debounce saves by 1 second

	// Concurrent load deduplication
	private loadPromise: Promise<T> | null = null;

	constructor(
		vault: Vault,
		pathManager: DataPathManager,
		filePath: string,
		format: StorageFormat = 'json'
	) {
		super(vault, pathManager, format);
		this.filePath = normalizePath(filePath);
	}

	/**
	 * Load data from the file (with caching and concurrent load deduplication)
	 */
	async load(): Promise<T> {
		logger.methodEntry('SingleFileStore', 'load', this.filePath);

		// Deduplicate concurrent load requests
		if (this.loadPromise) {
			logger.debug('Returning existing load promise', this.filePath);
			return this.loadPromise;
		}

		// Return cached data if still valid
		const now = Date.now();
		if (this.cache !== null && (now - this.cacheTimestamp) < this.CACHE_TTL_MS) {
			logger.debug('Returning cached data', this.filePath);
			logger.methodExit('SingleFileStore', 'load', 'cached');
			return this.cache;
		}

		// Create a promise for this load operation to deduplicate concurrent requests
		this.loadPromise = this.performLoad(now);

		try {
			return await this.loadPromise;
		} finally {
			this.loadPromise = null;
		}
	}

	/**
	 * Internal method to perform the actual load
	 */
	private async performLoad(timestamp: number): Promise<T> {
		const data = await this.readJson<T>(this.filePath, this.getDefaultValue());

		if (!this.validate(data)) {
			logger.warn('Data validation failed, using default value', this.filePath);
			return this.getDefaultValue();
		}

		// Update cache
		this.cache = data;
		this.cacheTimestamp = timestamp;

		logger.methodExit('SingleFileStore', 'load');
		return data;
	}

	/**
	 * Save data to the file.
	 * By default, writes are debounced for performance.
	 * Use immediate=true for critical saves that must persist immediately.
	 *
	 * @param data - The data to save
	 * @param immediate - If true, write to disk immediately; otherwise debounce
	 */
	async save(data: T, immediate: boolean = false): Promise<void> {
		logger.methodEntry('SingleFileStore', 'save', this.filePath);

		if (!this.validate(data)) {
			throw new StorageError('Data validation failed', this.filePath);
		}

		// Update cache immediately (memory is always up-to-date)
		this.cache = data;
		this.cacheTimestamp = Date.now();
		this.isDirty = true;

		if (immediate) {
			// Critical save: write to disk immediately
			await this.flush();
		} else {
			// Normal save: debounce the file write
			this.scheduleDebouncedSave();
		}

		logger.methodExit('SingleFileStore', 'save');
	}

	/**
	 * Schedule a debounced save operation
	 */
	private scheduleDebouncedSave(): void {
		if (this.saveDebounceTimer) {
			clearTimeout(this.saveDebounceTimer);
		}

		this.saveDebounceTimer = setTimeout(async () => {
			this.saveDebounceTimer = null;
			if (this.isDirty && this.cache) {
				try {
					await this.writeJson(this.filePath, this.cache);
					this.isDirty = false;
					logger.debug('Debounced save completed', this.filePath);
				} catch (error) {
					logger.error('Debounced save failed', error);
				}
			}
		}, this.SAVE_DEBOUNCE_MS);
	}

	/**
	 * Force flush any pending saves to disk immediately.
	 * Call this before app shutdown or when you need to ensure data is persisted.
	 */
	async flush(): Promise<void> {
		// Clear any pending debounce timer
		if (this.saveDebounceTimer) {
			clearTimeout(this.saveDebounceTimer);
			this.saveDebounceTimer = null;
		}

		// Write to disk if there are pending changes
		if (this.isDirty && this.cache) {
			await this.writeJson(this.filePath, this.cache);
			this.isDirty = false;
			logger.debug('Flushed pending save', this.filePath);
		}
	}

	/**
	 * Invalidate the cache, forcing the next load() to read from disk.
	 * Call this when you detect external file changes.
	 */
	invalidateCache(): void {
		this.cache = null;
		this.cacheTimestamp = 0;
		logger.debug('Cache invalidated', this.filePath);
	}

	/**
	 * Check if there are unsaved changes
	 */
	hasPendingChanges(): boolean {
		return this.isDirty;
	}

	/**
	 * Clear all data (reset to default)
	 */
	async clear(): Promise<void> {
		logger.methodEntry('SingleFileStore', 'clear', this.filePath);

		const defaultValue = this.getDefaultValue();
		await this.save(defaultValue, true); // Use immediate save
		this.invalidateCache();

		logger.methodExit('SingleFileStore', 'clear');
	}

	/**
	 * Delete the file
	 */
	async delete(): Promise<void> {
		// Clear any pending saves first
		if (this.saveDebounceTimer) {
			clearTimeout(this.saveDebounceTimer);
			this.saveDebounceTimer = null;
		}
		this.isDirty = false;

		if (await this.fileExists(this.filePath)) {
			await this.deleteFile(this.filePath);
		}
		this.invalidateCache();
	}
}

/**
 * Multi-file store - Stores data across multiple JSON files in a directory
 */
export abstract class MultiFileStore<T, TItem> extends FileSystemStore<T> {
	protected dirPath: string;

	constructor(
		vault: Vault,
		pathManager: DataPathManager,
		dirPath: string,
		format: StorageFormat = 'json'
	) {
		super(vault, pathManager, format);
		this.dirPath = normalizePath(dirPath);
	}

	/**
	 * Get file path for an item by ID
	 */
	protected getItemFilePath(id: string): string {
		return normalizePath(`${this.dirPath}/${id}.json`);
	}

	/**
	 * Load a single item by ID
	 */
	protected async loadItem(id: string, fallback: TItem): Promise<TItem> {
		const filePath = this.getItemFilePath(id);
		return await this.readJson<TItem>(filePath, fallback);
	}

	/**
	 * Save a single item by ID
	 */
	protected async saveItem(id: string, item: TItem): Promise<void> {
		const filePath = this.getItemFilePath(id);
		await this.writeJson(filePath, item);
	}

	/**
	 * Delete a single item by ID
	 */
	protected async deleteItem(id: string): Promise<void> {
		const filePath = this.getItemFilePath(id);
		if (await this.fileExists(filePath)) {
			await this.deleteFile(filePath);
		}
	}

	/**
	 * List all item IDs
	 */
	protected async listItemIds(): Promise<string[]> {
		const files = await this.listFiles(this.dirPath);
		return files
			.filter(f => f.endsWith('.json'))
			.map(f => {
				const filename = f.split('/').pop() || '';
				return filename.replace('.json', '');
			});
	}

	/**
	 * Load all items
	 */
	protected abstract loadAllItems(): Promise<TItem[]>;

	/**
	 * Clear all data (delete all files)
	 */
	async clear(): Promise<void> {
		logger.methodEntry('MultiFileStore', 'clear', this.dirPath);

		const files = await this.listFiles(this.dirPath);
		for (const file of files) {
			await this.deleteFile(file);
		}

		logger.methodExit('MultiFileStore', 'clear');
	}
}
