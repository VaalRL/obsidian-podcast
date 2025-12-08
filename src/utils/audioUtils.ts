/**
 * Audio Utilities
 *
 * Provides audio-related utilities for the Podcast Player plugin.
 */

/**
 * Validate a playback speed value
 *
 * @param speed - Playback speed to validate
 * @returns Clamped speed value between 0.5 and 3.0
 */
export function validatePlaybackSpeed(speed: number): number {
	return Math.max(0.5, Math.min(3.0, speed));
}

/**
 * Validate a volume value
 *
 * @param volume - Volume to validate
 * @returns Clamped volume value between 0.0 and 1.0
 */
export function validateVolume(volume: number): number {
	return Math.max(0.0, Math.min(1.0, volume));
}

/**
 * Common playback speed presets
 */
export const PLAYBACK_SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

/**
 * Get the next playback speed from presets
 *
 * @param currentSpeed - Current playback speed
 * @returns Next speed in the preset list, or wraps to first preset
 */
export function getNextPlaybackSpeed(currentSpeed: number): number {
	const index = PLAYBACK_SPEED_PRESETS.findIndex(speed => speed > currentSpeed);
	if (index === -1) {
		return PLAYBACK_SPEED_PRESETS[0];
	}
	return PLAYBACK_SPEED_PRESETS[index];
}

/**
 * Get the previous playback speed from presets
 *
 * @param currentSpeed - Current playback speed
 * @returns Previous speed in the preset list, or wraps to last preset
 */
export function getPreviousPlaybackSpeed(currentSpeed: number): number {
	const index = PLAYBACK_SPEED_PRESETS.findIndex(speed => speed >= currentSpeed);
	if (index <= 0) {
		return PLAYBACK_SPEED_PRESETS[PLAYBACK_SPEED_PRESETS.length - 1];
	}
	return PLAYBACK_SPEED_PRESETS[index - 1];
}

/**
 * Format playback speed for display (e.g., "1.5x", "Normal")
 *
 * @param speed - Playback speed
 * @returns Formatted speed string
 */
export function formatPlaybackSpeed(speed: number): string {
	if (speed === 1.0) {
		return 'Normal';
	}
	return `${speed.toFixed(2)}x`;
}

/**
 * Check if an audio format is supported by the browser
 *
 * @param mimeType - MIME type to check (e.g., 'audio/mpeg', 'audio/mp4')
 * @returns True if the format is supported
 */
export function isAudioFormatSupported(mimeType: string): boolean {
	const audio = document.createElement('audio');
	return audio.canPlayType(mimeType) !== '';
}

/**
 * Get supported audio formats
 *
 * @returns Array of supported MIME types
 */
export function getSupportedAudioFormats(): string[] {
	const formats = [
		'audio/mpeg',      // MP3
		'audio/mp4',       // M4A, AAC
		'audio/ogg',       // OGG
		'audio/wav',       // WAV
		'audio/webm',      // WEBM
		'audio/flac',      // FLAC
	];

	return formats.filter(format => isAudioFormatSupported(format));
}

/**
 * Extract file extension from audio URL
 *
 * @param url - Audio URL
 * @returns File extension (without dot) or null
 */
export function getAudioExtension(url: string): string | null {
	try {
		const urlObj = new URL(url);
		const pathname = urlObj.pathname;
		const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
		return match ? match[1].toLowerCase() : null;
	} catch {
		return null;
	}
}

/**
 * Guess MIME type from file extension
 *
 * @param extension - File extension (with or without dot)
 * @returns MIME type or null
 */
export function guessMimeType(extension: string): string | null {
	const ext = extension.toLowerCase().replace(/^\./, '');
	const mimeTypes: Record<string, string> = {
		'mp3': 'audio/mpeg',
		'mp4': 'audio/mp4',
		'm4a': 'audio/mp4',
		'aac': 'audio/aac',
		'ogg': 'audio/ogg',
		'oga': 'audio/ogg',
		'wav': 'audio/wav',
		'webm': 'audio/webm',
		'flac': 'audio/flac',
		'opus': 'audio/opus',
	};

	return mimeTypes[ext] || null;
}

/**
 * Calculate skip positions (forward/backward)
 */
export const SKIP_INTERVALS = {
	SHORT: 15,   // 15 seconds
	MEDIUM: 30,  // 30 seconds
	LONG: 60,    // 1 minute
};

/**
 * Calculate the position after skipping forward
 *
 * @param currentPosition - Current position in seconds
 * @param duration - Total duration in seconds
 * @param skipAmount - Amount to skip in seconds (default: 15)
 * @returns New position, clamped to duration
 */
export function skipForward(
	currentPosition: number,
	duration: number,
	skipAmount = SKIP_INTERVALS.SHORT
): number {
	return Math.min(duration, currentPosition + skipAmount);
}

/**
 * Calculate the position after skipping backward
 *
 * @param currentPosition - Current position in seconds
 * @param skipAmount - Amount to skip in seconds (default: 15)
 * @returns New position, clamped to 0
 */
export function skipBackward(
	currentPosition: number,
	skipAmount = SKIP_INTERVALS.SHORT
): number {
	return Math.max(0, currentPosition - skipAmount);
}

/**
 * Check if an episode is considered "completed"
 * (played to within N seconds of the end)
 *
 * @param position - Current position in seconds
 * @param duration - Total duration in seconds
 * @param threshold - Threshold in seconds (default: 30)
 * @returns True if the episode is considered completed
 */
export function isEpisodeCompleted(
	position: number,
	duration: number,
	threshold = 30
): boolean {
	if (duration <= 0) return false;
	return duration - position <= threshold;
}

/**
 * Normalize volume for different volume scales
 * (some systems use 0-100, we use 0-1)
 *
 * @param volume - Volume value
 * @param maxValue - Maximum value of the input scale (default: 100)
 * @returns Normalized volume (0-1)
 */
export function normalizeVolume(volume: number, maxValue = 100): number {
	return validateVolume(volume / maxValue);
}

/**
 * Convert volume to percentage
 *
 * @param volume - Volume value (0-1)
 * @returns Percentage (0-100)
 */
export function volumeToPercentage(volume: number): number {
	return Math.round(volume * 100);
}
