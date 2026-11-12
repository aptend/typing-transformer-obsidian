# Testing Guide

This project uses [Vitest](https://vitest.dev/) as the testing framework.

Use Node.js 26 and run `npm ci` first. See [Development](../docs/Development.md) for the full toolchain.

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
`src/settings.ts`; it does not establish Obsidian UI or WASM coverage.

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

The project uses mocks for:
- **Obsidian API**: File system operations, plugins, UI components
- **CodeMirror**: Editor state and view components

The `unit` project aliases Obsidian and CodeMirror to mocks. The `editor-logic`
project mocks only Obsidian and uses real CodeMirror State/history. These tests
do not instantiate Obsidian or exercise actual IME input; use the local vault
workflow in the development guide for those checks.

## CI Integration

Tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: npm test -- --run
  
- name: Generate coverage
  run: npm run test:coverage -- --run
```

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
