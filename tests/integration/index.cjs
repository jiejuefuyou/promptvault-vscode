'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const vscode = require('vscode');

function replaceMethod(target, name, replacement) {
  const original = target[name];
  target[name] = replacement;
  assert.equal(target[name], replacement, `${name} must be replaceable in the Extension Host test`);
  return () => {
    target[name] = original;
  };
}

async function withWindowStubs(stubs, operation) {
  const restore = Object.entries(stubs).map(([name, replacement]) =>
    replaceMethod(vscode.window, name, replacement)
  );
  try {
    return await operation();
  } finally {
    restore.reverse().forEach((undo) => undo());
  }
}

async function run() {
  const version = process.env.PROMPTVAULT_VSCODE_UNDER_TEST ?? 'unknown';
  const extension = vscode.extensions.getExtension('snake-sun.promptvault');
  assert.ok(extension, 'PromptVault development extension must be discoverable');
  await extension.activate();
  assert.equal(extension.isActive, true, 'PromptVault must activate without errors');

  const expectedCommands = [
    'promptvault.open',
    'promptvault.insert',
    'promptvault.preview',
    'promptvault.reload',
  ];
  const registered = new Set(await vscode.commands.getCommands(true));
  expectedCommands.forEach((command) => assert.ok(registered.has(command), `${command} must be registered`));

  assert.deepEqual(extension.packageJSON.extensionKind, ['ui']);
  assert.equal(extension.packageJSON.capabilities.untrustedWorkspaces.supported, true);
  assert.equal(extension.packageJSON.capabilities.virtualWorkspaces.supported, true);

  const promptBytes = await vscode.workspace.fs.readFile(
    vscode.Uri.joinPath(extension.extensionUri, 'data', 'prompts.json')
  );
  const prompts = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(promptBytes));
  assert.equal(prompts.length, 160, 'real packaged corpus must contain 160 prompts');

  const core = require(path.join(extension.extensionPath, 'src', 'core.js'));
  const originalClipboard = await vscode.env.clipboard.readText();
  const messages = [];
  const failures = [];
  const commonStubs = {
    showInformationMessage: async (message) => {
      messages.push(String(message));
      return undefined;
    },
    showErrorMessage: async (message) => {
      failures.push(String(message));
      return undefined;
    },
  };

  try {
    let pickedWithVariables;
    await withWindowStubs({
      ...commonStubs,
      showQuickPick: async (items) => {
        pickedWithVariables = items.find((item) => core.parseVariables(item.prompt.body).length > 0);
        return pickedWithVariables;
      },
      showInputBox: async (options) => {
        assert.equal(typeof options.validateInput, 'function');
        return options.value || 'ExtensionHostValue';
      },
    }, async () => {
      await vscode.commands.executeCommand('promptvault.open');
    });
    assert.ok(pickedWithVariables, 'the real corpus must contain a prompt with variables');
    const copied = await vscode.env.clipboard.readText();
    assert.ok(copied.includes('ExtensionHostValue') || !copied.includes('{{'), 'copy command must render collected values');

    await vscode.env.clipboard.writeText('PromptVault cancellation sentinel');
    await withWindowStubs({
      ...commonStubs,
      showQuickPick: async (items) => items.find((item) => core.parseVariables(item.prompt.body).length > 0),
      showInputBox: async () => undefined,
    }, async () => {
      await vscode.commands.executeCommand('promptvault.open');
    });
    assert.equal(await vscode.env.clipboard.readText(), 'PromptVault cancellation sentinel', 'Escape/cancel must not write the clipboard');

    let insertText;
    const insertDocument = await vscode.workspace.openTextDocument({ content: 'left\nright', language: 'plaintext' });
    const insertEditor = await vscode.window.showTextDocument(insertDocument);
    insertEditor.selections = [
      new vscode.Selection(0, 0, 0, 4),
      new vscode.Selection(1, 0, 1, 5),
    ];
    await withWindowStubs({
      ...commonStubs,
      showQuickPick: async (items) => {
        const item = items.find((candidate) => core.parseVariables(candidate.prompt.body).length === 0);
        insertText = item.prompt.body;
        return item;
      },
      showInputBox: async () => {
        throw new Error('no-variable prompt must not request input');
      },
    }, async () => {
      await vscode.commands.executeCommand('promptvault.insert');
    });
    assert.equal(insertDocument.getText(), `${insertText}\n${insertText}`, 'insert must replace every active selection');

    const sourceBeforePreview = insertDocument.getText();
    await withWindowStubs({
      ...commonStubs,
      showQuickPick: async (items) => items.find((item) => core.parseVariables(item.prompt.body).length === 0),
      showInputBox: async () => {
        throw new Error('no-variable prompt must not request input');
      },
    }, async () => {
      await vscode.commands.executeCommand('promptvault.preview');
    });
    assert.equal(vscode.window.activeTextEditor.document.languageId, 'markdown', 'preview must open Markdown');
    assert.equal(insertDocument.getText(), sourceBeforePreview, 'preview must not modify the source editor');

    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    let fallbackText;
    await withWindowStubs({
      ...commonStubs,
      showQuickPick: async (items) => {
        const item = items.find((candidate) => core.parseVariables(candidate.prompt.body).length === 0);
        fallbackText = item.prompt.body;
        return item;
      },
      showInputBox: async () => {
        throw new Error('no-variable prompt must not request input');
      },
      showWarningMessage: async () => 'Copy instead',
    }, async () => {
      await vscode.commands.executeCommand('promptvault.insert');
    });
    assert.equal(await vscode.env.clipboard.readText(), fallbackText, 'insert without an editor must honor Copy instead');

    await withWindowStubs(commonStubs, async () => {
      await vscode.commands.executeCommand('promptvault.reload');
    });
    assert.ok(messages.some((message) => message.includes('reloaded 160 bundled prompts')));
    assert.deepEqual(failures, [], `Extension Host must not report errors: ${failures.join('; ')}`);
  } finally {
    await vscode.env.clipboard.writeText(originalClipboard);
  }

  console.log(`[PromptVault Extension Host] PASS on VS Code ${version}`);
}

module.exports = { run };
