import { App, Modal, Plugin, PluginSettingTab, Pos, Setting, Notice } from 'obsidian';
import { EditorState, StateField, Transaction, TransactionSpec } from '@codemirror/state';
import { EditorView, ViewUpdate, keymap } from '@codemirror/view';

import { default as wasmbin } from '../liberty-web/charliberty_bg.wasm'
import init, { formatLine } from '../liberty-web/charliberty'

import { RuleBatch, LineHeadRule, PairRule, Two2OneRule, BlockRule } from './ext_rule';
import { libertyZone, libertyZoneSize, libertyZoneSizeFacet } from './ext_libertyzone'
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


export default class MyTyping extends Plugin {
	settings: MyTypingSettings;
	ruleBatch: RuleBatch;
	specialSections: Pos[];

	async onload() {
		console.log('loading my typing plugin');
		await this.loadSettings();

		// make wasm ready
		await init(wasmbin)

		// make state machine ready
		this.ruleBatch = new RuleBatch(new LineHeadRule(), new PairRule(), new Two2OneRule(), new BlockRule())
		this.specialSections = []


		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});

		this.registerEditorExtension([
			libertyZone(this.spotLibertyZone),
			EditorState.transactionFilter.of(this.sidesInsertFilter),
			EditorState.transactionFilter.of(this.continuousFullWidthCharFilter),
			EditorView.updateListener.of(this.addLiberty),
			keymap.of([{
				key: "Ctrl-]",
				run: (view: EditorView) => this.changeLibertySize(view, 5)
			},{
				key: "Ctrl-[",
				run: (view: EditorView) => this.changeLibertySize(view, -5)
			}])
		])

		this.registerEvent(this.app.metadataCache.on("changed", (_f, _d, meta) => {
			this.specialSections.length = 0
			meta.sections?.forEach((sec) => {
				if (sec.type == "code" || sec.type == "match") {
					this.specialSections.push(sec.position)
				}
			})
		}))

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() { console.log('unloading my typing plugin'); }

	changeLibertySize = (view: EditorView, delta: number): boolean => {
		// TODO: record this change to plugin settings
		const size = view.state.facet(libertyZoneSizeFacet)
		const newSize = Math.max(0, size + delta)
		if (size != newSize) {
			 new Notice(`Monitor size is ${newSize}`)
			 view.dispatch({ effects: libertyZoneSize.reconfigure(libertyZoneSizeFacet.of(newSize)) })
		}
		return true
	}

	spotLibertyZone = ({ view, docChanged }: ViewUpdate): {from: number, to: number} => {
		if (!docChanged) { return }
		const state = view.state
		const mainSel = state.selection.asSingle().main
		if (mainSel.anchor != mainSel.head) { return } // skip range selection

		const line = state.doc.lineAt(mainSel.anchor)
		const from = Math.max(line.from, mainSel.anchor - state.facet(libertyZoneSizeFacet))
		const to = mainSel.anchor
		if (from == to) { return } // skip empty string 
		// and special secions
		for (const pos of this.specialSections) {
			if (pos.start.line <= line.number && line.number <= pos.end.line) { return }
		}
		return {from, to}
	}

	addLiberty = (update: ViewUpdate) => {
		const range = this.spotLibertyZone(update)
		// selectionSet is important, recursive call otherwise.
		if (range === undefined || !update.selectionSet) { return }
		const from = range.from, to = range.to
		const toUpdate = update.view.state.doc.sliceString(from, to)
		if (PUNCTS.has(toUpdate.charAt(toUpdate.length - 1))) {
			const trimmed = toUpdate.trim()
			if (trimmed === '') { return } // skip empty string
			const lspace = toUpdate.length - toUpdate.trimStart().length
			const rspace = toUpdate.length - toUpdate.trimEnd().length
			update.view.dispatch({ changes: { from: from + lspace, to: to - rspace, insert: formatLine(trimmed) } })
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
