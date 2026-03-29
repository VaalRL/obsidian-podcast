/**
 * ChaptersRenderer - Renders chapter list in the player view
 *
 * Displays clickable chapter markers with highlighting for the current chapter.
 * Follows the same renderer pattern as PlaybackControlsRenderer and ProgressRenderer.
 */

import { setIcon } from 'obsidian';
import type { Chapter } from '../../model';
import type { PlayerContext } from './PlayerContext';
import { formatTime } from './PlayerUtils';

/**
 * Render the chapters section in the player view
 * Only renders if the current episode has chapters
 */
export function renderChaptersSection(container: HTMLElement, ctx: PlayerContext): void {
	const state = ctx.plugin.playerController.getState();
	const episode = state.currentEpisode;
	if (!episode?.chapters || episode.chapters.length === 0) return;

	const section = container.createDiv({ cls: 'chapters-section' });

	// Collapsible header
	const toggle = section.createDiv({ cls: 'chapters-toggle' });
	const toggleIcon = toggle.createSpan({ cls: 'chapters-toggle-icon' });
	setIcon(toggleIcon, 'chevron-right');
	toggle.createSpan({ text: `Chapters (${episode.chapters.length})`, cls: 'chapters-toggle-label' });

	const list = section.createDiv({ cls: 'chapters-list is-collapsed' });

	toggle.addEventListener('click', () => {
		const collapsed = list.hasClass('is-collapsed');
		if (collapsed) {
			list.removeClass('is-collapsed');
			setIcon(toggleIcon, 'chevron-down');
		} else {
			list.addClass('is-collapsed');
			setIcon(toggleIcon, 'chevron-right');
		}
	});

	// Render chapter items
	for (const chapter of episode.chapters) {
		const item = list.createDiv({ cls: 'chapter-item', attr: { 'data-start': String(chapter.startTime) } });

		const timeEl = item.createSpan({ cls: 'chapter-time', text: formatTime(chapter.startTime) });
		item.createSpan({ cls: 'chapter-title', text: chapter.title });

		item.addEventListener('click', () => {
			ctx.plugin.playerController.seek(chapter.startTime);
		});
	}

	// Highlight current chapter
	updateCurrentChapter(section, state.position, episode.chapters);
}

/**
 * Update which chapter is highlighted based on current playback position
 */
export function updateCurrentChapter(container: HTMLElement, position: number, chapters: Chapter[]): void {
	const items = container.querySelectorAll('.chapter-item');
	if (items.length === 0) return;

	// Find the active chapter (last chapter whose startTime <= position)
	let activeIndex = -1;
	for (let i = 0; i < chapters.length; i++) {
		if (chapters[i].startTime <= position) {
			activeIndex = i;
		} else {
			break;
		}
	}

	items.forEach((item, i) => {
		if (i === activeIndex) {
			item.addClass('is-active');
		} else {
			item.removeClass('is-active');
		}
	});
}
