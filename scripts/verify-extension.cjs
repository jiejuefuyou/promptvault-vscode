const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const core = require('../src/core');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const pkg = JSON.parse(read('package.json'));
const extension = read('src/extension.js');
const prompts = core.normalizePromptLibrary(JSON.parse(read('data/prompts.json')));
const ignored = read('.vscodeignore');

assert.equal(pkg.version, '1.1.0');
assert.equal(pkg.main, './src/extension.js');
assert.deepEqual(pkg.extensionKind, ['ui']);
assert.equal(pkg.capabilities.untrustedWorkspaces.supported, true);
assert.equal(pkg.capabilities.virtualWorkspaces.supported, true);
assert.ok(!/\b113\b/.test(pkg.displayName + pkg.description), 'Marketplace copy must not hard-code prompt count.');
assert.ok(!pkg.contributes.keybindings, 'Dead keybindings must not return.');

const commandIDs = new Set(pkg.contributes.commands.map((command) => command.command));
for (const id of ['promptvault.open', 'promptvault.insert', 'promptvault.preview', 'promptvault.reload']) {
  assert.ok(commandIDs.has(id), `Missing contributed command: ${id}`);
  assert.ok(pkg.activationEvents.includes(`onCommand:${id}`), `Missing activation event: ${id}`);
  assert.ok(extension.includes(`'${id}'`), `Command is not registered in extension.js: ${id}`);
}

assert.ok(!/require\(['"](?:fs|path|http|https|child_process)['"]\)/.test(extension), 'Extension must use VS Code APIs rather than Node filesystem/network/process APIs.');
assert.ok(!/\beval\s*\(|new Function\s*\(/.test(extension), 'Dynamic code execution is forbidden.');
assert.ok(!/https?:\/\//.test(extension), 'Runtime code must not call remote services.');
assert.match(extension, /vscode\.workspace\.fs\.readFile/);
assert.match(extension, /vscode\.env\.clipboard\.writeText/);
assert.match(extension, /editor\.selections/);

assert.ok(prompts.length >= 20, 'Bundled library unexpectedly small.');
assert.equal(new Set(prompts.map((prompt) => `${prompt.title}\u0000${prompt.body}`)).size, prompts.length, 'Bundled data contains exact duplicate prompts.');
assert.match(ignored, /tests\/\*\*/);
assert.match(ignored, /scripts\/\*\*/);

console.log(`✅ VS Code extension contract passed with ${prompts.length} bundled prompts.`);
