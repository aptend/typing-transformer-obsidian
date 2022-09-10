## 1. Install Dependencies and Set-up Dev Environment

a. Install `Rust`

```sh
➜ curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

b. Install `wasm-pack`

```sh
➜ curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

c. Install `Node` and `npm`

They can be installed using [nvm](https://github.com/nvm-sh/nvm) on Mac or Linux or [nvm-windows](https://github.com/coreybutler/nvm-windows) on Windows.

```sh
# Install Nvm
➜ curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

# Install Node and nvm
➜ nvm install --lts

# Installing eslint to lint codes is recommended, but not required
➜ npm install -g eslint
```

## 2. Compile the plugin

a. Clone the repo and enter the working directory
```sh
➜ git clone https://github.com/aptend/typing-transformer-obsidian.git

➜ cd typing-transformer-obsidian
```

b. Create a file named with `.env` and edit the content like this.

```json
{"target_dir": "<path to the Obsidian Vault>/.obsidian/plugins/typing-transformer-obsidian"}
```

c. Build!
```sh
➜ make build
```

## 3. Others
```sh
# If you are developing, use:
➜ make dev

# If you edit the src codes, `make lint` will help.
➜ make lint
```
