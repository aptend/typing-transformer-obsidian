liberty-src = charliberty/src/*
liberty-dst = liberty-web

liberty-js = $(liberty-dst)/charliberty.js


$(liberty-js): $(liberty-src)
	wasm-pack build charliberty -t web -d ../$(liberty-dst)


.PHONY: wasm build dev

wasm:
	wasm-pack build charliberty -t web -d ../$(liberty-dst)
	node ./scripts/wasm_post.js

build: $(liberty-js)
	npm run build

dev: $(liberty-js)
	npm run dev
