/**
 * PlaybackControlsRenderer - Renders playback control buttons and advanced controls
 *
 * Extracted from PlayerView to reduce file size and improve modularity.
 */

import { setIcon } from 'obsidian';
import type { PlayerContext } from './PlayerContext';

/**
 * Render playback controls (play/pause, skip, prev/next, add note)
 */
export function renderPlaybackControls(container: HTMLElement, ctx: PlayerContext): void {
	const controlsSection = container.createDiv({ cls: 'playback-controls-section' });

	// Previous button
	const prevBtn = controlsSection.createEl('button', {
		cls: 'player-button player-button-prev clickable-icon',
		attr: { 'aria-label': 'Previous episode' }
	});
	setIcon(prevBtn, 'skip-back');
	prevBtn.addEventListener('click', () => void ctx.onPrevious());

	// Skip backward button
	const skipBackBtn = controlsSection.createEl('button', {
		cls: 'player-button player-button-skip-back clickable-icon',
		attr: { 'aria-label': 'Skip backward 15s' }
	});
	setIcon(skipBackBtn, 'rewind');
	skipBackBtn.addEventListener('click', () => void ctx.onSkipBackward());

	// Play/Pause button
	const playPauseBtn = controlsSection.createEl('button', {
		cls: 'player-button player-button-play-pause clickable-icon',
		attr: { 'aria-label': 'Play/pause' }
	});
	setIcon(playPauseBtn, 'play');
	playPauseBtn.addEventListener('click', () => void ctx.onPlayPause());

	// Skip forward button
	const skipForwardBtn = controlsSection.createEl('button', {
		cls: 'player-button player-button-skip-forward clickable-icon',
		attr: { 'aria-label': 'Skip forward 30s' }
	});
	setIcon(skipForwardBtn, 'fast-forward');
	skipForwardBtn.addEventListener('click', () => void ctx.onSkipForward());

	// Next button
	const nextBtn = controlsSection.createEl('button', {
		cls: 'player-button player-button-next clickable-icon',
		attr: { 'aria-label': 'Next episode' }
	});
	setIcon(nextBtn, 'skip-forward');
	nextBtn.addEventListener('click', () => void ctx.onNext());

	// Add to Note button
	const addNoteBtn = controlsSection.createEl('button', {
		cls: 'player-button player-button-add-note clickable-icon',
		attr: { 'aria-label': 'Add note to daily note' }
	});
	setIcon(addNoteBtn, 'file-plus');
	addNoteBtn.addEventListener('click', () => void ctx.onAddNote());

	// Bookmark button
	const bookmarkBtn = controlsSection.createEl('button', {
		cls: 'player-button player-button-bookmark clickable-icon',
		attr: { 'aria-label': 'Add bookmark at current position' }
	});
	setIcon(bookmarkBtn, 'bookmark');
	bookmarkBtn.addEventListener('click', () => void ctx.onBookmark());
}

/**
 * Render advanced controls (volume slider, speed slider)
 */
export function renderAdvancedControls(container: HTMLElement, ctx: PlayerContext): void {
	const advancedSection = container.createDiv({ cls: 'advanced-controls-section' });

	// Volume control
	const volumeControl = advancedSection.createDiv({ cls: 'control-group volume-control' });
	const volIcon = volumeControl.createSpan({ cls: 'control-icon volume-icon' });
	setIcon(volIcon, 'volume-2');

	const volumeSlider = volumeControl.createEl('input', {
		type: 'range',
		cls: 'control-slider volume-slider',
		attr: {
			min: '0',
			max: '100',
			value: '100',
			title: 'Volume'
		}
	});

	const volumeLabel = volumeControl.createSpan({ cls: 'control-value-label volume-value', text: '100' });

	volumeSlider.addEventListener('input', (e) => {
		const target = e.target as HTMLInputElement;
		const volume = parseInt(target.value);
		volumeLabel.textContent = String(volume);
		void ctx.onVolumeChange(volume);
	});

	// Speed control
	const speedControl = advancedSection.createDiv({ cls: 'control-group speed-control' });
	const speedIcon = speedControl.createSpan({ cls: 'control-icon speed-icon' });
	setIcon(speedIcon, 'zap');

	const speedSlider = speedControl.createEl('input', {
		type: 'range',
		cls: 'control-slider speed-slider',
		attr: {
			min: '0.5',
			max: '3.0',
			step: '0.1',
			value: '1.0',
			title: 'Playback speed'
		}
	});

	const speedLabel = speedControl.createSpan({ cls: 'control-value-label speed-value', text: '1.0x' });

	speedSlider.addEventListener('input', (e) => {
		const target = e.target as HTMLInputElement;
		const speed = parseFloat(target.value);
		speedLabel.textContent = `${speed.toFixed(1)}x`;
		void ctx.onSpeedChange(speed);
	});
}
