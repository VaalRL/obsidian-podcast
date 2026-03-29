/**
 * StatisticsView - Listening statistics dashboard
 *
 * Displays aggregated listening stats: total time, streaks, activity chart,
 * and per-podcast breakdown. Registered as an ItemView in main.ts.
 */

import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian';
import type PodcastPlayerPlugin from '../../main';
import { StatisticsCalculator } from './statistics/StatisticsCalculator';
import { renderOverviewCards, renderStreaks, renderActivityChart, renderPodcastBreakdown } from './statistics';
import { logger } from '../utils/Logger';

export const STATISTICS_VIEW_TYPE = 'podcast-statistics-view';

export class StatisticsView extends ItemView {
	plugin: PodcastPlayerPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: PodcastPlayerPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return STATISTICS_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Listening Statistics';
	}

	getIcon(): string {
		return 'bar-chart-2';
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('podcast-statistics-view');

		await this.renderStatistics(container);
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	async onClose(): Promise<void> {
		// No cleanup needed
	}

	private async renderStatistics(container: HTMLElement): Promise<void> {
		container.empty();

		// Header with refresh button
		const header = container.createDiv({ cls: 'stats-header' });
		header.createEl('h2', { text: 'Listening Statistics' });

		const refreshBtn = header.createEl('button', {
			cls: 'stats-refresh-btn clickable-icon',
			attr: { 'aria-label': 'Refresh statistics' }
		});
		setIcon(refreshBtn, 'refresh-cw');
		refreshBtn.addEventListener('click', () => {
			void this.renderStatistics(container);
		});

		// Loading state
		const loadingEl = container.createDiv({ cls: 'stats-loading' });
		loadingEl.createSpan({ text: 'Calculating statistics...' });

		try {
			const calculator = new StatisticsCalculator(
				this.plugin.getProgressStore(),
				this.plugin.getSubscriptionStore()
			);
			const stats = await calculator.calculateStatistics();

			// Remove loading
			loadingEl.remove();

			const contentEl = container.createDiv({ cls: 'podcast-statistics-content' });

			renderOverviewCards(contentEl, stats);
			renderStreaks(contentEl, stats);
			renderActivityChart(contentEl, stats.dailyActivity);
			renderPodcastBreakdown(contentEl, stats.podcastBreakdown);
		} catch (error) {
			loadingEl.remove();
			logger.error('Failed to render statistics', error);
			container.createDiv({ text: 'Failed to load statistics.', cls: 'stats-error' });
		}
	}
}
