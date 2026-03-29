/**
 * ProgressRenderer - Renders the progress bar with seek functionality
 *
 * Handles mouse drag, touch events, keyboard seek, and tooltip display.
 * Extracted from PlayerView to reduce file size and improve modularity.
 */

import type { PlayerContext } from './PlayerContext';

/**
 * Render the progress section (progress bar, current/total time, tooltip)
 */
export function renderProgressSection(container: HTMLElement, ctx: PlayerContext): void {
	const progressSection = container.createDiv({ cls: 'progress-section' });

	// Current time (Start)
	progressSection.createSpan({ text: '0:00', cls: 'current-time' });

	// Progress bar container
	const progressBarContainer = progressSection.createDiv({ cls: 'progress-bar-container' });
	progressBarContainer.setAttribute('tabindex', '0');
	progressBarContainer.setAttribute('aria-label', 'Seek slider');
	progressBarContainer.setAttribute('role', 'slider');

	const progressBar = progressBarContainer.createDiv({ cls: 'progress-bar' });
	progressBar.createDiv({ cls: 'progress-fill podcast-progress-width-0' });

	// Thumb element for precise positioning
	progressBar.createDiv({ cls: 'progress-bar-thumb podcast-progress-left-0' });

	// Tooltip
	const tooltip = progressBarContainer.createDiv({ cls: 'progress-tooltip' });
	tooltip.textContent = '0:00';

	// Helper function to get X coordinate from mouse or touch event
	const getClientX = (e: MouseEvent | TouchEvent): number => {
		if ('touches' in e) {
			return e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX ?? 0;
		}
		return e.clientX;
	};

	// Unified handler for both mouse and touch interactions
	const handleProgressInteraction = (startEvent: MouseEvent | TouchEvent) => {
		startEvent.preventDefault();
		progressBarContainer.focus();

		const playerController = ctx.plugin.playerController;
		const state = playerController.getState();
		if (!state.currentEpisode) return;

		ctx.setIsDraggingProgress(true);
		const duration = state.currentEpisode.duration;

		const updateUI = (clientX: number): number => {
			const rect = progressBarContainer.getBoundingClientRect();
			const clickX = clientX - rect.left;
			const percentage = Math.max(0, Math.min(1, clickX / rect.width));

			const progressFill = progressBarContainer.querySelector('.progress-fill') as HTMLElement;
			const progressThumb = progressBarContainer.querySelector('.progress-bar-thumb') as HTMLElement;
			const currentTimeEl = ctx.playerContentEl.querySelector('.current-time') as HTMLElement;

			if (progressFill) progressFill.setCssProps({ 'width': `${percentage * 100}%` });
			if (progressThumb) progressThumb.setCssProps({ 'left': `${percentage * 100}%` });
			if (currentTimeEl) currentTimeEl.textContent = ctx.formatTime(duration * percentage);

			return percentage;
		};

		// Initial update
		let finalPercentage = updateUI(getClientX(startEvent));

		const onMove = (moveEvent: MouseEvent | TouchEvent) => {
			if (ctx.getIsDraggingProgress()) {
				finalPercentage = updateUI(getClientX(moveEvent));
			}
		};

		const onEnd = () => {
			ctx.setIsDraggingProgress(false);
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onEnd);
			document.removeEventListener('touchmove', onMove);
			document.removeEventListener('touchend', onEnd);
			document.removeEventListener('touchcancel', onEnd);

			// Commit seek
			playerController.seek(duration * finalPercentage);
		};

		// Add appropriate listeners based on event type
		if ('touches' in startEvent) {
			document.addEventListener('touchmove', onMove, { passive: false });
			document.addEventListener('touchend', onEnd);
			document.addEventListener('touchcancel', onEnd);
		} else {
			document.addEventListener('mousemove', onMove);
			document.addEventListener('mouseup', onEnd);
		}
	};

	// Make progress bar draggable and clickable (mouse events)
	progressBarContainer.addEventListener('mousedown', handleProgressInteraction);

	// Touch events for mobile support
	progressBarContainer.addEventListener('touchstart', handleProgressInteraction, { passive: false });

	// Keyboard controls
	progressBarContainer.addEventListener('keydown', (e) => {
		const playerController = ctx.plugin.playerController;
		const state = playerController.getState();
		if (!state.currentEpisode) return;

		const duration = state.currentEpisode.duration;
		const currentPosition = state.position;
		let newPosition = currentPosition;

		switch (e.key) {
			case 'ArrowLeft':
				e.preventDefault();
				newPosition = Math.max(0, currentPosition - 5);
				break;
			case 'ArrowRight':
				e.preventDefault();
				newPosition = Math.min(duration, currentPosition + 5);
				break;
			case 'Home':
				e.preventDefault();
				newPosition = 0;
				break;
			case 'End':
				e.preventDefault();
				newPosition = duration;
				break;
			default:
				return;
		}

		playerController.seek(newPosition);
	});

	// Tooltip behavior
	progressBarContainer.addEventListener('mousemove', (e) => {
		const playerController = ctx.plugin.playerController;
		const state = playerController.getState();
		if (!state.currentEpisode) return;

		const rect = progressBarContainer.getBoundingClientRect();
		const hoverX = e.clientX - rect.left;
		const percentage = Math.max(0, Math.min(1, hoverX / rect.width));
		const duration = state.currentEpisode.duration;

		tooltip.textContent = ctx.formatTime(duration * percentage);
		tooltip.setCssProps({ 'left': `${percentage * 100}%` });
	});

	// Total time (End)
	progressSection.createSpan({ text: '0:00', cls: 'total-time' });
}
