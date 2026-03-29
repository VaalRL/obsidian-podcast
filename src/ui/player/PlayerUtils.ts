/**
 * PlayerUtils - Pure utility functions for the player view
 */

/**
 * Format seconds to time display (e.g. "1:23:45" or "23:45")
 */
export function formatTime(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	} else {
		return `${minutes}:${secs.toString().padStart(2, '0')}`;
	}
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
 * Format repeat mode to display string
 */
export function formatRepeatMode(mode: 'none' | 'one' | 'all'): string {
	switch (mode) {
		case 'none': return 'Off';
		case 'one': return 'One';
		case 'all': return 'All';
	}
}
