/**
 * SidebarUtils - Pure utility functions for sidebar filtering, sorting, and formatting
 */

import { Podcast, Episode, Playlist } from '../../model';
import { EpisodeStatistics } from '../../podcast/EpisodeManager';

/**
 * Filter podcasts based on search query
 */
export function filterPodcasts(podcasts: Podcast[], query: string): Podcast[] {
	const lowerQuery = query.toLowerCase();
	return podcasts.filter(podcast => {
		if (podcast.title.toLowerCase().includes(lowerQuery)) {
			return true;
		}
		if (podcast.author?.toLowerCase().includes(lowerQuery)) {
			return true;
		}
		if (podcast.description?.toLowerCase().includes(lowerQuery)) {
			return true;
		}
		return false;
	});
}

/**
 * Filter episodes based on search query
 */
export function filterEpisodes(episodes: Episode[], query: string): Episode[] {
	const lowerQuery = query.toLowerCase();
	return episodes.filter(episode => {
		if (episode.title.toLowerCase().includes(lowerQuery)) {
			return true;
		}
		if (episode.description?.toLowerCase().includes(lowerQuery)) {
			return true;
		}
		return false;
	});
}

/**
 * Filter playlists based on search query
 */
export function filterPlaylists(playlists: Playlist[], query: string): Playlist[] {
	const lowerQuery = query.toLowerCase();
	return playlists.filter(playlist => {
		if (playlist.name.toLowerCase().includes(lowerQuery)) {
			return true;
		}
		if (playlist.description?.toLowerCase().includes(lowerQuery)) {
			return true;
		}
		return false;
	});
}

/**
 * Get the latest episode publish date for a podcast (as timestamp)
 */
export function getLatestEpisodeDate(podcast: Podcast): number {
	if (!podcast.episodes || podcast.episodes.length === 0) {
		return 0;
	}

	const dates = podcast.episodes.map(ep => new Date(ep.publishDate).getTime());
	return Math.max(...dates);
}

/**
 * Sort podcasts based on criteria
 */
export function sortPodcasts(
	podcasts: Podcast[],
	sortBy: 'title' | 'author' | 'date' | 'count' | 'unplayed' | 'latest',
	direction: 'asc' | 'desc',
	podcastStats: Map<string, EpisodeStatistics>
): Podcast[] {
	const sorted = [...podcasts].sort((a, b) => {
		let comparison = 0;

		switch (sortBy) {
			case 'title':
				comparison = a.title.localeCompare(b.title);
				break;
			case 'author':
				comparison = (a.author || '').localeCompare(b.author || '');
				break;
			case 'date': {
				const aDate = new Date(a.subscribedAt).getTime();
				const bDate = new Date(b.subscribedAt).getTime();
				comparison = aDate - bDate;
				break;
			}
			case 'latest': {
				const aLatest = getLatestEpisodeDate(a);
				const bLatest = getLatestEpisodeDate(b);
				comparison = aLatest - bLatest;
				break;
			}
			case 'count': {
				const aCount = podcastStats.get(a.id)?.totalEpisodes || 0;
				const bCount = podcastStats.get(b.id)?.totalEpisodes || 0;
				comparison = aCount - bCount;
				break;
			}
			case 'unplayed': {
				const aUnplayed = podcastStats.get(a.id)?.unplayedEpisodes || 0;
				const bUnplayed = podcastStats.get(b.id)?.unplayedEpisodes || 0;
				comparison = aUnplayed - bUnplayed;
				break;
			}
		}

		return direction === 'asc' ? comparison : -comparison;
	});

	return sorted;
}

/**
 * Sort episodes based on criteria
 */
export function sortEpisodes(
	episodes: Episode[],
	sortBy: 'title' | 'date' | 'duration',
	direction: 'asc' | 'desc'
): Episode[] {
	const sorted = [...episodes].sort((a, b) => {
		let comparison = 0;

		switch (sortBy) {
			case 'title':
				comparison = a.title.localeCompare(b.title);
				break;
			case 'date': {
				const aDate = new Date(a.publishDate).getTime();
				const bDate = new Date(b.publishDate).getTime();
				comparison = aDate - bDate;
				break;
			}
			case 'duration':
				comparison = a.duration - b.duration;
				break;
		}

		return direction === 'asc' ? comparison : -comparison;
	});

	return sorted;
}

/**
 * Sort playlists based on criteria
 */
export function sortPlaylists(
	playlists: Playlist[],
	sortBy: 'name' | 'date' | 'count',
	direction: 'asc' | 'desc'
): Playlist[] {
	const sorted = [...playlists].sort((a, b) => {
		let comparison = 0;

		switch (sortBy) {
			case 'name':
				comparison = a.name.localeCompare(b.name);
				break;
			case 'date': {
				const aDate = new Date(a.createdAt).getTime();
				const bDate = new Date(b.createdAt).getTime();
				comparison = aDate - bDate;
				break;
			}
			case 'count':
				comparison = a.episodeIds.length - b.episodeIds.length;
				break;
		}

		return direction === 'asc' ? comparison : -comparison;
	});

	return sorted;
}

/**
 * Format duration in seconds to human-readable string (e.g. "1h 23m")
 */
export function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	} else {
		return `${minutes}m`;
	}
}

/**
 * Format date to relative time string
 */
export function formatDate(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - new Date(date).getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) {
		return 'today';
	} else if (diffDays === 1) {
		return 'yesterday';
	} else if (diffDays < 7) {
		return `${diffDays} days ago`;
	} else if (diffDays < 30) {
		const weeks = Math.floor(diffDays / 7);
		return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
	} else {
		const months = Math.floor(diffDays / 30);
		return `${months} month${months > 1 ? 's' : ''} ago`;
	}
}
