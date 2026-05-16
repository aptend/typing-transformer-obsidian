# Testing Guide

This project uses [Vitest](https://vitest.dev/) as the testing framework.

📊 **[Coverage UI Guide](./COVERAGE.md)** - Detailed guide on using the coverage report UI

## Running Tests

```bash
# Run tests once
npm test

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
│   ├── utils.test.ts           # String utility functions
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

### Coverage Statistics:
- Overall: ~58% statement coverage
- ext_convert.ts: ~73% statement coverage (main conversion logic)

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

These mocks are automatically aliased in `vitest.config.ts` so you don't need to manually import them.

## CI Integration

Tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: npm test -- --run
  
- name: Generate coverage
  run: npm run test:coverage
```

## Tips

1. **Fast feedback**: Use watch mode during development
2. **Debug tests**: Add `console.log()` or use the UI mode for better debugging
3. **Coverage**: Aim to test critical paths and edge cases
4. **Mock carefully**: Only mock external dependencies, not internal logic
