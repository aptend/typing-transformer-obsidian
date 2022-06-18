import { App, Plugin, PluginSettingTab, Pos, Setting, TextAreaComponent, ButtonComponent } from 'obsidian';
import { EditorState, StateField, Transaction, TransactionSpec } from '@codemirror/state';
import { EditorView, ViewUpdate } from '@codemirror/view';

import { default as wasmbin } from '../liberty-web/charliberty_bg.wasm'
import init, { formatLine } from '../liberty-web/charliberty'

import { libertyZone } from './ext_libertyzone'
import { FW, SW } from './const';

import { Rules } from './ext_convert';

const SIDES_INSERT_MAP = new Map<string, { l: string, r: string }>([
	[FW.DOT, { l: SW.DOT, r: SW.DOT }],
	[FW.MONEY, { l: SW.MONEY, r: SW.MONEY }],
	[FW.LEFTQUO, { l: FW.LEFTQUO, r: FW.RIGHTQUO }],
	[FW.RIGHTQUO, { l: FW.LEFTQUO, r: FW.RIGHTQUO }],
]);

const PUNCTS = new Set<string>(" ，。：？,.:?");

const DEFAULT_RULES = String.raw`# Rules
# line head
'\n》¦' -> '\n>¦'
'\n、¦' -> '\n/¦'

# Two2one
'。。¦' -> '.¦'
'》》¦' -> '>¦'
'、、¦' -> '/¦'
'；；¦' -> ';¦'
'，，¦' -> ',¦'

# auto pair and conver
'《《¦》' -> '<¦' # this take higer priority
'《¦' -> '《¦》'
'（（¦）' -> '(¦)'
'（¦' -> '（¦）'

# auto block
'··¦' -> '\`¦\`' # inline block
'\`·¦\`' -> '\`\`\`¦\n\`\`\`'

# have fun converting!
# 'hv1111¦' -> 'have a nice day!¦'
`.replaceAll("\\`", "`")

interface TypingTransformerSettings {
	debug: boolean,
	convertRules: string,
}

const DEFAULT_SETTINGS: TypingTransformerSettings = {
	debug: true,
	convertRules: DEFAULT_RULES,
}


export default class TypingTransformer extends Plugin {
	settings: TypingTransformerSettings;
	specialSections: Pos[];
	rules: Rules;
	rulesErr: string;

