/**
 * DailyNoteService - Service for managing daily note operations
 *
 * Handles creating daily notes and inserting listening logs.
 */

import { App, TFile } from 'obsidian';
import { PluginSettings } from '../model';
import { logger } from '../utils/Logger';

declare global {
    interface Window {
        moment: typeof import('moment');
    }
}

/**
 * Service for daily note operations
 */
export class DailyNoteService {
    private app: App;
    private settings: PluginSettings;

    constructor(app: App, settings: PluginSettings) {
        this.app = app;
        this.settings = settings;
    }

    /**
     * Update settings reference
     */
    updateSettings(settings: PluginSettings): void {
        this.settings = settings;
    }

    /**
     * Insert a listening log entry into today's daily note
     */
    async insertListeningLog(
        podcastTitle: string,
        episodeTitle: string,
        duration: number,
        completedAt?: Date
    ): Promise<void> {
        const now = completedAt || new Date();
        const momentNow = window.moment(now);

        // Format the daily note filename
        const dateFormat = this.settings.dailyNoteDateFormat || 'YYYY-MM-DD';
        const dailyNoteFilename = momentNow.format(dateFormat) + '.md';

        // Build the full path
        const folderPath = this.settings.dailyNoteFolderPath || '';
        const fullPath = folderPath ? `${folderPath}/${dailyNoteFilename}` : dailyNoteFilename;

        // Format the log entry
        const timestamp = momentNow.format('HH:mm:ss');
        const logEntry = this.formatListeningLog(podcastTitle, episodeTitle, duration, timestamp);

        // Get or create the daily note
        let file = await this.ensureDailyNoteExists(fullPath, folderPath);

        if (file && file instanceof TFile) {
            // Read existing content
            const content = await this.app.vault.read(file);

            // Insert after header
            const newContent = this.insertAfterHeader(content, logEntry);

            await this.app.vault.modify(file, newContent);
            logger.info('Listening log inserted into daily note');
        }
    }

    /**
     * Ensure daily note exists, creating it if necessary
     */
    private async ensureDailyNoteExists(fullPath: string, folderPath: string): Promise<TFile | null> {
        let file = this.app.vault.getAbstractFileByPath(fullPath);

        if (!file) {
            // Try to use daily-notes plugin to create it with templates
            // @ts-ignore - internal plugin API
            if (this.app.internalPlugins?.getPluginById('daily-notes')?.enabled) {
                try {
                    // @ts-ignore
                    (this.app as any).commands.executeCommandById('daily-notes:goto-today');

                    // Wait for file creation
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (e) {
                    logger.error('Failed to invoke daily notes command', e);
                }
            }

            // Re-check file existence
            file = this.app.vault.getAbstractFileByPath(fullPath);

            if (!file) {
                // Fallback to manual creation
                const folderExists = folderPath ? this.app.vault.getAbstractFileByPath(folderPath) : true;
                if (folderPath && !folderExists) {
                    await this.app.vault.createFolder(folderPath);
                }
                file = await this.app.vault.create(fullPath, '');
            }
        }

        return file instanceof TFile ? file : null;
    }

    /**
     * Insert content after the specified header
     */
    private insertAfterHeader(content: string, logEntry: string): string {
        const headerTitle = this.settings.dailyNoteHeader || '## 🎧 Listening Log';
        const headerToFind = headerTitle.trim();

        if (content.includes(headerToFind)) {
            // Header exists, append after it
            const lines = content.split('\n');
            const headerIndex = lines.findIndex(line => line.trim() === headerToFind);

            if (headerIndex !== -1) {
                lines.splice(headerIndex + 1, 0, '', logEntry);
                return lines.join('\n');
            } else {
                // Fallback
                return content + '\n\n' + headerToFind + '\n\n' + logEntry;
            }
        } else {
            // Header doesn't exist, create it
            const position = this.settings.dailyNoteInsertPosition || 'bottom';
            if (position === 'top') {
                return headerToFind + '\n\n' + logEntry + '\n\n' + content;
            } else {
                return content + (content.endsWith('\n') ? '' : '\n') + '\n' + headerToFind + '\n\n' + logEntry;
            }
        }
    }

    /**
     * Format a listening log entry
     */
    private formatListeningLog(
        podcastTitle: string,
        episodeTitle: string,
        duration: number,
        timestamp: string
    ): string {
        const durationFormatted = this.formatDuration(duration);

        return `- **${timestamp}** - 完成收聽：[[${podcastTitle}]] - ${episodeTitle} (${durationFormatted})`;
    }

    /**
     * Format duration in human-readable format
     */
    private formatDuration(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }
}
