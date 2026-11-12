import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Never reuse .env, a developer's vault, or an already-installed plugin.
const root = resolve('artifacts/e2e-vault');
const plugin = resolve(root, '.obsidian/plugins/typing-transformer-obsidian');
await mkdir(plugin, { recursive: true });
await mkdir('artifacts/e2e', { recursive: true });
for (const name of ['main.js', 'styles.css', 'manifest.json']) {
  await copyFile(resolve(name), resolve(plugin, name));
}
const rules = `# regression fixture
'dpx|' -> 'don\\'t panic|'
'《|' -> '《|》'
'《|》' -x '|'
'q' -> '[' + '|]'
'\u0060' -> '\u0060' + '\u0060'
`;
await writeFile(resolve(plugin, 'data.json'), JSON.stringify({
  debug: false, autoFormatOn: true, zoneIndicatorOn: false,
  activeProfile: 'Global', convertRules: rules,
  profiles: [{ title: 'Global', content: rules }],
}));
await writeFile(resolve(root, 'Cold Start.md'), '```shell\nfoo\n```\n');
await writeFile(resolve(root, '.obsidian/app.json'), JSON.stringify({ livePreview: false }));
await writeFile(resolve(root, '.obsidian/community-plugins.json'), JSON.stringify(['typing-transformer-obsidian']));
await writeFile(resolve(root, '.obsidian/workspace.json'), JSON.stringify({
  main: { id: 'main', type: 'split', direction: 'vertical', children: [
    { id: 'regression-note', type: 'leaf', state: {
      type: 'markdown', state: { file: 'Cold Start.md', mode: 'source', source: true },
    } },
  ] }, active: 'regression-note',
}));
