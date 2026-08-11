# PromptVault for VS Code

A local prompt library in the Command Palette. Pick a bundled prompt, fill `{{variables}}`, then copy it, insert it at the current selections, or open a preview document.

## Commands

Open the Command Palette and run one of:

- **PromptVault: Pick and Copy Prompt**
- **PromptVault: Pick and Insert Prompt**
- **PromptVault: Pick and Preview Prompt**
- **PromptVault: Reload Bundled Prompt Library**

The searchable picker reads its count from `data/prompts.json`; marketplace and UI copy no longer depend on a hard-coded library size.

## Variable syntax

PromptVault supports the same placeholder forms as the iOS app:

```text
{{name}}
{{language:string=Japanese}}
{{count:int=5}}
{{notes:multiline=}}
```

- Defaults are prefilled.
- Integer fields reject non-whole-number input.
- For a multiline field, enter literal `\n` where a line break should appear.
- Submit an empty required field to preserve its placeholder.
- Escape cancels the whole command instead of silently producing a partial result.

## Insert and preview behavior

**Insert** replaces every active selection. With multiple cursors, the rendered prompt is inserted at each selection. When no text editor is active, PromptVault offers to copy instead.

**Preview** opens an untitled Markdown document containing the rendered result. It does not modify the current file.

## Install from source

1. Clone or download the repository.
2. Open it in VS Code.
3. Press `F5` to launch an Extension Development Host.

For a packaged build, install the resulting `.vsix` through **Extensions: Install from VSIX**.

## Privacy and trust

- No account or developer server.
- No analytics, telemetry, ads, remote scripts, or network client.
- Prompt data is packaged in `data/prompts.json`.
- Variable values are held only for the current command.
- Clipboard writes occur only after the user invokes the copy command or accepts the copy fallback.
- The extension declares support for untrusted and virtual workspaces because it does not read workspace files.
- `extensionKind: ["ui"]` keeps clipboard and Quick Input behavior on the local UI side when using Remote SSH, Dev Containers, or Codespaces.

The runtime reads its bundled data through `vscode.workspace.fs`; it does not import Node `fs`, `path`, network, or process modules.

## Architecture

```text
src/core.js       pure validation, typed-variable parsing and rendering
src/extension.js  VS Code command and editor adapter
data/prompts.json bundled prompt library
tests/            dependency-free Node tests
scripts/          package and runtime contracts
```

Development-only tests, scripts, and workflow files are excluded from the VSIX by `.vscodeignore`.

## Verify

No third-party runtime or test dependencies are required:

```bash
npm run verify
```

The verification gate checks:

- prompt JSON shape and exact duplicate records
- command contribution/activation/registration parity
- typed variables, defaults, multiline escapes and integer validation
- no runtime filesystem, network, child-process or dynamic-code access
- trusted/virtual workspace declarations and UI extension placement
- VSIX development-file exclusions

## License

Code is MIT. Bundled prompt content is available for personal use; commercial redistribution requires permission.
