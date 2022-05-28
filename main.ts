import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

import { EditorState, StateField, Transaction } from '@codemirror/state';

import {zebraStripes} from './strips'

// Remember to rename these classes and interfaces!

interface MyTypingSettings {
	mySetting: string;
	debug: boolean,
}

const DEFAULT_SETTINGS: MyTypingSettings = {
	mySetting: 'default',
	debug: true,
}

class DocChangeExtentionSpec {
	settings: MyTypingSettings;
	innerCount: number;

	constructor(settings: MyTypingSettings) {
		console.log("new DocChange Sepc")
		this.settings = settings;
		this.innerCount = 0;
	}


	create = (_state: EditorState):number => {
		console.log(`create statefield with ${this.innerCount}`)
		this.innerCount += 1
		return 0
	}

	update = (value: number, tr: Transaction) => {
		if (!tr.changes.empty != tr.docChanged) {
			console.log("Why they are not equal!")
		}
		if (tr.docChanged && this.settings.debug) {
			console.log("transaction", tr)
		}
		return tr.docChanged ? value + 1 : value
	}

}

export default class MyTyping extends Plugin {
	settings: MyTypingSettings;

	async onload() {
		await this.loadSettings();

		console.log('==load my typing plugin==');
		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});

		this.addCommand({
			id: 'test-editor',
			name: 'inspect MetadataCache',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				let meta = view.app.metadataCache.getFileCache(view.file)
				console.log(meta)
			}
		});
		let spec = new DocChangeExtentionSpec(this.settings)
		let createF = spec.create
		console.log("active call create")
		createF(EditorState.create())
		let countDocChanges = StateField.define(spec)
		this.registerEditorExtension(countDocChanges)
		if (this.settings.debug) {			
			this.registerEditorExtension(zebraStripes({step: 5}))
		}

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	console.log('click', evt);
		// });

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Woah! LaLa!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyTyping;

	constructor(app: App, plugin: MyTyping) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Settings for my awesome plugin.' });

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Debug")
			.setDesc("Print more log to the console")
			.addToggle(comp =>
				comp.onChange(async (value) => {
					this.plugin.settings.debug = value;
					await this.plugin.saveSettings();
				})
			)
	}
}
