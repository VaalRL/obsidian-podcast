/**
 * Markdown Module
 *
 * Provides markdown integration functionality including:
 * - Timestamp formatting for notes
 * - Episode note export
 * - Template system
 */

// Export timestamp formatter
export {
	TimestampFormatter,
	type TimestampStyle,
	type TimestampFormatOptions,
} from './TimestampFormatter';

// Export note exporter
export {
	NoteExporter,
	type NoteExportOptions,
	type TemplateVariables,
} from './NoteExporter';
