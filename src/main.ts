import { editorInfoField, editorViewField, FileSystemAdapter, Plugin } from 'obsidian';
import { Annotation, Extension, StateField, Transaction } from '@codemirror/state';
import { history } from '@codemirror/commands';
import { EditorView, ViewUpdate } from '@codemirror/view';

import { default as wasmbin } from '../liberty-web/charliberty_bg.wasm';
import init, { planLine } from '../liberty-web/charliberty';
import { PUNCTS } from './const';
import { initLog } from './utils';
import { Rules } from './ext_convert';
import { computeConvertChanges, computeSideInsertChanges } from './editor_logic';
import { libertyZone } from './ext_libertyzone';
import { TypingTransformerSettings, SettingTab, DEFAULT_SETTINGS } from './settings';
import { generateProfileCommands, getAllCommands } from './global_commands';


enum ExtID {
	SideInsert,
	Conversion,
	ZoneIndicator,
	AutoFormat,
	Debug,
	KeyMap
}

const ProgramTxn = Annotation.define<boolean>();

type FormattingPlan = {
	zone: { from: number, to: number };
	changes: { from: number, to: number, insert: string }[];
};

const deubgExt = StateField.define({
	create: (_state): number => { return 0; },
	update: (value, tr) => {
		if (tr.docChanged) {
			tr.changes.iterChanges((a, b, c, d, insert) => {
				console.log(a, b, c, d, insert.sliceString(0));
			});
		}
		return value;
	}
});

function ignoreThisTr(tr: Transaction): boolean {
	return !tr.docChanged || tr.annotation(ProgramTxn) || tr.isUserEvent('redo') || tr.isUserEvent('undo');
}

export default class TypingTransformer extends Plugin {
	settings: TypingTransformerSettings;
	rules: Rules;
	availablExts: Extension[];
	activeExts: Extension[];
	profileStatus: HTMLElement;
	basePath: string;

