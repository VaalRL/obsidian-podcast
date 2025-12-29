/**
 * VirtualList - Virtual scrolling list component for performance optimization
 *
 * Only renders visible items to improve performance when dealing with large lists.
 * Reduces DOM nodes and improves scroll performance.
 */

import { logger } from '../utils/Logger';

/**
 * Configuration for the virtual list
 */
export interface VirtualListConfig<T> {
	/** Container element to render the list in */
	container: HTMLElement;
	/** Array of items to render */
	items: T[];
	/** Fixed height of each item in pixels */
	itemHeight: number;
	/** Number of extra items to render above/below viewport (buffer) */
	overscan?: number;
	/** Function to render a single item */
	renderItem: (item: T, index: number, container: HTMLElement) => HTMLElement;
	/** Optional: Key extractor for stable item identity */
	getKey?: (item: T, index: number) => string;
	/** Optional: Callback when visible items change */
	onVisibleRangeChange?: (startIndex: number, endIndex: number) => void;
}

/**
 * Virtual list state
 */
interface VirtualListState {
	scrollTop: number;
	viewportHeight: number;
	startIndex: number;
	endIndex: number;
}

/**
 * VirtualList class for efficient rendering of large lists
 */
export class VirtualList<T> {
	private config: Required<VirtualListConfig<T>>;
	private state: VirtualListState;
	private scrollContainer: HTMLElement;
	private contentContainer: HTMLElement;
	private spacerTop: HTMLElement;
	private spacerBottom: HTMLElement;
	private renderedElements: Map<string, HTMLElement> = new Map();
	private scrollHandler: () => void;
	private resizeObserver: ResizeObserver | null = null;
	private isDestroyed: boolean = false;

	constructor(config: VirtualListConfig<T>) {
		this.config = {
			overscan: 3,
			getKey: (_, index) => String(index),
			onVisibleRangeChange: () => {},
			...config,
		};

		this.state = {
			scrollTop: 0,
			viewportHeight: 0,
			startIndex: 0,
			endIndex: 0,
		};

		this.scrollHandler = this.throttle(this.handleScroll.bind(this), 16); // ~60fps
		this.initialize();
	}

	/**
	 * Initialize the virtual list DOM structure
	 */
	private initialize(): void {
		const { container } = this.config;

		// Clear container
		container.empty();
		container.addClass('virtual-list-wrapper');

		// Create scroll container
		this.scrollContainer = container.createDiv({ cls: 'virtual-list-scroll-container' });
		this.scrollContainer.style.height = '100%';
		this.scrollContainer.style.overflow = 'auto';
		this.scrollContainer.style.position = 'relative';

		// Create content container
		this.contentContainer = this.scrollContainer.createDiv({ cls: 'virtual-list-content' });
		this.contentContainer.style.position = 'relative';
		this.contentContainer.style.width = '100%';

		// Create spacers for maintaining scroll position
		this.spacerTop = this.contentContainer.createDiv({ cls: 'virtual-list-spacer-top' });
		this.spacerBottom = this.contentContainer.createDiv({ cls: 'virtual-list-spacer-bottom' });

		// Set initial content height
		this.updateContentHeight();

		// Add scroll listener
		this.scrollContainer.addEventListener('scroll', this.scrollHandler, { passive: true });

		// Add resize observer
		if (typeof ResizeObserver !== 'undefined') {
			this.resizeObserver = new ResizeObserver(() => {
				if (!this.isDestroyed) {
					this.updateViewport();
				}
			});
			this.resizeObserver.observe(this.scrollContainer);
		}

		// Initial render
		this.updateViewport();
	}

	/**
	 * Update the total content height
	 */
	private updateContentHeight(): void {
		const totalHeight = this.config.items.length * this.config.itemHeight;
		this.contentContainer.style.height = `${totalHeight}px`;
	}

	/**
	 * Handle scroll events
	 */
	private handleScroll(): void {
		if (this.isDestroyed) return;
		this.updateViewport();
	}

	/**
	 * Update viewport and render visible items
	 */
	private updateViewport(): void {
		const { items, itemHeight, overscan, onVisibleRangeChange } = this.config;

		const scrollTop = this.scrollContainer.scrollTop;
		const viewportHeight = this.scrollContainer.clientHeight;

		// Calculate visible range
		const visibleStartIndex = Math.floor(scrollTop / itemHeight);
		const visibleCount = Math.ceil(viewportHeight / itemHeight);

		// Add overscan
		const startIndex = Math.max(0, visibleStartIndex - overscan);
		const endIndex = Math.min(items.length - 1, visibleStartIndex + visibleCount + overscan);

		// Check if range changed
		if (startIndex !== this.state.startIndex || endIndex !== this.state.endIndex) {
			this.state = {
				scrollTop,
				viewportHeight,
				startIndex,
				endIndex,
			};

			this.renderVisibleItems();
			onVisibleRangeChange(startIndex, endIndex);
		}
	}

