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

1. Clone or download this repository.
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
data/prompts.json generated prompt library
tests/            dependency-free core tests plus Extension Host integration
scripts/          package/runtime contracts and the VS Code matrix runner
```

Development-only tests, scripts, and workflow files are excluded from the VSIX by `.vscodeignore`.

## Corpus provenance

The current packaged snapshot contains 160 prompts projected from:

```text
jiejuefuyou/promptvault-wechat-miniprogram
commit 2f0ed5f319b2475fc3375f11cd0f43cb998bb39d
```

`autoapp-toolkit` run `31464066016` first proved that the previous 113-prompt Chrome and VS Code bundles shared identical content with the canonical corpus and were only missing the same 47 records. The raw canonical projection then preserved full-width punctuation, line content, and Unicode composition, produced:

```text
data/prompts.json sha256
f0ac21ec4bd9905e2d49504cc139544397159224333a35aba08e0cab820340f5
```

and passed this repository's real-bundle verification before commit. Comparison normalization is never written back into prompt content.

## Verify

The shipping extension has no third-party runtime dependencies. Install the locked development tools, then run the portable contracts:

```bash
npm ci
npm run verify
```

For real Extension Development Host coverage on VS Code 1.80.2 and the current stable release:

```bash
npm run test:extension-host
```

That matrix activates the real development extension and exercises command registration, the 160-record bundled library, copy, whole-command cancellation, multi-selection insert, Markdown preview, no-editor copy fallback, reload, and clipboard restoration.

The verification gate checks:

- prompt JSON shape and exact duplicate records
- command contribution/activation/registration parity
- typed variables, defaults, multiline escapes and integer validation
- no runtime filesystem, network, child-process or dynamic-code access
- trusted/virtual workspace declarations and UI extension placement
- VSIX development-file exclusions

## License

Code is MIT. Bundled prompt content is available for personal use; commercial redistribution requires permission.
