'use strict';

const vscode = require('vscode');
const core = require('./core');

let promptLibrary = Object.freeze([]);
let libraryLoadPromise = null;

async function readPromptLibrary(context) {
  const uri = vscode.Uri.joinPath(context.extensionUri, 'data', 'prompts.json');
  const bytes = await vscode.workspace.fs.readFile(uri);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const parsed = JSON.parse(text);
  promptLibrary = core.normalizePromptLibrary(parsed);
  return promptLibrary;
}

function loadPromptLibrary(context, force = false) {
  if (!force && promptLibrary.length > 0) return Promise.resolve(promptLibrary);
  if (!force && libraryLoadPromise) return libraryLoadPromise;
  libraryLoadPromise = readPromptLibrary(context)
    .catch((error) => {
      promptLibrary = Object.freeze([]);
      throw error;
    })
    .finally(() => {
      libraryLoadPromise = null;
    });
  return libraryLoadPromise;
}

async function ensurePromptLibrary(context) {
  try {
    await loadPromptLibrary(context);
    return true;
  } catch (error) {
    const choice = await vscode.window.showErrorMessage(
      `PromptVault could not open its bundled library: ${error.message}`,
      'Retry'
    );
    if (choice !== 'Retry') return false;
    try {
      await loadPromptLibrary(context, true);
      return true;
    } catch (retryError) {
      await vscode.window.showErrorMessage(`PromptVault retry failed: ${retryError.message}`);
      return false;
    }
  }
}

async function choosePrompt(context) {
  if (!(await ensurePromptLibrary(context))) return null;
  return vscode.window.showQuickPick(core.quickPickItems(promptLibrary), {
    title: 'PromptVault',
    placeHolder: `Search ${promptLibrary.length} bundled prompts by title, tags, or body`,
    matchOnDescription: true,
    matchOnDetail: true,
    ignoreFocusOut: true,
  });
}

async function collectVariableValues(prompt) {
  const variables = core.parseVariables(prompt.body);
  const values = {};
  for (const [index, variable] of variables.entries()) {
    const defaultHint = variable.defaultValue === null
      ? 'Empty keeps the placeholder in the result.'
      : `Default: ${variable.defaultValue || '(empty)'}`;
    const multilineHint = variable.type === 'multiline'
      ? ' Use \\n for line breaks.'
      : '';
    const value = await vscode.window.showInputBox({
      title: `PromptVault variable ${index + 1} of ${variables.length}`,
      prompt: `Fill {{${variable.name}}} · ${variable.type}. ${defaultHint}${multilineHint}`,
      value: variable.defaultValue ?? '',
      placeHolder: `Enter ${variable.name}; press Escape to cancel the whole command`,
      ignoreFocusOut: true,
      validateInput: (candidate) => core.validateVariableValue(variable, candidate),
    });
    if (value === undefined) return null;
    values[variable.name] = value;
  }
  return values;
}

async function renderPickedPrompt(context) {
  const picked = await choosePrompt(context);
  if (!picked) return null;
  const values = await collectVariableValues(picked.prompt);
  if (values === null) return null;
  return {
    prompt: picked.prompt,
    text: core.renderPrompt(picked.prompt.body, values),
    unresolved: core.unresolvedVariables(picked.prompt.body, values),
  };
}

function completionSuffix(unresolved) {
  if (unresolved.length === 0) return '';
  return ` (${unresolved.length} unfilled placeholder${unresolved.length === 1 ? '' : 's'} preserved)`;
}

async function copyPrompt(context) {
  const result = await renderPickedPrompt(context);
  if (!result) return;
  try {
    await vscode.env.clipboard.writeText(result.text);
    await vscode.window.showInformationMessage(
      `PromptVault copied “${result.prompt.title}”${completionSuffix(result.unresolved)}.`
    );
  } catch (error) {
    await vscode.window.showErrorMessage(`PromptVault could not write to the clipboard: ${error.message}`);
  }
}

async function insertPrompt(context) {
  const result = await renderPickedPrompt(context);
  if (!result) return;
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    const choice = await vscode.window.showWarningMessage(
      'PromptVault needs an active text editor to insert this prompt.',
      'Copy instead'
    );
    if (choice === 'Copy instead') {
      await vscode.env.clipboard.writeText(result.text);
      await vscode.window.showInformationMessage('PromptVault copied the prompt instead.');
    }
    return;
  }

  const inserted = await editor.edit((builder) => {
    for (const selection of editor.selections) builder.replace(selection, result.text);
  });
  if (!inserted) {
    await vscode.window.showErrorMessage('PromptVault could not edit the active document.');
    return;
  }
  await vscode.window.showInformationMessage(
    `PromptVault inserted “${result.prompt.title}”${completionSuffix(result.unresolved)}.`
  );
}

async function previewPrompt(context) {
  const result = await renderPickedPrompt(context);
  if (!result) return;
  try {
    const document = await vscode.workspace.openTextDocument({
      content: result.text,
      language: 'markdown',
    });
    await vscode.window.showTextDocument(document, { preview: true });
  } catch (error) {
    await vscode.window.showErrorMessage(`PromptVault could not open the preview: ${error.message}`);
  }
}

async function reloadPromptLibrary(context) {
  try {
    const prompts = await loadPromptLibrary(context, true);
    await vscode.window.showInformationMessage(`PromptVault reloaded ${prompts.length} bundled prompts.`);
  } catch (error) {
    await vscode.window.showErrorMessage(`PromptVault reload failed: ${error.message}`);
  }
}

function registerCommand(context, id, handler) {
  context.subscriptions.push(vscode.commands.registerCommand(id, async () => {
    try {
      await handler(context);
    } catch (error) {
      await vscode.window.showErrorMessage(`PromptVault failed: ${error.message}`);
    }
  }));
}

function activate(context) {
  registerCommand(context, 'promptvault.open', copyPrompt);
  registerCommand(context, 'promptvault.insert', insertPrompt);
  registerCommand(context, 'promptvault.preview', previewPrompt);
  registerCommand(context, 'promptvault.reload', reloadPromptLibrary);

  void loadPromptLibrary(context).catch((error) => {
    console.error('PromptVault failed to preload its bundled library.', error);
  });
}

function deactivate() {
  promptLibrary = Object.freeze([]);
  libraryLoadPromise = null;
}

module.exports = { activate, deactivate };
