# Development

## 1. Install the toolchain

Use Node.js 26 (the exact nvm version is recorded in `.nvmrc`), npm, Rust,
and wasm-pack. `npm run build` alone does not compile the Rust/WASM component.

With an existing nvm installation:

```sh
nvm install
nvm use
```

On macOS, Homebrew is an alternative:

```sh
HOMEBREW_NO_INSTALL_CLEANUP=1 brew install node wasm-pack
export PATH="$(brew --prefix node)/bin:$PATH"
```

The PATH change applies to the current shell. Check `node --version` before
running commands; `.nvmrc` records the tested Node version.

Install Rust through [rustup](https://rustup.rs/) if it is not already installed.
Then install the WASM target:

```sh
rustup target add wasm32-unknown-unknown
```

On systems without Homebrew, install wasm-pack using:

```sh
cargo install wasm-pack --locked
```

See the [wasm-pack documentation](https://wasm-bindgen.github.io/wasm-pack/) for
other supported installation methods.

Check the tools:

```sh
node --version
npm --version
rustc --version
wasm-pack --version
```

## 2. Install project dependencies and build

Run these commands from the repository root:

```sh
npm ci
make build
```

The project records npm install-script approvals for esbuild and fsevents. When
updating either package, review and renew its pinned approval with
`npm install-scripts approve esbuild fsevents`.

`make build` compiles `charliberty/` to `liberty-web/`, patches the generated JS
loader, then bundles `src/main.ts` and the WASM binary into `main.js`.
Without `.env`, the bundle is written to the repository root.
`liberty-web/` and `main.js` are generated files and are not committed.

Dependency versions were refreshed on 2026-11-11. The tested toolchain is Node
26.13.0, npm 12.2.2, Rust 1.99.1, and wasm-pack 0.15.1. Rust crate versions are
recorded in `charliberty/Cargo.toml` and `charliberty/Cargo.lock`.

Most npm packages use their latest stable releases, with two compatibility limits:

- Obsidian SDK 1.14.4 requires CodeMirror State 6.7.6 and View 6.43.13 exactly,
  so View is not upgraded to 6.43.15. SDK versions do not correspond to every
  desktop app release. Local UI smoke tests use Obsidian 1.14.4 (installer
  version 1.9.14); verify older desktop runtimes separately.
- TypeScript ESLint 8.72.2 supports TypeScript >=4.8.4 and <6.1.0. The project
  therefore uses TypeScript 6.0.3 rather than 7.0.2.

Keep the State/View npm overrides aligned with the Obsidian SDK: multiple State
instances can break editor extensions and history. Do not use
`--legacy-peer-deps` for normal installation. Commit `package-lock.json` when
changing dependencies, and use `npm ci` to reproduce the dependency tree.

TypeScript uses bundler module resolution. `strict: false` explicitly preserves
the previous TypeScript 5 checking policy now that TypeScript 6 defaults to strict
mode; `noImplicitAny` remains enabled. Vitest uses `vitest.config.mts` so its ESM
configuration loads correctly with the current Vite version.

## 3. Test with local Obsidian

Use a separate test vault for repeatable tests. The same workflow can target
an existing vault when testing compatibility with its settings and other plugins.
See Obsidian's [Build a plugin](https://docs.obsidian.md/Plugins/Getting%20started/Build%20a%20plugin)
guide for the general plugin development workflow.

Create the plugin directory and copy the static files once:

```sh
PLUGIN_DIR="/absolute/path/to/test-vault/.obsidian/plugins/typing-transformer-obsidian"
mkdir -p "$PLUGIN_DIR"
cp manifest.json styles.css "$PLUGIN_DIR/"
```

Create `.env` in the repository root. This file contains JSON, not shell
assignments; use the actual absolute plugin directory:

```json
{"target_dir": "/absolute/path/to/test-vault/.obsidian/plugins/typing-transformer-obsidian"}
```

Then start development mode:

```sh
make dev
```

Enable community plugins and Typing Transformer in the test vault. Use Source
mode or Live Preview (CodeMirror 6), rather than Reading view.

For automatic reloads, install and enable Hot Reload in that vault and create
its marker in the Typing Transformer plugin directory:

```sh
touch "$PLUGIN_DIR/.hotreload"
```

With Hot Reload active, `main.js` and `styles.css` changes reload the plugin.
Without Hot Reload, disable and re-enable Typing Transformer after rebuilding.

Build/watch details:

- TypeScript changes are rebuilt automatically by `make dev`.
- CSS is copied when changed; the initial copy is still required.
- `manifest.json` is not copied automatically; copy it again after editing it.
- Rust changes are not watched by esbuild. Run `make wasm` in another terminal,
  or stop development mode and rerun `make dev` after changing Rust sources.
- After changing Cargo dependencies, run `make wasm` explicitly; the incremental
  Makefile target only tracks Rust source files.
- `.env` is read at startup. Restart the build watcher after changing its target.
- The WASM binary is embedded in `main.js`; no separate WASM deployment is needed.

Check real typing, Chinese IME composition, paired punctuation, selection rules,
backspace, undo/redo, code blocks, automatic spacing, and Profile switching.
Typing or IME testing should use actual keyboard input; pasting a whole string
can produce a different editor transaction.

## 4. Automated checks

```sh
npm test -- --run                 # one complete test run
npm test                         # watch mode in an interactive terminal
npm run test:ui                   # Vitest UI
npm run test:coverage -- --run    # coverage report
npm run lint                    # read-only lint check
npm run typecheck               # TypeScript check
```

`make lint` runs ESLint with `--fix` and modifies source files.
See [the testing guide](../test/README.md) for test projects and coverage.

## 5. Releases

The release workflow builds on tag pushes using the Node version in `.nvmrc`
and `npm ci`. Release artifacts contain `main.js`, `manifest.json`, and
`styles.css`. For release builds, remove or temporarily move `.env` so the
bundle is produced in the repository root, where the packaging job expects it.
