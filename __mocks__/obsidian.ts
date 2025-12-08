/**
 * Mock Obsidian API for testing
 */

export class MockVault {
	private files: Map<string, string> = new Map();

	async read(file: any): Promise<string> {
		return this.files.get(file.path) || '';
	}

	async modify(file: any, data: string): Promise<void> {
		this.files.set(file.path, data);
	}

	async create(path: string, data: string): Promise<any> {
		this.files.set(path, data);
		return { path };
	}

	async delete(file: any): Promise<void> {
		this.files.delete(file.path);
	}

	adapter = {
		exists: jest.fn().mockResolvedValue(true),
		read: jest.fn().mockResolvedValue('{}'),
		write: jest.fn().mockResolvedValue(undefined),
		remove: jest.fn().mockResolvedValue(undefined),
		mkdir: jest.fn().mockResolvedValue(undefined),
		list: jest.fn().mockResolvedValue({ files: [], folders: [] }),
	};

	getAbstractFileByPath = jest.fn().mockReturnValue(null);
	getFiles = jest.fn().mockReturnValue([]);
	getFolderByPath = jest.fn().mockReturnValue(null);
}

export class TFile {
	path: string;
	name: string;
	extension: string;
	basename: string;

	constructor(path: string) {
		this.path = path;
		const parts = path.split('/');
		this.name = parts[parts.length - 1];
		const nameParts = this.name.split('.');
		this.extension = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
		this.basename = nameParts.slice(0, -1).join('.');
	}
}

export class TFolder {
	path: string;
	name: string;
	children: any[] = [];

	constructor(path: string) {
		this.path = path;
		const parts = path.split('/');
		this.name = parts[parts.length - 1];
	}
}

export function normalizePath(path: string): string {
	return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export class Notice {
	constructor(message: string, timeout?: number) {
		// Mock notice - do nothing
	}
}

export class Modal {
	app: any;
	containerEl: HTMLElement = document.createElement('div');
	modalEl: HTMLElement = document.createElement('div');
	titleEl: HTMLElement = document.createElement('div');
	contentEl: HTMLElement = document.createElement('div');

	constructor(app: any) {
		this.app = app;
	}

	open() {}
	close() {}
	onOpen() {}
	onClose() {}
}

export class Setting {
	settingEl: HTMLElement = document.createElement('div');
	infoEl: HTMLElement = document.createElement('div');
	nameEl: HTMLElement = document.createElement('div');
	descEl: HTMLElement = document.createElement('div');
	controlEl: HTMLElement = document.createElement('div');

	constructor(containerEl: HTMLElement) {}

	setName(name: string): this {
		return this;
	}

	setDesc(desc: string): this {
		return this;
	}

	addText(cb: (text: any) => any): this {
		const textComponent = {
			setValue: jest.fn().mockReturnThis(),
			setPlaceholder: jest.fn().mockReturnThis(),
			onChange: jest.fn().mockReturnThis(),
		};
		cb(textComponent);
		return this;
	}

	addSlider(cb: (slider: any) => any): this {
		const sliderComponent = {
			setLimits: jest.fn().mockReturnThis(),
			setValue: jest.fn().mockReturnThis(),
			setDynamicTooltip: jest.fn().mockReturnThis(),
			onChange: jest.fn().mockReturnThis(),
		};
		cb(sliderComponent);
		return this;
	}

	addToggle(cb: (toggle: any) => any): this {
		const toggleComponent = {
			setValue: jest.fn().mockReturnThis(),
			onChange: jest.fn().mockReturnThis(),
		};
		cb(toggleComponent);
		return this;
	}

	addDropdown(cb: (dropdown: any) => any): this {
		const dropdownComponent = {
			addOption: jest.fn().mockReturnThis(),
			setValue: jest.fn().mockReturnThis(),
			onChange: jest.fn().mockReturnThis(),
		};
		cb(dropdownComponent);
		return this;
	}

	addButton(cb: (button: any) => any): this {
		const buttonComponent = {
			setButtonText: jest.fn().mockReturnThis(),
			setWarning: jest.fn().mockReturnThis(),
			onClick: jest.fn().mockReturnThis(),
		};
		cb(buttonComponent);
		return this;
	}
}

export class ItemView {
	app: any;
	leaf: any;
	containerEl: HTMLElement = document.createElement('div');
	contentEl: HTMLElement = document.createElement('div');

	constructor(leaf: any) {
		this.leaf = leaf;
	}

	getViewType(): string {
		return 'mock-view';
	}

	getDisplayText(): string {
		return 'Mock View';
	}

	async onOpen(): Promise<void> {}
	async onClose(): Promise<void> {}
}

export class WorkspaceLeaf {
	view: any = null;
	detach() {}
	setViewState(viewState: any): Promise<void> {
		return Promise.resolve();
	}
}

export class Menu {
	addItem(cb: (item: any) => any): this {
		const menuItem = {
			setTitle: jest.fn().mockReturnThis(),
			setIcon: jest.fn().mockReturnThis(),
			onClick: jest.fn().mockReturnThis(),
		};
		cb(menuItem);
		return this;
	}

	showAtMouseEvent(event: MouseEvent): this {
		return this;
	}
}

export class App {
	vault: MockVault = new MockVault();
	workspace: any = {
		getLeaf: jest.fn().mockReturnValue(new WorkspaceLeaf()),
		getLeavesOfType: jest.fn().mockReturnValue([]),
		detachLeavesOfType: jest.fn(),
		revealLeaf: jest.fn(),
	};
}

export class Plugin {
	app: App;
	manifest: any = {
		id: 'test-plugin',
		name: 'Test Plugin',
		version: '1.0.0',
	};

	constructor(app: App, manifest: any) {
		this.app = app;
		this.manifest = manifest;
	}

	async loadData(): Promise<any> {
		return {};
	}

	async saveData(data: any): Promise<void> {}

	addCommand(command: any): void {}
	addRibbonIcon(icon: string, title: string, callback: () => void): HTMLElement {
		return document.createElement('div');
	}
	addSettingTab(tab: any): void {}
	registerView(type: string, viewCreator: any): void {}
}

export class PluginSettingTab {
	app: App;
	plugin: any;
	containerEl: HTMLElement = document.createElement('div');

	constructor(app: App, plugin: any) {
		this.app = app;
		this.plugin = plugin;
	}

	display(): void {}
	hide(): void {}
}

export interface RequestUrlParam {
	url: string;
	method?: string;
	contentType?: string;
	body?: string | ArrayBuffer;
	headers?: Record<string, string>;
}

export interface RequestUrlResponse {
	status: number;
	headers: Record<string, string>;
	arrayBuffer: ArrayBuffer;
	json: any;
	text: string;
}

export async function requestUrl(request: RequestUrlParam | string): Promise<RequestUrlResponse> {
	const url = typeof request === 'string' ? request : request.url;

	// Mock response
	return {
		status: 200,
		headers: { 'content-type': 'text/xml' },
		arrayBuffer: new ArrayBuffer(0),
		json: {},
		text: '<?xml version="1.0"?><rss version="2.0"><channel><title>Test Podcast</title></channel></rss>',
	};
}

export const Vault = MockVault;
