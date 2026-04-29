// PromptVault VSCode extension — 113 AI prompts, command palette UI, clipboard copy.
// No build step. CommonJS for VSCode native compat.

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

let PROMPTS = [];

function loadPrompts(context) {
    const dataPath = path.join(context.extensionPath, 'data', 'prompts.json');
    try {
        PROMPTS = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    } catch (e) {
        vscode.window.showErrorMessage('PromptVault: failed to load prompts: ' + e.message);
        PROMPTS = [];
    }
}

function getVariables(body) {
    const found = [];
    body.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, name) => {
        const t = name.trim();
        if (!found.includes(t)) found.push(t);
    });
    return found;
}

async function pickPromptFlow() {
    if (PROMPTS.length === 0) {
        vscode.window.showWarningMessage('PromptVault: no prompts loaded.');
        return;
    }

    // Step 1 — pick a prompt
    const items = PROMPTS.map(p => ({
        label: p.title,
        description: (p.tags || []).slice(0, 3).join(' · '),
        detail: p.body.slice(0, 100).replace(/\n/g, ' ') + (p.body.length > 100 ? '…' : ''),
        prompt: p,
    }));

    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Search 113 AI prompts (Claude Code / Midjourney / Coze / writing / marketing…)',
        matchOnDescription: true,
        matchOnDetail: true,
    });
    if (!picked) return;

    const p = picked.prompt;
    const vars = getVariables(p.body);

    // Step 2 — fill variables (if any)
    let body = p.body;
    if (vars.length > 0) {
        for (const v of vars) {
            const value = await vscode.window.showInputBox({
                prompt: `Fill {{${v}}}`,
                placeHolder: `Enter value for ${v} (Esc to skip — placeholder will remain)`,
                ignoreFocusOut: true,
            });
            if (value === undefined) {
                // User pressed Esc — skip this variable; placeholder stays
                continue;
            }
            // Replace this specific variable globally
            body = body.replace(new RegExp(`\\{\\{\\s*${escapeRegex(v)}\\s*\\}\\}`, 'g'), value);
        }
    }

    // Step 3 — copy to clipboard
    await vscode.env.clipboard.writeText(body);
    vscode.window.showInformationMessage(`PromptVault: copied "${p.title}" to clipboard`);
}

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function activate(context) {
    loadPrompts(context);
    const disposable = vscode.commands.registerCommand('promptvault.open', pickPromptFlow);
    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = { activate, deactivate };
