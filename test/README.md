# Testing Guide

This project uses [Vitest](https://vitest.dev/) as the testing framework.

Pull requests run the complete regression suite in GitHub Actions; no local
Obsidian installation is required. See [GitHub Actions regression suite](#github-actions-regression-suite)
below for the scenarios and diagnostics.

For optional local execution, use Node.js 26, run `npm ci`, and build with
`make build` first: the plugin/WASM projects import generated bindings. Building
deploys to the target in `.env` if configured. See [Development](../docs/Development.md)
for the full toolchain.

## Running Tests

```bash
# Run tests once
npm test -- --run

# Run tests in watch mode (auto-rerun on file changes)
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

## Viewing Coverage Report

After running `npm run test:coverage`, a detailed HTML report is generated in the `coverage/` directory.

**To view the coverage UI:**

```bash
# Option 1: Open directly in browser
# On Linux/WSL
xdg-open coverage/index.html

# On macOS
open coverage/index.html

# On Windows
start coverage/index.html

# Option 2: Use a local server (recommended)
npx serve coverage
# Then open http://localhost:3000 in your browser
```

The coverage UI provides:
- 📊 **Overview**: Statement, branch, function, and line coverage percentages
- 📂 **File-by-file breakdown**: Click any file to see detailed coverage
- 🎨 **Color-coded source**: Green (covered), red (not covered), yellow (partial)
- 🔍 **Line-by-line analysis**: See exactly which lines are tested

## Test Structure

```
test/
├── unit/               # Unit tests
│   ├── conv-rule-match.test.ts # Rule matching and parser edge cases
│   ├── editor-logic.test.ts    # Real CodeMirror State and history
│   ├── rule-parser.test.ts     # Rule parsing and validation
│   └── side-rule.test.ts       # Selection rule tests
├── plugin/             # Production filters and draft-validation isolation
├── wasm/               # Actual compiled Rust/WASM bindings
├── e2e/                # Real Obsidian input and window regressions
├── mocks/              # Mock implementations
│   ├── obsidian.ts             # Mock Obsidian API
│   ├── codemirror-state.ts     # Mock CodeMirror State
│   └── codemirror-view.ts      # Mock CodeMirror View
└── README.md           # This file
```

## Test Coverage

The test suite currently covers:

### Core Functionality Tested:
- ✅ String utility functions (`findOnlyAnchor`, `prefixOf`, `suffixOf`)
- ✅ Rule parser with various input formats
- ✅ Conversion rules (insert rules)
- ✅ Deletion rules (`-x`)
- ✅ Selection rules (`+`)
- ✅ Error handling and validation
- ✅ Unicode and emoji support
- ✅ Escape sequences
- ✅ Comment parsing
- ✅ Cursor position calculation in selection rules

### Coverage Statistics

Generate a fresh report with `npm run test:coverage -- --run`. Coverage excludes
`src/settings.ts`; JavaScript coverage does not measure Rust internals or
establish UI coverage. The separate WASM and Obsidian suites exercise those
boundaries through behavior assertions.

## Writing New Tests

### Example: Testing a new rule type

```typescript
import { describe, it, expect, vi } from 'vitest';
import { Rules } from '../../src/ext_convert';

describe('My new feature', () => {
  it('should do something', async () => {
    const rules = new Rules();
    const adapter = createMockAdapter();
    
    await rules.parse("'test|' -> 'result|'", adapter as any);
    
    expect(rules.errors).toHaveLength(0);
    expect(rules.rules).toHaveLength(1);
  });
});
```

## Mocking

The `unit` project aliases Obsidian and CodeMirror to mocks. The `editor-logic`
project mocks only Obsidian and uses real CodeMirror State/history. The `plugin`
project uses the actual plugin and rules with real CodeMirror transactions,
while mocking Obsidian, Settings UI and WASM. The `wasm` project loads the compiled
module without mocks. Only the separate E2E suite instantiates Obsidian. Native
IME composition still requires the manual vault checks below.

## CI Integration

See [the workflow](../.github/workflows/regression.yml) and the detailed CI
description below. A failing stage marks the GitHub check as failed.

## Tips

1. **Fast feedback**: Use watch mode during development
2. **Debug tests**: Add `console.log()` or use the UI mode for better debugging
3. **Coverage**: Aim to test critical paths and edge cases
4. **Mock carefully**: Only mock external dependencies, not internal logic

## Manual Obsidian regression checks

Use a dedicated vault with only this plugin enabled. Check both Source mode
and Live Preview. The 2026-11-11 smoke run on Obsidian 1.14.4 verified:

- Typing `dpx` one key at a time expands to `don't panic`; undo restores the
  trigger and then the input, and redo restores the conversion.
- Single-character Chinese punctuation insertion pairs `《》` and `（）`, keeps
  the cursor between the pair, supports chained `《` conversion, and deletes
  paired punctuation on backspace.
- Selecting `hello` and typing `<` produces `<hello>`.
- Inserting `中文English` and typing a comma produces `中文 English,`.
- Opening a fenced code block leaves it unchanged; typing punctuation inside
  the block does not add spacing.
- Creating a Profile, saving a custom rule, and switching back to Global
  enables and disables that rule as expected.
- The separate Settings window renders initial rule text and syntax highlighting
  immediately, and the selected Profile remains readable in the light theme.

The scripted Chinese punctuation checks insert one character through the
clipboard. They do not cover a real IME candidate/composition session. Test
Chinese IME input manually before release, and check interactions with other
typing plugins separately in the user's usual vault.

## GitHub Actions regression suite

The `Regression` workflow runs on pull requests and pushes to `main`, and can be
started manually. Builds and tests run on GitHub-hosted Ubuntu, not against an
installed local Obsidian or a developer vault. The job has read-only repository
permissions and does not need an Obsidian account or repository secrets.

The runner builds the production JS/WASM first, then runs lint, typechecking,
Vitest (including the production event filters and actual compiled WASM), and
WebdriverIO with `wdio-obsidian-service`. Desktop tests pin Obsidian app 1.14.4
and installer 1.9.14 independently. Downloads are cached; one worker reuses the
application except for the cold-start regression. There are no automatic retries
to hide failures.

The UI suite covers fenced-code cold start/restart (#124), Source and Live
Preview conversion with reversible undo/redo, paired deletion and selection
cursor placement, automatic spacing, independent Settings-window rendering and
mouse/arrow input (#125), and Profile commands across plugin reload (#123).
Additional UI scenarios cover invalid drafts on close/reopen, cancel/confirm
discard when switching Profile, actual system clipboard updates (#109), full
undo/redo and redo invalidation after both effective and no-op formatting (#74),
and code-block protection while background notes are indexed in both editor
modes. Clipboard race tests hold a platform read pending while real input types,
moves the cursor, or switches notes, then release it and verify editor content,
selection and unhandled rejections. This controlled platform stub is separate
from the test using the runner's actual system clipboard.

An asynchronous conversion is canceled if the editor state, active rules or
editor attachment changes while it waits; the typed trigger remains literal.
Formatting obtains metadata for the editor's own file, including when other
files are being indexed. Production-boundary tests cover both guarantees, as
well as Profile switches and detached editors during delayed reads.
An isolated API-boundary suite also verifies the `editorViewField` fallback
when older Obsidian versions do not export `editorInfoField`; this does not
replace running the UI suite against those older applications.

The event-boundary tests execute the production `sidesInsertFilter`, so removing
its non-user-input guard causes a failure; they do not duplicate that guard in a
test helper. Draft-validation tests require active rules to remain unchanged.

`test/e2e/prepare.mjs` seeds an expendable vault under `artifacts/` with only the
built plugin and known test data. The service makes another isolated copy. Test
setup may use Obsidian APIs; tested typing, selection, undo/redo and Settings
editing use real WebDriver input. Assertions read editor content, selection,
configuration and on-disk notes. This is not native OS IME testing. Windows,
macOS, older application versions and mobile remain separate release checks.

Failures upload coverage, WebDriver logs, a screenshot and active-editor state
when available, retained for seven days. Find the artifact on the GitHub Actions
run page. Set `Unit, WASM and Obsidian regression` as a required check in branch
protection if merges must be blocked on failures. The existing release workflow
is unchanged.

E2E declarations use their own TypeScript configuration. Only that configuration
skips checking third-party `.d.ts` internals (WDIO/Node/DOM declaration conflicts);
our E2E source and the plugin still undergo typechecking. Independent test stages
continue after a failed assertion to collect diagnostics, but any failed stage
keeps the GitHub check red. A CI-only mutation check temporarily removes the
production input-event guard and requires its regression assertion to fail,
then restores the source in a `finally` block.
