/**
 * SubscribePodcastModal - Modal for subscribing to a new podcast
 *
 * Allows users to:
 * - Enter an RSS/Atom feed URL
 * - Subscribe to the podcast
 * - Handle validation and errors
 */

import { App, Modal, Setting, Notice } from 'obsidian';
import type PodcastPlayerPlugin from '../../main';

/**
 * Modal for subscribing to a new podcast via RSS/Atom feed URL
 */
export class SubscribePodcastModal extends Modal {
	plugin: PodcastPlayerPlugin;
	onSubmit: (podcastId: string) => void;

	constructor(app: App, plugin: PodcastPlayerPlugin, onSubmit: (podcastId: string) => void) {
		super(app);
		this.plugin = plugin;
		this.onSubmit = onSubmit;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Subscribe to Podcast' });

		// Feed URL input
		let feedUrl = '';

		new Setting(contentEl)
			.setName('Feed URL')
			.setDesc('Enter the RSS or Atom feed URL of the podcast')
			.addText(text => text
				.setPlaceholder('https://example.com/podcast/feed.xml')
				.onChange(value => {
					feedUrl = value;
				}));

		// Info text
		const infoEl = contentEl.createDiv({ cls: 'subscribe-info' });
		infoEl.createEl('p', {
			text: 'You can find the RSS feed URL on the podcast\'s website or in your podcast app.',
			cls: 'subscribe-info-text'
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		buttonContainer.createEl('button', { text: 'Cancel' })
			.addEventListener('click', () => this.close());

		buttonContainer.createEl('button', { text: 'Subscribe', cls: 'mod-cta' })
			.addEventListener('click', async () => {
				await this.handleSubscribe(feedUrl.trim());
			});
	}

	/**
	 * Handle the subscribe action
	 */
	private async handleSubscribe(feedUrl: string): Promise<void> {
		// Validate URL
		if (!feedUrl) {
			new Notice('Please enter a feed URL');
			return;
		}

		if (!this.isValidUrl(feedUrl)) {
			new Notice('Please enter a valid URL');
			return;
		}

		try {
			// Show loading notification
			const loadingNotice = new Notice('Subscribing to podcast...', 0);

			// Subscribe to the podcast
			const podcastService = this.plugin.getPodcastService();
			const result = await podcastService.subscribe(feedUrl);

			// Hide loading notification
			loadingNotice.hide();

			// Check if subscription was successful
			if (result.success && result.podcast) {
				// Show success notification
				new Notice(`Successfully subscribed to: ${result.podcast.title}`);

				// Close the modal
				this.close();

				// Trigger the callback
				this.onSubmit(result.podcast.id);
			} else {
				// Show error message
				const errorMessage = result.error || 'Failed to subscribe to podcast';
				new Notice(errorMessage);
			}

		} catch (error) {
			console.error('Failed to subscribe to podcast:', error);

			// Determine the error message
			let errorMessage = 'Failed to subscribe to podcast';

			if (error instanceof Error) {
				if (error.message.includes('already subscribed')) {
					errorMessage = 'You are already subscribed to this podcast';
				} else if (error.message.includes('Invalid feed')) {
					errorMessage = 'Invalid RSS/Atom feed URL';
				} else if (error.message.includes('Network')) {
					errorMessage = 'Network error. Please check your connection.';
				} else if (error.message.includes('timeout')) {
					errorMessage = 'Request timed out. Please try again.';
				}
			}

			new Notice(errorMessage);
		}
	}

	/**
	 * Validate if the string is a valid URL
	 */
	private isValidUrl(urlString: string): boolean {
		try {
			const url = new URL(urlString);
			// Only accept http and https protocols
			return url.protocol === 'http:' || url.protocol === 'https:';
		} catch {
			return false;
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
