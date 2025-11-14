/**
 * Time Utilities
 *
 * Provides time formatting and manipulation utilities for the Podcast Player plugin.
 */

/**
 * Format seconds to HH:MM:SS or MM:SS format
 *
 * @param seconds - Total seconds
 * @param alwaysShowHours - Always show hours even if 0
 * @returns Formatted time string (e.g., "1:23:45" or "23:45")
 */
export function formatTime(seconds: number, alwaysShowHours = false): string {
	if (!isFinite(seconds) || seconds < 0) {
		return '0:00';
	}

	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	const paddedMinutes = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
	const paddedSeconds = String(secs).padStart(2, '0');

	if (hours > 0 || alwaysShowHours) {
		return `${hours}:${paddedMinutes}:${paddedSeconds}`;
	}

	return `${paddedMinutes}:${paddedSeconds}`;
}

/**
 * Format seconds to a human-readable duration (e.g., "1h 23m" or "45m 30s")
 *
 * @param seconds - Total seconds
 * @param short - Use short format (h/m/s) instead of long format (hours/minutes/seconds)
 * @returns Formatted duration string
 */
export function formatDuration(seconds: number, short = true): string {
	if (!isFinite(seconds) || seconds < 0) {
		return short ? '0s' : '0 seconds';
	}

	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	const parts: string[] = [];

	if (hours > 0) {
		parts.push(short ? `${hours}h` : `${hours} hour${hours > 1 ? 's' : ''}`);
	}

	if (minutes > 0) {
		parts.push(short ? `${minutes}m` : `${minutes} minute${minutes > 1 ? 's' : ''}`);
	}

	if (secs > 0 || parts.length === 0) {
		parts.push(short ? `${secs}s` : `${secs} second${secs > 1 ? 's' : ''}`);
	}

	return parts.join(' ');
}

/**
 * Parse a time string (HH:MM:SS or MM:SS) to seconds
 *
 * @param timeString - Time string to parse
 * @returns Total seconds, or null if invalid
 */
export function parseTimeString(timeString: string): number | null {
	const parts = timeString.split(':').map(p => parseInt(p, 10));

	if (parts.length < 2 || parts.length > 3 || parts.some(isNaN)) {
		return null;
	}

	if (parts.length === 2) {
		// MM:SS
		const [minutes, seconds] = parts;
		return minutes * 60 + seconds;
	} else {
		// HH:MM:SS
		const [hours, minutes, seconds] = parts;
		return hours * 3600 + minutes * 60 + seconds;
	}
}

/**
 * Format a timestamp for use in markdown (e.g., "[12:34]")
 *
 * @param seconds - Position in seconds
 * @returns Formatted timestamp
 */
export function formatTimestamp(seconds: number): string {
	return `[${formatTime(seconds)}]`;
}

/**
 * Format a date to a relative time string (e.g., "2 hours ago", "3 days ago")
 *
 * @param date - Date to format
 * @returns Relative time string
 */
export function formatRelativeTime(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);
	const diffWeeks = Math.floor(diffDays / 7);
	const diffMonths = Math.floor(diffDays / 30);
	const diffYears = Math.floor(diffDays / 365);

	if (diffSeconds < 60) {
		return 'just now';
	} else if (diffMinutes < 60) {
		return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
	} else if (diffHours < 24) {
		return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
	} else if (diffDays < 7) {
		return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
	} else if (diffWeeks < 4) {
		return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
	} else if (diffMonths < 12) {
		return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
	} else {
		return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
	}
}

/**
 * Format a date to a short date string (e.g., "Jan 15, 2024")
 *
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
	const options: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	};
	return date.toLocaleDateString(undefined, options);
}

/**
 * Format a date to a full date and time string (e.g., "Jan 15, 2024 at 3:45 PM")
 *
 * @param date - Date to format
 * @returns Formatted date and time string
 */
export function formatDateTime(date: Date): string {
	const options: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	};
	return date.toLocaleDateString(undefined, options);
}

/**
 * Calculate the percentage of progress
 *
 * @param current - Current position
 * @param total - Total duration
 * @returns Percentage (0-100)
 */
export function calculateProgress(current: number, total: number): number {
	if (total <= 0) return 0;
	return Math.min(100, Math.max(0, (current / total) * 100));
}

/**
 * Check if a date is today
 *
 * @param date - Date to check
 * @returns True if the date is today
 */
export function isToday(date: Date): boolean {
	const today = new Date();
	return (
		date.getDate() === today.getDate() &&
		date.getMonth() === today.getMonth() &&
		date.getFullYear() === today.getFullYear()
	);
}

/**
 * Check if a date is within the last N days
 *
 * @param date - Date to check
 * @param days - Number of days
 * @returns True if the date is within the last N days
 */
export function isWithinDays(date: Date, days: number): boolean {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = diffMs / (1000 * 60 * 60 * 24);
	return diffDays <= days;
}