	/**
	 * Render only the visible items
	 */
	private renderVisibleItems(): void {
		const { items, itemHeight, renderItem, getKey } = this.config;
		const { startIndex, endIndex } = this.state;

		// Update spacers
		this.spacerTop.style.height = `${startIndex * itemHeight}px`;
		this.spacerBottom.style.height = `${(items.length - endIndex - 1) * itemHeight}px`;

		// Track which elements should remain
		const newKeys = new Set<string>();

		// Create document fragment for batch DOM operations
		const fragment = document.createDocumentFragment();
		const elementsToInsert: { key: string; element: HTMLElement; index: number }[] = [];

		// Render visible items
		for (let i = startIndex; i <= endIndex && i < items.length; i++) {
			const item = items[i];
			const key = getKey(item, i);
			newKeys.add(key);

			// Check if element already exists
			if (!this.renderedElements.has(key)) {
				// Create temporary container for rendering
				const tempContainer = document.createElement('div');
				const element = renderItem(item, i, tempContainer);

				// Set item styling for virtual positioning
				element.style.position = 'absolute';
				element.style.top = `${i * itemHeight}px`;
				element.style.left = '0';
				element.style.right = '0';
				element.style.height = `${itemHeight}px`;
				element.setAttribute('data-virtual-index', String(i));

				elementsToInsert.push({ key, element, index: i });
			} else {
				// Update position of existing element
				const element = this.renderedElements.get(key)!;
				element.style.top = `${i * itemHeight}px`;
				element.setAttribute('data-virtual-index', String(i));
			}
		}

		// Remove elements that are no longer visible
		for (const [key, element] of this.renderedElements) {
			if (!newKeys.has(key)) {
				element.remove();
				this.renderedElements.delete(key);
			}
		}

		// Add new elements
		for (const { key, element } of elementsToInsert) {
			this.renderedElements.set(key, element);
			fragment.appendChild(element);
		}

		// Insert fragment into content container
		this.contentContainer.appendChild(fragment);
	}

	/**
	 * Update the items list and re-render
	 */
	updateItems(items: T[]): void {
		if (this.isDestroyed) return;

		this.config.items = items;
		this.updateContentHeight();

		// Clear all rendered elements and re-render
		for (const element of this.renderedElements.values()) {
			element.remove();
		}
		this.renderedElements.clear();

		this.updateViewport();
	}

	/**
	 * Scroll to a specific item by index
	 */
	scrollToIndex(index: number, behavior: ScrollBehavior = 'auto'): void {
		if (this.isDestroyed) return;

		const { itemHeight, items } = this.config;
		const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
		const scrollTop = clampedIndex * itemHeight;

		this.scrollContainer.scrollTo({
			top: scrollTop,
			behavior,
		});
	}

	/**
	 * Refresh the list (re-render current visible items)
	 */
	refresh(): void {
		if (this.isDestroyed) return;

		// Clear all rendered elements
		for (const element of this.renderedElements.values()) {
			element.remove();
		}
		this.renderedElements.clear();

		// Re-render
		this.state.startIndex = -1; // Force re-render
		this.updateViewport();
	}

	/**
	 * Get the current scroll position
	 */
	getScrollTop(): number {
		return this.scrollContainer.scrollTop;
	}

	/**
	 * Get visible item count
	 */
	getVisibleCount(): number {
		return this.state.endIndex - this.state.startIndex + 1;
	}

	/**
	 * Destroy the virtual list and cleanup
	 */
	destroy(): void {
		this.isDestroyed = true;

		// Remove event listeners
		this.scrollContainer.removeEventListener('scroll', this.scrollHandler);

		// Disconnect resize observer
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}

		// Clear rendered elements
		for (const element of this.renderedElements.values()) {
			element.remove();
		}
		this.renderedElements.clear();

		// Clear container
		this.config.container.empty();

		logger.debug('VirtualList destroyed');
	}

	/**
	 * Throttle function for scroll performance
	 */
	private throttle<F extends (...args: unknown[]) => void>(fn: F, delay: number): F {
		let lastCall = 0;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		return ((...args: Parameters<F>) => {
			const now = Date.now();

			if (now - lastCall >= delay) {
				lastCall = now;
				fn(...args);
			} else if (!timeoutId) {
				timeoutId = setTimeout(() => {
					lastCall = Date.now();
					timeoutId = null;
					fn(...args);
				}, delay - (now - lastCall));
			}
		}) as F;
	}
}

/**
 * Create a simple virtual list for episode items
 * Helper function to simplify usage
 */
export function createVirtualEpisodeList<T>(
	container: HTMLElement,
	items: T[],
	itemHeight: number,
	renderItem: (item: T, index: number, container: HTMLElement) => HTMLElement
): VirtualList<T> {
	return new VirtualList({
		container,
		items,
		itemHeight,
		overscan: 5,
		renderItem,
	});
}
