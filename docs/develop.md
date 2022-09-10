## Set up dev env

1. Install `Rust`

```sh
➜ curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. Install `wasm-pack`

```sh
➜ curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

3. Install `Node` and `npm`

For instance, if you are on Mac and have not installed them, you could install them using `nvm`

```sh
# Install Nvm
➜ curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

# Install Node and nvm
➜ nvm install --lts

# Recommand to install eslint first to lint codes
➜ npm install -g eslint
```

4. Compile the plugin

- Clone the repo and enter the working directory
```sh
➜ git clone https://github.com/aptend/typing-transformer-obsidian.git

➜ cd typing-transformer-obsidian
```

- Create a file named with `.env` and edit the content like this.

```json
{"target_dir": "<path to the Obsidian Vault>/.obsidian/plugins/typing-transformer-obsidian"}
```

- Build!
```sh
➜ make build
```

5. Others
```sh
# if you are developing, try
➜ make dev

# If you edit the src codes, `make lint` comes to help.
➜ make lint
```
