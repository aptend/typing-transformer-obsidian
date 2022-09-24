import { Plugin, Pos } from 'obsidian';
import { Annotation, EditorState, Extension, StateField, Transaction, TransactionSpec } from '@codemirror/state';
import { EditorView, ViewUpdate } from '@codemirror/view';

import { default as wasmbin } from '../liberty-web/charliberty_bg.wasm';
import init, { formatLine, getBlockRanges } from '../liberty-web/charliberty';
import { PUNCTS } from './const';
import { initLog, log } from './utils';
import { Rules, DEL_TRIG } from './ext_convert';
import { libertyZone } from './ext_libertyzone';
import { TypingTransformerSettings, SettingTab, DEFAULT_SETTINGS } from './settings';
import { getAllCommands } from './global_commands';
import { ProfileModal } from './profilesModal';


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

export default class TypingTransformer extends Plugin {
	settings: TypingTransformerSettings;
	specialSections: Pos[];
	rules: Rules;
	availablExts: Extension[];
	activeExts: Extension[];
	profileStatus: HTMLElement;

	// Lifetime
	async onload() {
		console.log('loading typing transformer plugin');
		// read saved settings
		await this.loadSettings();
		initLog(this.settings);
		// make wasm ready
		await init(wasmbin);
		this.specialSections = [];
		this.activeExts = [];
		this.availablExts = [
			EditorState.transactionFilter.of(this.sidesInsertFilter),
			EditorState.transactionFilter.of(this.convertFilter),
			libertyZone(this.spotLibertyZone),
			EditorView.updateListener.of(this.addLiberty),
			deubgExt,
		];
		this.availablExts.forEach((_, idx) => this.activeExts[idx] = []);

		// parse saved rules
		this.configureRules(this.settings.convertRules);
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
		
		const profileStatus = this.addStatusBarItem();
		profileStatus.addClass('mod-clickable');
		profileStatus.addEventListener('click', this.onProfileStatusClick);
		
		this.profileStatus = profileStatus;

		this.updateProfileStatus();
	}

	onunload() { console.log('unloading typing transformer plugin'); }

	// Settings
	async loadSettings() {
		const data = await this.loadData();
		let defaultSource = DEFAULT_SETTINGS;
		// upgrade from 0.3.1 and before
		if (data && !data.hasOwnProperty("profiles") && data.convertRules != DEFAULT_SETTINGS.convertRules) {
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
		this.configureRules(ruleString);
		this.updateProfileStatus();
		await this.saveSettings();
	};

	configureRules = (ruleString: string) => {
		this.rules = new Rules(ruleString);
	};

	checkRules = (ruleString: string): string[] => {
		return new Rules(ruleString, true).errors;
	};

	configureActiveExtsFromSettings = () => {
		const activeIds = [ExtID.Conversion, ExtID.SideInsert];
		const { debug, zoneIndicatorOn, autoFormatOn } = this.settings;
		debug ? activeIds.push(ExtID.Debug) : null;
		zoneIndicatorOn ? activeIds.push(ExtID.ZoneIndicator) : null;
		autoFormatOn ? activeIds.push(ExtID.AutoFormat) : null;
		this.activeExts.forEach((_ext, idx) => this.activeExts[idx] = []);
		activeIds.forEach((extid) => this.activeExts[extid] = this.availablExts[extid]);
	};

	toggleAutoFormat = async () => {
		this.settings.autoFormatOn = !this.settings.autoFormatOn;
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
		const from = range.from, to = range.to;
		const toUpdate = update.view.state.doc.sliceString(from, to);
		if (PUNCTS.has(toUpdate.charAt(toUpdate.length - 1))) {
			const trimmed = toUpdate.trim();
			if (trimmed === '') { return; } // skip empty string
			const lspace = toUpdate.length - toUpdate.trimStart().length;
			const rspace = toUpdate.length - toUpdate.trimEnd().length;
			log("foramt: trigger char: %s, toUpdate: %s, lspace: %d, rspace: %d",
				toUpdate.charAt(toUpdate.length - 1), toUpdate, lspace, rspace);
			update.view.dispatch({ changes: { from: from + lspace, to: to - rspace, insert: formatLine(trimmed) }, annotations: ProgramTxn.of(true) });
		}
	};

	convertFilter = (tr: Transaction): TransactionSpec | readonly TransactionSpec[] => {
		if (!tr.docChanged || tr.annotation(ProgramTxn)) { return tr; }
		let shouldHijack = true; // Hijack when some rules match all changes
		const changes: TransactionSpec[] = [];
		tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
			if (!shouldHijack) { return; }

			const { insertTrigSet, deleteTrigSet, lmax, rmax } = this.rules;
			let char: string;
			if (fromA === toA && fromB + 1 === toB) {
				// insert one char
				char = inserted.sliceString(0);
				if (!insertTrigSet.has(char)) { shouldHijack = false; }
			} else if (fromA + 1 === toA && fromB === toB) {
				// delete one char
				const delChar = tr.startState.sliceDoc(fromA, toA);
				if (!deleteTrigSet.has(delChar)) { shouldHijack = false; }
				// mock inserting a special DEL_TRIG
				char = DEL_TRIG;
				// del: 578 579 578 578 -> insert: 579 579 579 580
				fromA = toA;
				fromB += 1;
				toB = fromB + 1;
			} else {
				shouldHijack = false;
			}

			if (!shouldHijack) { return; }

			let leftIdx = fromB - lmax;
			let insertPosFromLineHead = lmax;
			if (leftIdx < 0) {
				// at the very beginning of the document, we don't have enough chars required by lmax 
				insertPosFromLineHead = lmax + leftIdx;
				leftIdx = 0;
			}
			const input = tr.startState.sliceDoc(leftIdx, fromB + rmax);
			const rule = this.rules.match(input, char, insertPosFromLineHead);
			if (rule != null) {
				// TODO: record meta info of a rule
				log("hit covert rule: %s", rule.left.join(""));
				const change = rule.mapToChanges(fromB);
				change.annotations = ProgramTxn.of(true);
				changes.push(change);
			} else {
				shouldHijack = false;
			}
		});

		if (shouldHijack) { tr = tr.startState.update(...changes); }
		return tr;
	};

	sidesInsertFilter = (tr: Transaction): TransactionSpec | readonly TransactionSpec[] => {
		if (!tr.docChanged || tr.annotation(ProgramTxn)) { return tr; }
		let shouldHijack = true;
		const changes: TransactionSpec[] = [];
		tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
			const char = inserted.sliceString(0);
			if (!shouldHijack || fromA == toA || toB != fromB + 1 || !this.rules.sideInsertMap.has(char)) {
				shouldHijack = false;
				return;
			}
			const insert = this.rules.sideInsertMap.get(char);
			changes.push({ changes: { from: fromA, insert: insert.l }, annotations: ProgramTxn.of(true) });
			changes.push({ changes: { from: toA, insert: insert.r }, annotations: ProgramTxn.of(true) });
		});

		if (shouldHijack) { tr = tr.startState.update(...changes); }
		return tr;
	};

	onProfileStatusClick = () => {
		new ProfileModal(this.app, this).open();
	};

	updateProfileStatus = () => {
		this.profileStatus.setText(`Active Profile: ${this.settings.activeProfile}`);
	};
}
