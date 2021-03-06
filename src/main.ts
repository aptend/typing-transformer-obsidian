import { Plugin, Pos } from 'obsidian';
import { Annotation, EditorState, Extension, StateField, Transaction, TransactionSpec } from '@codemirror/state';
import { EditorView, keymap, ViewUpdate } from '@codemirror/view';

import { default as wasmbin } from '../liberty-web/charliberty_bg.wasm';
import init, { formatLine, getBlockRanges } from '../liberty-web/charliberty';
import { PUNCTS } from './const';
import { initLog, log } from './utils';
import { Rules } from './ext_convert';
import { libertyZone } from './ext_libertyzone';
import { TypingTransformerSettings, SettingTab, DEFAULT_SETTINGS } from './settings';


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
	rulesErr: string;
	availablExts: Extension[];
	activeExts: Extension[];


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
			keymap.of([
				{
					key: "a-b",
					run: (_view): boolean => {
						log("alt-b pressed");
						return true;
					}
				}
			])
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
	}

	onunload() { console.log('unloading typing transformer plugin'); }

	configureRules = (ruleString: string) => {
		this.rules = new Rules(ruleString);
		if (this.rules.errors.length > 0) {
			this.rulesErr = this.rules.errors.join('\n');
		} else {
			this.rulesErr = "";
		}
	};

	configureActiveExtsFromSettings = () => {
		const activeIds = [ExtID.Conversion, ExtID.SideInsert];
		const {debug, zoneIndicatorOn, autoFormatOn } = this.settings;
		debug ? activeIds.push(ExtID.Debug) : null;
		zoneIndicatorOn ? activeIds.push(ExtID.ZoneIndicator) : null;
		autoFormatOn ? activeIds.push(ExtID.AutoFormat) : null;
		this.activeExts.forEach((_ext, idx) => this.activeExts[idx] = []);
		activeIds.forEach((extid) => this.activeExts[extid] = this.availablExts[extid]);
	};

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

		const blockRanges = getBlockRanges(line.text, to - from);

		const isInBlock = (offset: number): boolean => {
			for (let i = blockRanges.length - 2; i > -1; i -= 2) {
				// a cursor at `offset`, is at the left side of `offset`-th char, so left-opend right-close here
				if (blockRanges[i] < offset && offset <= blockRanges[i + 1]) return true;
			}
			return false;
		};

		if (isInBlock(to - from)) { return; } // ...skip inblock

		const txt = state.doc.sliceString(from, to);

		// -2 to skip trailing punct, if any
		for (let i = txt.length - 2; i > 0; i--) {
			const ch = txt[i];
			if (ch != ' ' && PUNCTS.has(ch) && !isInBlock(i)) {
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
			log("toUpdate: %s, lspace: %d, rspace: %d", toUpdate, lspace, rspace);
			log("trigger char: %s", toUpdate.charAt(toUpdate.length - 1));
			update.view.dispatch({ changes: { from: from + lspace, to: to - rspace, insert: formatLine(trimmed) }, annotations: ProgramTxn.of(true) });
		}
	};

	convertFilter = (tr: Transaction): TransactionSpec | readonly TransactionSpec[] => {
		if (!tr.docChanged || tr.annotation(ProgramTxn)) { return tr; }
		let shouldHijack = true; // Hijack when some rules match all changes
		const changes: TransactionSpec[] = [];
		tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
			const { trigSet, lmax, rmax } = this.rules;
			const char = inserted.sliceString(0);
			if (!shouldHijack || fromA != toA || toB != fromB + 1 || !trigSet.has(char)) {
				shouldHijack = false;
				return;
			}

			let leftIdx = fromB - lmax;
			let insertPosFromLineHead = lmax;
			if (leftIdx < 0) {
				// at the very beginning of the document, we don't have enough chars required by lmax 
				insertPosFromLineHead = lmax + leftIdx;
				leftIdx = 0;
			}
			const input = tr.startState.doc.sliceString(leftIdx, fromB + rmax);
			const rule = this.rules.match(input, char, insertPosFromLineHead);
			if (rule != null) {
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
			changes.push({ changes: { from: fromA, to: fromA, insert: insert.l }, annotations: ProgramTxn.of(true) });
			changes.push({ changes: { from: toA, to: toA, insert: insert.r }, annotations: ProgramTxn.of(true) });
		});

		if (shouldHijack) { tr = tr.startState.update(...changes); }
		return tr;
	};

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