	// Lifetime
	async onload() {
		if (this.app.vault.adapter instanceof FileSystemAdapter) {
			this.basePath = this.app.vault.adapter.getBasePath();
		}
		console.log('loading typing transformer plugin');
		// read saved settings
		await this.loadSettings();
		initLog(this.settings);
		// make wasm ready
		await init({ module_or_path: wasmbin instanceof Uint8Array ? wasmbin.buffer : wasmbin });
		this.activeExts = [];
		this.availablExts = [
			EditorView.updateListener.of(this.sidesInsertFilter),
			EditorView.updateListener.of(this.convertFilter),
			libertyZone(this.spotLibertyZone),
			EditorView.updateListener.of(this.addLiberty),
			deubgExt,
		];
		this.availablExts.forEach((_, idx) => this.activeExts[idx] = []);

		// parse saved rules
		await this.configureRules(this.settings.convertRules);
		// activate selected extensions
		this.configureActiveExtsFromSettings();
		this.registerEditorExtension(this.activeExts);
		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));
		for (const cmd of getAllCommands(this)) {
			this.addCommand(cmd);
		}

		this.profileStatus = this.addStatusBarItem();
		this.updateProfileStatus();
	}

	onunload() { console.log('unloading typing transformer plugin'); }

	// Settings
	async loadSettings() {
		const data = await this.loadData();
		let defaultSource = DEFAULT_SETTINGS;
		// upgrade from 0.3.1 and before
		if (data && 
			!Object.prototype.hasOwnProperty.call(data, "profiles") && 
			data.convertRules != DEFAULT_SETTINGS.convertRules) 
		{
			const cloned: TypingTransformerSettings = structuredClone(DEFAULT_SETTINGS);
			cloned.profiles[0].content = data.convertRules;
			defaultSource = cloned;
		}
		this.settings = Object.assign({}, defaultSource, data);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		for (const cmd of generateProfileCommands(this)) {
				this.addCommand(cmd);
		}
	}

	configureProfile = async (title: string, ruleString: string) => {
		this.settings.activeProfile = title;
		this.settings.convertRules = ruleString;
		await this.configureRules(ruleString);
		this.updateProfileStatus();
		await this.saveSettings();
	};

	configureRules = async (ruleString: string) => {
		this.rules = new Rules();
		await this.rules.parse(ruleString, this.app.vault.adapter, false);
	};

	checkRules = async (ruleString: string): Promise<string[]> => {
		const checkedRules = new Rules();
		await checkedRules.parse(ruleString, this.app.vault.adapter, true);
		return checkedRules.errors;
	};

	configureActiveExtsFromSettings = () => {
		const activeIds = [ExtID.Conversion, ExtID.SideInsert];
		const { debug, zoneIndicatorOn, autoFormatOn } = this.settings;
		if (debug) { activeIds.push(ExtID.Debug); }
		if (zoneIndicatorOn) { activeIds.push(ExtID.ZoneIndicator); }
		if (autoFormatOn) { activeIds.push(ExtID.AutoFormat); }
		this.activeExts.forEach((_ext, idx) => this.activeExts[idx] = []);
		activeIds.forEach((extid) => this.activeExts[extid] = this.availablExts[extid]);
		this.activeExts.push(history({
			joinToEvent: (tr: Transaction, isAdjacent: boolean) => {
				return !tr.annotation(ProgramTxn) && isAdjacent;
			}
		}));
	};

	toggleAutoFormat = async () => {
		this.settings.autoFormatOn = !this.settings.autoFormatOn;
		await this.saveAndReloadPlugin();
	};

	toggleDebugLog = async () => {
		this.settings.debug = !this.settings.debug;
		await this.saveAndReloadPlugin();
	};

	toggleIndicator = async () => {
		this.settings.zoneIndicatorOn = !this.settings.zoneIndicatorOn;
		await this.saveAndReloadPlugin();
	};

	saveAndReloadPlugin = async () => {
		await this.saveSettings();
		this.configureActiveExtsFromSettings();
		this.app.workspace.updateOptions();
	};

	// Features
	private libertyPlans = new WeakMap<ViewUpdate, FormattingPlan>();

	private getLibertyPlan = (update: ViewUpdate): FormattingPlan => {
		if (this.libertyPlans.has(update)) { return this.libertyPlans.get(update); }
		const plan = this.computeLibertyPlan(update);
		this.libertyPlans.set(update, plan);
		return plan;
	};

	private computeLibertyPlan = (update: ViewUpdate): FormattingPlan => {
		if (!update.docChanged || update.transactions.some(tr => ignoreThisTr(tr))) { return; }
		const state = update.state;
		const { main, ranges } = state.selection;
		if (ranges.length !== 1 || !main.empty) { return; }

		const line = state.doc.lineAt(main.head);
		const cursor = main.head - line.from;
		if (cursor === 0) { return; }
		// Metadata from another note must not decide whether this editor can format.
		const infoField = editorInfoField ?? editorViewField;
		const file = infoField ? state.field(infoField, false)?.file : undefined;
		const sections = file ? this.app.metadataCache.getFileCache(file)?.sections : undefined;
		for (const section of sections ?? []) {
			if (section.type !== 'code' && section.type !== 'match') { continue; }
			const pos = section.position;
			// pos.start.line is 0-based while line.number is 1-based
			if (pos.start.line <= line.number - 1 && line.number - 1 <= pos.end.line) { return; }
		}

		const plan = planLine(line.text, cursor);
		if (!plan) { return; }
		try {
			const gaps = plan.takeEdits();
			const changes: FormattingPlan['changes'] = [];
			for (let i = 0; i < gaps.length; i += 2) {
				const [from, to] = [gaps[i], gaps[i + 1]];
				changes.push({ from: line.from + from, to: line.from + to, insert: from === to ? ' ' : '' });
			}
			return { zone: { from: line.from + plan.from, to: line.from + plan.to }, changes };
		} finally {
			plan.free();
		}
	};

	spotLibertyZone = (update: ViewUpdate) => this.getLibertyPlan(update)?.zone;

	addLiberty = (update: ViewUpdate) => {
		const { state, view } = update;
		if (!update.docChanged || !update.selectionSet || state !== view.state ||
			!update.transactions.some(tr => tr.isUserEvent('input.type'))) { return; }
		const cursor = state.selection.main.head;
		if (!PUNCTS.has(state.doc.sliceString(Math.max(0, cursor - 1), cursor))) { return; }
		let typedTrigger = false;
		update.changes.iterChanges((_a, _b, from, to) => {
			if (from < cursor && cursor <= to) { typedTrigger = true; }
		});
		if (!typedTrigger) { return; }

		const plan = this.getLibertyPlan(update);
		if (plan?.changes.length) {
			view.dispatch({ changes: plan.changes, annotations: ProgramTxn.of(true) });
		}
	};

	convertFilter = async (update: ViewUpdate) => {
		if (!update.docChanged || update.transactions.some(tr => ignoreThisTr(tr))) { return; }
		const view = update.view;
		const state = view.state;
		const rules = this.rules;
		const { specs, allMatched } = await computeConvertChanges(
			update.startState, update.changes, rules, ProgramTxn,
		);
		// Clipboard reads can outlive typing, cursor moves, note/profile switches,
		// or the editor itself. Drop stale results rather than applying old positions.
		if (view.state !== state || this.rules !== rules || !view.dom.isConnected) { return; }
		if (allMatched) {
			view.dispatch(...specs);
		}
	};

	sidesInsertFilter = (update: ViewUpdate) => {
		if (!update.docChanged || update.transactions.some(tr => ignoreThisTr(tr))) { return; }
		if (!update.transactions.some(tr => tr.isUserEvent('input'))) { return; }
		const specs = computeSideInsertChanges(
			update.startState, update.changes, this.rules, ProgramTxn,
		);
		if (specs.length > 0) {
			update.view.dispatch(...specs);
		}
	};

	updateProfileStatus = () => {
		this.profileStatus.setText(`Active Profile: ${this.settings.activeProfile}`);
	};
}
