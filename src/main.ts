import { App, Modal, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { EditorState, StateField, Transaction, TransactionSpec } from '@codemirror/state';
import { EditorView, ViewUpdate } from '@codemirror/view';

import { default as wasmbin } from '../liberty-web/charliberty_bg.wasm'
import init, { formatLine } from '../liberty-web/charliberty'

import { RuleBatch, LineHeadRule, PairRule, Two2OneRule, BlockRule } from './ext_rule';
import { libertyZone, libertyZoneSize } from './ext_libertyzone'
import { FW, SW } from './const';

const SIDES_INSERT_MAP = new Map<string, { l: string, r: string }>([
	[FW.DOT, { l: SW.DOT, r: SW.DOT }],
	[FW.MONEY, { l: SW.MONEY, r: SW.MONEY }],
	[FW.LEFTQUO, { l: FW.LEFTQUO, r: FW.RIGHTQUO }],
	[FW.RIGHTQUO, { l: FW.LEFTQUO, r: FW.RIGHTQUO }],
]);

const PUNCTS = new Set<string>(" ，。：？,.:?");

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
		console.log('loading my typing plugin');
		await this.loadSettings();

		// make wasm ready
		await init(wasmbin)

		// make state machine ready
		this.ruleBatch = new RuleBatch(new LineHeadRule(), new PairRule(), new Two2OneRule(), new BlockRule())


		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});

		const spec = new DocChangeExtentionSpec(this.settings)
		const createF = spec.create
		console.log("active call create")
		createF(EditorState.create())
		const countDocChanges = StateField.define(spec)
		this.registerEditorExtension([
			countDocChanges,
			libertyZone(),
			EditorState.transactionFilter.of(this.sidesInsertFilter),
			EditorState.transactionFilter.of(this.continuousFullWidthCharFilter),
			EditorView.updateListener.of(this.addLiberty),
		])

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() { console.log('loading my typing plugin'); }

	addLiberty = ({ view, docChanged, selectionSet }: ViewUpdate) => {
		if (docChanged && selectionSet) {
			const state = view.state
			const mainSel = state.selection.asSingle().main
			if (mainSel.anchor != mainSel.head) { return } // skip range selection


			const line = state.doc.lineAt(mainSel.anchor)
			const from = Math.max(line.from, mainSel.anchor - state.facet(libertyZoneSize))
			const to = mainSel.anchor
			if (from == to) { return } // skip empty string

			const toUpdate = state.doc.sliceString(from, to)
			if (PUNCTS.has(toUpdate.charAt(toUpdate.length - 1))) {
				const trimmed = toUpdate.trim()
				if (trimmed === '') { return } // skip empty string
				const lspace = toUpdate.length - toUpdate.trimStart().length
				const rspace = toUpdate.length - toUpdate.trimEnd().length

				view.dispatch({ changes: { from: from + lspace, to: to - rspace, insert: formatLine(trimmed) } })
			}
		}
	}

	continuousFullWidthCharFilter = (tr: Transaction): TransactionSpec | readonly TransactionSpec[] => {
		if (!tr.docChanged) { return tr }
		let shouldHijack = true
		const changes: TransactionSpec[] = []
		tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
			const char = inserted.sliceString(0)
			if (!shouldHijack || fromA != toA || toB != fromB + 1 || !FW.CONTIN_CHARS_SET.has(char)) {
				shouldHijack = false
				return
			}

			const prevChar = tr.startState.doc.sliceString(fromB - 1, fromB)
			const nextChar = tr.startState.doc.sliceString(fromB, fromB + 1)
			console.log(`prev: '${prevChar}', next: '${nextChar}'`)

			const rules = this.ruleBatch

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
		const changes: TransactionSpec[] = []
		tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
			const char = inserted.sliceString(0)
			if (!shouldHijack || fromA == toA || toB != fromB + 1 || !SIDES_INSERT_MAP.has(char)) {
				shouldHijack = false
				return
			}
			const insert = SIDES_INSERT_MAP.get(char)
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