	async onload() {
		console.log('loading my typing plugin');
		await this.loadSettings();

		// make wasm ready
		await init(wasmbin)

		this.configureRules(this.settings.convertRules)

		this.specialSections = []

		this.registerEditorExtension([
			libertyZone(this.spotLibertyZone),
			EditorState.transactionFilter.of(this.sidesInsertFilter),
			EditorState.transactionFilter.of(this.continuousFullWidthCharFilter),
			EditorView.updateListener.of(this.addLiberty),
			StateField.define({
				create: (state): number => { return 0 },
				update: (value, tr) => {
					if (tr.docChanged) {
						tr.changes.iterChanges((a,b,c,d,insert) => {
							console.log(a,b,c,d, insert.sliceString(0))
						})
					}
					return value
				}
			})
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
		this.addSettingTab(new SettingTab(this.app, this));
	}

	onunload() { console.log('unloading my typing plugin'); }

	configureRules = (ruleString: string) => {
		this.rules = new Rules(ruleString)
		if (this.rules.errors.length > 0) {
			this.rulesErr = this.rules.errors.join('\n')
		} else {
			this.rulesErr = ""
		}
	}

	spotLibertyZone = ({ view, docChanged }: ViewUpdate): { from: number, to: number } => {
		if (!docChanged) { return }
		const state = view.state
		const mainSel = state.selection.asSingle().main
		if (mainSel.anchor != mainSel.head) { return } // skip range selection

		const line = state.doc.lineAt(mainSel.anchor)
		const from = line.from
		const to = mainSel.anchor
		if (from == to) { return } // skip empty string 
		// and special secions
		for (const pos of this.specialSections) {
			if (pos.start.line <= line.number && line.number <= pos.end.line) { return }
		}

		const txt = state.doc.sliceString(from, to)

		let inblock = false
		for (let i = txt.length - 2; i > 0; i--) {
			const ch = txt[i]
			if (ch === '`') { inblock = !inblock }
			if (!inblock && ch != ' ' && PUNCTS.has(ch)) {
				return {from: from + i, to}
			}
		}

		return { from, to }
	}

	addLiberty = (update: ViewUpdate) => {
		const range = this.spotLibertyZone(update)
		// selectionSet is important, recursive call otherwise.
		if (range === undefined || !update.selectionSet) { return }
		const from = range.from, to = range.to
		const toUpdate = update.view.state.doc.sliceString(from, to)
		console.log("toUpdate", toUpdate)
		if (PUNCTS.has(toUpdate.charAt(toUpdate.length - 1))) {
			console.log("trigger char", toUpdate.charAt(toUpdate.length - 1))
			const trimmed = toUpdate.trim()
			if (trimmed === '') { return } // skip empty string
			const lspace = toUpdate.length - toUpdate.trimStart().length
			const rspace = toUpdate.length - toUpdate.trimEnd().length
			update.view.dispatch({ changes: { from: from + lspace, to: to - rspace, insert: formatLine(trimmed) } })
		}
	}

	continuousFullWidthCharFilter = (tr: Transaction): TransactionSpec | readonly TransactionSpec[] => {
		if (!tr.docChanged) { return tr }
		let shouldHijack = true // Hijack when some rules match all changes
		const changes: TransactionSpec[] = []
		tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
			const { trigSet, lmax, rmax } = this.rules
			const char = inserted.sliceString(0)
			if (!shouldHijack || fromA != toA || toB != fromB + 1 || !trigSet.has(char)) {
				shouldHijack = false
				return
			}

			const input = tr.startState.doc.sliceString(fromB - lmax, fromB + rmax)
			console.log("---- ", input)

			const rule = this.rules.match(input, char, lmax)
			if (rule != null) {
				changes.push(rule.mapToChanges(fromB))
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

class SettingTab extends PluginSettingTab {
	plugin: TypingTransformer;

	constructor(app: App, plugin: TypingTransformer) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl, plugin } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Debug")
			.setDesc("Print more log to the console")
			.addToggle(comp => comp
				.setValue(plugin.settings.debug)
				.onChange(async (value) => {
					plugin.settings.debug = value;
					await plugin.saveSettings();
				})
			)
		
		const ruleArea = new Setting(containerEl)
		ruleArea.settingEl.setAttribute("style", "display: grid; grid-template-columns: 1fr;")
		ruleArea.setName("Converting rules")
				.setDesc("one line for one rule and rules that come first have higher priority")
		
		const ruleInput = new TextAreaComponent(ruleArea.controlEl)
		ruleInput.inputEl.setAttribute("style", "margin-top: 12px; width: 100%;  height: 30vh; font-family: 'Source Code Pro', monospace;")
		ruleInput.setValue(plugin.settings.convertRules)
			
		const ruleControl = containerEl.createDiv("ruleCtrl")
		ruleControl.setAttr("display", "flex")

		const feedRules = async (newRule: string) => {
			plugin.settings.convertRules = newRule
			plugin.configureRules(newRule)
			if (plugin.rulesErr != "") {
				ruleHint.setText(plugin.rulesErr)
			} else {
				ruleHint.setText("Ready to parse!")
				await this.plugin.saveSettings()
			}
		}

		new ButtonComponent(ruleControl)
			.setTooltip("apply these rules")
			.setButtonText('Apply')
			.onClick(_ => feedRules(ruleInput.getValue()))

		const ruleHint = ruleControl.createEl("a", { text: plugin.rulesErr })

		new ButtonComponent(ruleControl)
			.setTooltip("reset default rules")
			.setButtonText('Reset')
			.onClick(_ => { ruleInput.setValue(DEFAULT_RULES); feedRules(DEFAULT_RULES) })
			.buttonEl.setAttribute('style', 'float: right;')
	}
}
