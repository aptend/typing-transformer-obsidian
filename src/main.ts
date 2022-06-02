import { App, Editor, editorEditorField, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

import { EditorState, StateField, Transaction, TransactionSpec, Text } from '@codemirror/state';

import { zebraStripes } from './strips'

import { default as wasmbin } from '../liberty-web/charliberty_bg.wasm'

import init, { formatLine } from '../liberty-web/charliberty'

import './const';

import {RuleBatch, LineHeadRule, PairRule, Two2OneRule} from './rule_ext';



interface MyTypingSettings {
	mySetting: string,
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


	create = (_state: EditorState): number => {
		console.log(`create statefield with ${this.innerCount}`)
		this.innerCount += 1
		return 0
	}

	update = (value: number, tr: Transaction) => {
		if (tr.docChanged && this.settings.debug) {
			tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
				console.log("changes", fromA, toA, fromB, toB, inserted.toJSON())
			})
			console.log("transaction", tr)
		}


		console.log("main selection", tr.selection?.main.toJSON())

		return tr.docChanged ? value + 1 : value
	}

}



export default class MyTyping extends Plugin {
	settings: MyTypingSettings;
	ruleBatch: RuleBatch;

	async onload() {
		await this.loadSettings();

		// make wasm ready
		await init(wasmbin)

		// make state machine ready
		this.ruleBatch = new RuleBatch(new LineHeadRule(), new PairRule(), new Two2OneRule())



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

		this.addCommand({
			id: 'test-wasm',
			name: 'format the current line',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				let cursorLineNum = editor.getCursor().line
				let s = editor.getLine(cursorLineNum)
				let formatted = formatLine(s)
				console.log(`format: ${formatted}`)
				editor.replaceRange(formatted + '\n', {
					line: cursorLineNum,
					ch: s.length + 1,
				})
			}
		});

		let spec = new DocChangeExtentionSpec(this.settings)
		let createF = spec.create
		console.log("active call create")
		createF(EditorState.create())
		let countDocChanges = StateField.define(spec)
		this.registerEditorExtension([countDocChanges, EditorState.transactionFilter.of(this.sidesInsertFilter), EditorState.transactionFilter.of(this.continuousFullWidthCharFilter)])


		if (this.settings.debug) {
			this.registerEditorExtension(zebraStripes({ step: 5 }))
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

	continuousFullWidthCharFilter = (tr: Transaction): TransactionSpec | readonly TransactionSpec[] => {
		if (!tr.docChanged) { return tr }
		let shouldHijack = true
		let changes: TransactionSpec[] = []
		tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
			let char = inserted.sliceString(0)
			if (!shouldHijack || fromA != toA || toB != fromB + 1 || !CONTIN_CHARS_SET.has(char)) {
				shouldHijack = false
				return
			}

			let prevChar = tr.startState.doc.sliceString(fromB - 1, fromB)
			let nextChar = tr.startState.doc.sliceString(fromB, fromB + 1)
			console.log(`prev: '${prevChar}', next: '${nextChar}'`)

			let rules = this.ruleBatch

			rules.reset()
			rules.next(prevChar)
			rules.next(char)
			rules.next(nextChar)

			if (rules.hasResult) {
				changes.push(...rules.resultSpecs(fromB))
			} else {
				shouldHijack = false
			}
		})

		if (shouldHijack) { tr = tr.startState.update(...changes) }
		return tr
	}

	sidesInsertFilter = (tr: Transaction): TransactionSpec | readonly TransactionSpec[] => {
		if (!tr.docChanged) { return tr }
		let shouldHijack = true
		let changes: TransactionSpec[] = []
		tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
			let char = inserted.sliceString(0)
			if (!shouldHijack || fromA == toA || toB != fromB + 1 || !SIDES_INSERT_MAP.has(char)) {
				shouldHijack = false
				return
			}
			let insert = SIDES_INSERT_MAP.get(char)
			changes.push({ changes: { from: fromA, to: fromA, insert: insert.l } })
			changes.push({ changes: { from: toA, to: toA, insert: insert.r } })
		})

		if (shouldHijack) { tr = tr.startState.update(...changes) }
		return tr
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
