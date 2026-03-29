/**
 * StatisticsCalculator - Computes aggregated listening statistics
 *
 * Pure computation logic, no DOM. Memory-conscious: single-pass over data where possible.
 */

import { PlayProgress, ListeningStatistics, PodcastListeningStats, DailyActivity } from '../../model';
import { ProgressStore } from '../../storage/ProgressStore';
import { SubscriptionStore } from '../../storage/SubscriptionStore';
import { logger } from '../../utils/Logger';

export class StatisticsCalculator {
	constructor(
		private progressStore: ProgressStore,
		private subscriptionStore: SubscriptionStore
	) {}

	/**
	 * Calculate all listening statistics
	 */
	async calculateStatistics(): Promise<ListeningStatistics> {
		try {
			const allProgress = await this.progressStore.getAllProgress();
			const podcasts = await this.subscriptionStore.getAllPodcasts();

			// Single pass: count completed, in-progress, total listening time
			let totalListeningTime = 0;
			let totalCompleted = 0;
			let totalInProgress = 0;

			// Also build per-podcast maps in the same pass
			const podcastTimeMap = new Map<string, number>();
			const podcastCompletedMap = new Map<string, number>();
			const podcastInProgressMap = new Map<string, number>();
			const podcastEpisodeCountMap = new Map<string, number>();

			for (const p of allProgress) {
				totalListeningTime += p.position;

				if (p.completed) {
					totalCompleted++;
				} else if (p.position > 0) {
					totalInProgress++;
				}

				// Per-podcast aggregation
				const pid = p.podcastId;
				podcastTimeMap.set(pid, (podcastTimeMap.get(pid) || 0) + p.position);
				podcastEpisodeCountMap.set(pid, (podcastEpisodeCountMap.get(pid) || 0) + 1);

				if (p.completed) {
					podcastCompletedMap.set(pid, (podcastCompletedMap.get(pid) || 0) + 1);
				} else if (p.position > 0) {
					podcastInProgressMap.set(pid, (podcastInProgressMap.get(pid) || 0) + 1);
				}
			}

			// Build podcast title lookup
			const podcastTitleMap = new Map<string, string>();
			const podcastImageMap = new Map<string, string | undefined>();
			for (const pod of podcasts) {
				podcastTitleMap.set(pod.id, pod.title);
				podcastImageMap.set(pod.id, pod.imageUrl);
			}

			// Build podcastBreakdown
			const podcastBreakdown: PodcastListeningStats[] = [];
			for (const [pid, time] of podcastTimeMap) {
				podcastBreakdown.push({
					podcastId: pid,
					podcastTitle: podcastTitleMap.get(pid) || 'Unknown Podcast',
					imageUrl: podcastImageMap.get(pid),
					totalListeningTime: time,
					completedEpisodes: podcastCompletedMap.get(pid) || 0,
					inProgressEpisodes: podcastInProgressMap.get(pid) || 0,
					totalEpisodes: podcastEpisodeCountMap.get(pid) || 0,
				});
			}

			// Sort by listening time descending
			podcastBreakdown.sort((a, b) => b.totalListeningTime - a.totalListeningTime);

			const streaks = this.calculateStreaks(allProgress);
			const dailyActivity = this.calculateDailyActivity(allProgress, 30);

			const activeDays = dailyActivity.filter(d => d.listeningTimeSeconds > 0).length;
			const averageDailyListeningTime = activeDays > 0 ? totalListeningTime / activeDays : 0;

			return {
				totalListeningTime,
				totalCompleted,
				totalInProgress,
				totalPodcasts: podcasts.length,
				podcastBreakdown,
				currentStreak: streaks.current,
				longestStreak: streaks.longest,
				dailyActivity,
				averageDailyListeningTime,
			};
		} catch (error) {
			logger.error('StatisticsCalculator: Failed to calculate statistics', error);
			return {
				totalListeningTime: 0,
				totalCompleted: 0,
				totalInProgress: 0,
				totalPodcasts: 0,
				podcastBreakdown: [],
				currentStreak: 0,
				longestStreak: 0,
				dailyActivity: [],
				averageDailyListeningTime: 0,
			};
		}
	}

	/**
	 * Calculate listening streaks from progress data
	 */
	calculateStreaks(progressData: PlayProgress[]): { current: number; longest: number } {
		if (progressData.length === 0) return { current: 0, longest: 0 };

		// Collect unique dates (YYYY-MM-DD local timezone)
		const dateSet = new Set<string>();
		for (const p of progressData) {
			if (p.position > 0) {
				const d = new Date(p.lastPlayedAt);
				dateSet.add(this.toDateKey(d));
			}
		}

		if (dateSet.size === 0) return { current: 0, longest: 0 };

		// Sort ascending
		const dates = [...dateSet].sort();

		let longest = 1;
		let currentRun = 1;

		for (let i = 1; i < dates.length; i++) {
			if (this.isConsecutiveDay(dates[i - 1], dates[i])) {
				currentRun++;
				if (currentRun > longest) longest = currentRun;
			} else {
				currentRun = 1;
			}
		}

		// Current streak: must end at today or yesterday
		const today = this.toDateKey(new Date());
		const yesterday = this.toDateKey(new Date(Date.now() - 86_400_000));
		const lastDate = dates[dates.length - 1];

		let current = 0;
		if (lastDate === today || lastDate === yesterday) {
			current = 1;
			for (let i = dates.length - 2; i >= 0; i--) {
				if (this.isConsecutiveDay(dates[i], dates[i + 1])) {
					current++;
				} else {
					break;
				}
			}
		}

		return { current, longest };
	}

	/**
	 * Calculate daily activity for the last N days
	 */
	calculateDailyActivity(progressData: PlayProgress[], days: number): DailyActivity[] {
		const now = new Date();
		const startDate = new Date(now.getTime() - (days - 1) * 86_400_000);

		// Build date → aggregated data map
		const dayMap = new Map<string, { time: number; episodes: Set<string> }>();

		for (const p of progressData) {
			if (p.position <= 0) continue;
			const d = new Date(p.lastPlayedAt);
			const key = this.toDateKey(d);
			const existing = dayMap.get(key);
			if (existing) {
				existing.time += p.position;
				existing.episodes.add(p.episodeId);
			} else {
				dayMap.set(key, { time: p.position, episodes: new Set([p.episodeId]) });
			}
		}

		// Generate array for last N days
		const result: DailyActivity[] = [];
		for (let i = 0; i < days; i++) {
			const date = new Date(startDate.getTime() + i * 86_400_000);
			const key = this.toDateKey(date);
			const data = dayMap.get(key);
			result.push({
				date: key,
				listeningTimeSeconds: data?.time || 0,
				episodesPlayed: data?.episodes.size || 0,
			});
		}

		return result;
	}

	private toDateKey(date: Date): string {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}

	private isConsecutiveDay(dateA: string, dateB: string): boolean {
		const a = new Date(dateA + 'T00:00:00');
		const b = new Date(dateB + 'T00:00:00');
		const diff = b.getTime() - a.getTime();
		return diff === 86_400_000;
	}
}
