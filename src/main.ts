import { FileSystemAdapter, Plugin, Pos } from 'obsidian';
import { Annotation, Extension, StateField, Transaction, TransactionSpec } from '@codemirror/state';
import { history } from '@codemirror/commands';
import { EditorView, ViewUpdate } from '@codemirror/view';

import { default as wasmbin } from '../liberty-web/charliberty_bg.wasm';
import init, { formatLine, getBlockRanges } from '../liberty-web/charliberty';
import { PUNCTS } from './const';
import { initLog, log } from './utils';
import { Rules, DEL_TRIG } from './ext_convert';
import { libertyZone } from './ext_libertyzone';
import { TypingTransformerSettings, SettingTab, DEFAULT_SETTINGS } from './settings';
import { getAllCommands } from './global_commands';


enum ExtID {
	SideInsert,
	Conversion,
	ZoneIndicator,
	AutoFormat,
	Debug,
	KeyMap
}

const ProgramTxn = Annotation.define<boolean>();

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
	specialSections: Pos[];
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
		await init(wasmbin);
		this.specialSections = [];
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
		// subscribe meta change
		this.registerEvent(this.app.metadataCache.on("changed", (_f, _d, meta) => {
			this.specialSections.length = 0;
			meta.sections?.forEach((sec) => {
				if (sec.type == "code" || sec.type == "match") {
					this.specialSections.push(sec.position);
				}
			});
		}));

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
		await this.rules.parse(ruleString, false, this.basePath);
	};

	checkRules = async (ruleString: string): Promise<string[]> => {
		this.rules = new Rules();
		await this.rules.parse(ruleString, true, this.basePath);
		return this.rules.errors;
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
	spotLibertyZone = ({ view, docChanged }: ViewUpdate): { from: number, to: number } => {
		if (!docChanged) { return; }
		const state = view.state;
		const mainSel = state.selection.asSingle().main;
		if (mainSel.anchor != mainSel.head) { return; } // skip range selection

		const line = state.doc.lineAt(mainSel.anchor);
		const from = line.from;
		const to = mainSel.anchor;
		if (from == to) { return; } // skip empty string and... 
		for (const pos of this.specialSections) { // ... special secions and ..
			// pos.start.line is 0-based while line.number is 1-based
			if (pos.start.line <= line.number - 1 && line.number - 1 <= pos.end.line) { return; }
		}

		const checkInBlock = (blocks: Uint32Array, offset: number): { exist: boolean, from: number, to: number } => {
			for (let i = blocks.length - 2; i > -1; i -= 2) {
				// a cursor at `offset`, is at the left side of `offset`-th char, so left-opend right-close here
				if (blocks[i] < offset && offset <= blocks[i + 1]) {
					return { exist: true, from: blocks[i], to: blocks[i + 1] };
				}
			}
			return { exist: false, from: 0, to: 0 };
		};

		const blocks = getBlockRanges(line.text, to - from);

		const r = checkInBlock(blocks.emphasis, to - from);
		if (r.exist) {
			// cursor is in *xx*, **xx**, _x_, __xx__ block, only the content needs formatting
			const txt = state.sliceDoc(from + r.from, from + r.to);
			let i;
			for (i = 0; txt[i] == txt[0] && i < r.to; i++) {
				log("format: skip emphasis head", i, txt[i]);
			}
			return { from: from + r.from + i, to };
		}

		const spBlocks = blocks.special;

		if (checkInBlock(spBlocks, to - from).exist) { return; } // ...skip special block

		const txt = state.sliceDoc(from, to);

		// find the last segment of the input 
		// -2 to skip trailing punct, if any
		for (let i = txt.length - 2; i > 0; i--) {
			const ch = txt[i];
			if (ch != ' ' && PUNCTS.has(ch) && !checkInBlock(spBlocks, i).exist) {
				return { from: from + i, to };
			}
		}

		return { from, to };
	};

	addLiberty = (update: ViewUpdate) => {
		const range = this.spotLibertyZone(update);
		// selectionSet is important, recursive call otherwise.
		if (range === undefined || !update.selectionSet) { return; }
		if (update.transactions.some(tr => ignoreThisTr(tr))) { return; }
		const from = range.from, to = range.to;
		const toUpdate = update.view.state.doc.sliceString(from, to);
		if (PUNCTS.has(toUpdate.charAt(toUpdate.length - 1))) {
			const trimmed = toUpdate.trim();
			if (trimmed === '') { return; } // skip empty string
			const lspace = toUpdate.length - toUpdate.trimStart().length;
			const rspace = toUpdate.length - toUpdate.trimEnd().length;
			log("foramt: trigger char: %s, toUpdate: %s, lspace: %d, rspace: %d",
				toUpdate.charAt(toUpdate.length - 1), toUpdate, lspace, rspace);
			const formatted = formatLine(trimmed);
			// no need to update if no change. It will block redo/undo stack otherwise.
			if (formatted === trimmed) { return; }
			update.view.dispatch({ changes: { from: from + lspace, to: to - rspace, insert: formatLine(trimmed) }, annotations: ProgramTxn.of(true) });
		}
	};

	convertFilter = (update: ViewUpdate) => {
		if (!update.docChanged || update.transactions.some(tr => ignoreThisTr(tr))) { return; }
		let shouldHijack = true; // Hijack when some rules match all changes
		const changes: TransactionSpec[] = [];
		const { insertTrigSet, deleteTrigSet, lmax, rmax } = this.rules;
		update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
			if (!shouldHijack) { return; }

			let trigger: string;
			if (fromA === toA && fromB + 1 === toB) { // insert one char
				// TODO: support emoji as the trigger
				trigger = inserted.sliceString(0);
				if (!insertTrigSet.has(trigger)) { shouldHijack = false; }
			} else if (fromA + 1 === toA && fromB === toB) { // delete one char
				// TODO: support emoji as the del trigger
				const delChar = update.startState.sliceDoc(fromA, toA);
				if (!deleteTrigSet.has(delChar)) { shouldHijack = false; }
				// mock inserting a special DEL_TRIG
				trigger = DEL_TRIG;
				// del: 578 579 578 578 -> insert: 579 579 579 580
				fromA = toA;
				fromB += 1;
				toB = fromB + 1;
			} else {
				shouldHijack = false;
			}

			if (!shouldHijack) { return; }

			// As it is true that fromA == toA == fromB == toB - 1, fromB is used to calculate later
			// extract the doc to be replaced.
			let leftIdx = fromB - lmax;
			let insertPosFromInputTextHead = lmax;
			if (leftIdx < 0) {
				// at the very beginning of the document, we don't have enough chars required by lmax 
				leftIdx = 0;
				insertPosFromInputTextHead = fromB;
			}
			const input = update.startState.sliceDoc(leftIdx, fromB + rmax);
			const rule = this.rules.match(input, trigger, insertPosFromInputTextHead);
			if (rule != null) {
				// TODO: record meta info of a rule
				log("hit covert rule: %s", rule.left.join(""));
				const change = rule.mapToChanges(fromB, trigger === DEL_TRIG);
				change.annotations = ProgramTxn.of(true);
				changes.push(change);
			} else {
				shouldHijack = false;
			}
		});

		if (shouldHijack) { update.view.dispatch(...changes); }
		return;
	};

	sidesInsertFilter = (update: ViewUpdate) => {
		if (!update.docChanged || update.transactions.some(tr => ignoreThisTr(tr))) { return; }
		let shouldHijack = true;
		const changes: TransactionSpec[] = [];
		update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
			const char = inserted.sliceString(0);
			if (!shouldHijack || fromA == toA || toB != fromB + 1 || !this.rules.sideInsertMap.has(char)) {
				shouldHijack = false;
				return;
			}
			const insert = this.rules.sideInsertMap.get(char);
			const replaced = update.startState.sliceDoc(fromA, toA);
			changes.push({ changes: { from: fromB, to: toB, insert: insert.l + replaced + insert.r }, annotations: ProgramTxn.of(true) });
		});

		if (shouldHijack) { update.view.dispatch(...changes); }
	};

	updateProfileStatus = () => {
		this.profileStatus.setText(`Active Profile: ${this.settings.activeProfile}`);
	};
}
