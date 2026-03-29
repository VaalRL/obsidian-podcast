/**
 * StatisticsRenderer - Pure rendering functions for the statistics dashboard
 *
 * Builds DOM using Obsidian's createDiv/createEl API. CSS-only charts (no external libs).
 */

import { setIcon } from 'obsidian';
import { ListeningStatistics, PodcastListeningStats, DailyActivity } from '../../model';
import { formatDuration } from '../../utils/timeUtils';

/**
 * Format listening time as human-friendly string (e.g., "12h 34m" or "< 1m")
 */
function formatListeningTime(seconds: number): string {
	if (seconds < 60) return '< 1m';
	return formatDuration(seconds);
}

/**
 * Render overview cards: total time, completed, in-progress, subscriptions
 */
export function renderOverviewCards(container: HTMLElement, stats: ListeningStatistics): void {
	const section = container.createDiv({ cls: 'stats-section' });
	section.createEl('h3', { text: 'Overview', cls: 'stats-section-header' });

	const grid = section.createDiv({ cls: 'stats-overview' });

	const cards: Array<{ icon: string; value: string; label: string }> = [
		{ icon: 'clock', value: formatListeningTime(stats.totalListeningTime), label: 'Total Listening Time' },
		{ icon: 'check-circle', value: String(stats.totalCompleted), label: 'Episodes Completed' },
		{ icon: 'headphones', value: String(stats.totalInProgress), label: 'In Progress' },
		{ icon: 'rss', value: String(stats.totalPodcasts), label: 'Podcasts Subscribed' },
	];

	for (const card of cards) {
		const cardEl = grid.createDiv({ cls: 'stats-card' });
		const iconEl = cardEl.createDiv({ cls: 'stats-card-icon' });
		setIcon(iconEl, card.icon);
		cardEl.createDiv({ text: card.value, cls: 'stats-card-value' });
		cardEl.createDiv({ text: card.label, cls: 'stats-card-label' });
	}
}

/**
 * Render streak display: current and longest
 */
export function renderStreaks(container: HTMLElement, stats: ListeningStatistics): void {
	const section = container.createDiv({ cls: 'stats-section' });
	section.createEl('h3', { text: 'Listening Streaks', cls: 'stats-section-header' });

	const grid = section.createDiv({ cls: 'stats-streaks' });

	const currentEl = grid.createDiv({ cls: 'stats-streak-current' });
	const currentIcon = currentEl.createDiv({ cls: 'stats-card-icon' });
	setIcon(currentIcon, 'flame');
	currentEl.createDiv({ text: `${stats.currentStreak} day${stats.currentStreak !== 1 ? 's' : ''}`, cls: 'stats-streak-value' });
	currentEl.createDiv({ text: 'Current Streak', cls: 'stats-streak-label' });

	const longestEl = grid.createDiv({ cls: 'stats-streak-longest' });
	const longestIcon = longestEl.createDiv({ cls: 'stats-card-icon' });
	setIcon(longestIcon, 'trophy');
	longestEl.createDiv({ text: `${stats.longestStreak} day${stats.longestStreak !== 1 ? 's' : ''}`, cls: 'stats-streak-value' });
	longestEl.createDiv({ text: 'Longest Streak', cls: 'stats-streak-label' });

	// Average daily
	const avgEl = grid.createDiv({ cls: 'stats-streak-longest' });
	const avgIcon = avgEl.createDiv({ cls: 'stats-card-icon' });
	setIcon(avgIcon, 'bar-chart-2');
	avgEl.createDiv({ text: formatListeningTime(stats.averageDailyListeningTime), cls: 'stats-streak-value' });
	avgEl.createDiv({ text: 'Avg per Active Day', cls: 'stats-streak-label' });
}

/**
 * Render CSS-only activity bar chart for the last 30 days
 */
export function renderActivityChart(container: HTMLElement, dailyActivity: DailyActivity[]): void {
	if (dailyActivity.length === 0) return;

	const section = container.createDiv({ cls: 'stats-section' });
	section.createEl('h3', { text: 'Activity (Last 30 Days)', cls: 'stats-section-header' });

	const chartContainer = section.createDiv({ cls: 'stats-activity-chart' });

	// Find max for scaling
	let maxTime = 0;
	for (const day of dailyActivity) {
		if (day.listeningTimeSeconds > maxTime) maxTime = day.listeningTimeSeconds;
	}

	if (maxTime === 0) {
		chartContainer.createDiv({ text: 'No listening activity in the last 30 days', cls: 'stats-empty-message' });
		return;
	}

	const barsContainer = chartContainer.createDiv({ cls: 'stats-activity-bars' });

	for (const day of dailyActivity) {
		const barWrapper = barsContainer.createDiv({ cls: 'stats-activity-bar-container' });

		const bar = barWrapper.createDiv({ cls: 'stats-activity-bar' });
		const heightPercent = maxTime > 0 ? (day.listeningTimeSeconds / maxTime) * 100 : 0;
		const fill = bar.createDiv({ cls: 'stats-activity-bar-fill' });
		fill.setCssProps({ height: `${heightPercent}%` });

		// Tooltip
		const tooltip = formatListeningTime(day.listeningTimeSeconds);
		const dateLabel = day.date.slice(5); // MM-DD
		barWrapper.setAttribute('aria-label', `${dateLabel}: ${tooltip}`);
		barWrapper.setAttribute('title', `${dateLabel}: ${tooltip}`);
	}

	// Labels: show first, middle, last dates
	const labelsRow = chartContainer.createDiv({ cls: 'stats-activity-labels' });
	if (dailyActivity.length > 0) {
		labelsRow.createSpan({ text: dailyActivity[0].date.slice(5), cls: 'stats-activity-label' });
		const midIdx = Math.floor(dailyActivity.length / 2);
		labelsRow.createSpan({ text: dailyActivity[midIdx].date.slice(5), cls: 'stats-activity-label' });
		labelsRow.createSpan({ text: dailyActivity[dailyActivity.length - 1].date.slice(5), cls: 'stats-activity-label' });
	}
}

/**
 * Render per-podcast breakdown sorted by listening time
 */
export function renderPodcastBreakdown(container: HTMLElement, breakdown: PodcastListeningStats[]): void {
	if (breakdown.length === 0) return;

	const section = container.createDiv({ cls: 'stats-section' });
	section.createEl('h3', { text: 'Per-Podcast Breakdown', cls: 'stats-section-header' });

	const list = section.createDiv({ cls: 'stats-podcast-breakdown' });

	for (const pod of breakdown) {
		const item = list.createDiv({ cls: 'stats-podcast-item' });

		const info = item.createDiv({ cls: 'stats-podcast-info' });
		info.createDiv({ text: pod.podcastTitle, cls: 'stats-podcast-name' });

		const statsLine = info.createDiv({ cls: 'stats-podcast-stats' });
		statsLine.createSpan({ text: formatListeningTime(pod.totalListeningTime) });
		statsLine.createSpan({ text: ' · ' });
		statsLine.createSpan({ text: `${pod.completedEpisodes}/${pod.totalEpisodes} episodes` });

		// Completion progress bar
		const progressContainer = item.createDiv({ cls: 'stats-podcast-progress-bar' });
		const progressFill = progressContainer.createDiv({ cls: 'stats-podcast-progress-fill' });
		const pct = pod.totalEpisodes > 0 ? (pod.completedEpisodes / pod.totalEpisodes) * 100 : 0;
		progressFill.setCssProps({ width: `${Math.min(100, pct)}%` });
	}
}
