# PromptVault — VSCode Extension

> 113 AI prompts in your command palette. Pick → fill `{{variable}}` → copy to clipboard.

## What it does

`Cmd/Ctrl + Shift + P` → type "PromptVault: Pick a Prompt" → select → fill blanks → done. The prompt is on your clipboard, ready to paste into ChatGPT / Claude / Cursor / wherever.

## Why VSCode-native

If you're using Cursor / Claude Code / Continue.dev / Copilot Chat in VSCode and find yourself rewriting the same prompts daily, this extension turns 30 seconds of "navigate to my prompt note, copy, paste" into 3 seconds.

## Install

### From source (today)

```sh
git clone https://github.com/jiejuefuyou/promptvault-vscode.git
cd promptvault-vscode
# In VSCode:
# 1. Cmd+Shift+P → "Extensions: Install from VSIX..." (if .vsix available)
# OR
# 2. Open the repo folder, press F5 → opens extension in dev host
# OR
# 3. Symlink to ~/.vscode/extensions/promptvault and reload
```

### From Marketplace (coming soon)

The extension will be published to the [VSCode Marketplace](https://marketplace.visualstudio.com/) — listing pending publisher account verification.

[autoappnotes Substack](https://autoappnotes.substack.com) will announce.

## How it works

1. **Pick a prompt**: command palette opens a searchable list of 113 prompts. Search by title, tags, or body content.
2. **Fill variables**: if the prompt has `{{variables}}`, an input box opens for each one. Press Esc to skip a variable (the placeholder stays in the output).
3. **Copy**: the rendered prompt is copied to your clipboard. A status notification confirms.

## Privacy

- ✅ Zero networking — the 113 prompts are bundled in `data/prompts.json` (53 KB)
- ✅ Zero data collection — your variable inputs never leave your machine
- ✅ Zero analytics SDKs

The only VSCode API the extension uses:
- `vscode.commands.registerCommand` — register the slash command
- `vscode.window.showQuickPick` / `showInputBox` — UI
- `vscode.env.clipboard.writeText` — copy

You can audit the entire extension by reading `src/extension.js` (~80 lines).

## Updates

When the iOS sister app's bundled prompts update, regenerate `data/prompts.json` from [autoapp-prompt-vault](https://github.com/jiejuefuyou/autoapp-prompt-vault):

```sh
cp ../repos/autoapp-prompt-vault/PromptVault/Resources/starter_prompts.json data/prompts.json
git commit -am "data: sync prompts from upstream"
```

## Sister projects

- 🌐 [Web edition](https://jiejuefuyou.github.io/prompts.html) — same prompts in the browser
- 🪟 [Chrome extension](https://github.com/jiejuefuyou/promptvault-chrome) — same prompts in browser toolbar
- 📱 [iOS app](https://github.com/jiejuefuyou/autoapp-prompt-vault) — same prompts on iPhone (awaiting App Store)
- 📄 [Markdown pack](https://github.com/jiejuefuyou/autoapp-toolkit) — bundled in autoapp-toolkit

## License

Code: MIT. Prompt content: personal use unrestricted; commercial redistribution by permission.

## Author

[@snake_sun on dev.to](https://dev.to/snake_sun) · [autoappnotes Substack](https://autoappnotes.substack.com)
