'use strict';

// Restricted Mode + virtual workspace gate for the real Extension Host.
//
// @vscode/test-electron's runTests() always appends --disable-workspace-trust, so the
// regular `test:extension-host` run can never observe Restricted Mode. This runner launches
// the same downloaded VS Code build directly, with Workspace Trust enabled but never
// prompting, and opens (1) an untrusted local folder — Restricted Mode — and (2) a `pvtest:`
// virtual workspace served by tests/trust/virtual-fs, which records every file access (VS Code
// treats virtual workspaces as trusted by design; that run proves virtual-workspace support
// and that no workspace file is ever read).
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { downloadAndUnzipVSCode } = require('@vscode/test-electron');

const repo = path.resolve(__dirname, '..');
const testsPath = path.join(repo, 'tests', 'trust', 'index.cjs');
const virtualFsExtension = path.join(repo, 'tests', 'trust', 'virtual-fs');
const versions = process.env.PROMPTVAULT_VSCODE_VERSIONS
  ? process.env.PROMPTVAULT_VSCODE_VERSIONS.split(',').map((version) => version.trim()).filter(Boolean)
  : ['1.80.2', 'stable'];

// Trust on, prompts off: a folder the profile has never seen opens straight into Restricted Mode.
const TRUST_SETTINGS = {
  'security.workspace.trust.enabled': true,
  'security.workspace.trust.startupPrompt': 'never',
  'security.workspace.trust.banner': 'never',
  'security.workspace.trust.untrustedFiles': 'open',
};

function launch(executable, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

async function main() {
  // Keep editor state in a short temp root (VS Code's socket path limit on macOS, see the
  // Extension Host runner).
  const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-trust-'));
  const failed = [];
  try {
    for (const [index, version] of versions.entries()) {
      const executable = await downloadAndUnzipVSCode(version);
      for (const scheme of ['file', 'pvtest']) {
        const root = path.join(stateRoot, `v${index}-${scheme}`);
        const userDataDir = path.join(root, 'u');
        fs.mkdirSync(path.join(userDataDir, 'User'), { recursive: true });
        fs.mkdirSync(path.join(root, 'e'), { recursive: true });
        fs.writeFileSync(
          path.join(userDataDir, 'User', 'settings.json'),
          `${JSON.stringify(TRUST_SETTINGS, null, 2)}\n`
        );
        const args = [
          `--user-data-dir=${userDataDir}`,
          `--extensions-dir=${path.join(root, 'e')}`,
          '--disable-extensions',
          '--disable-gpu',
          '--no-sandbox',
          '--disable-gpu-sandbox',
          '--disable-updates',
          '--skip-welcome',
          '--skip-release-notes',
          '--no-cached-data',
          `--extensionDevelopmentPath=${repo}`,
          `--extensionTestsPath=${testsPath}`,
        ];
        if (scheme === 'file') {
          const workspace = path.join(root, 'w');
          fs.mkdirSync(workspace);
          fs.writeFileSync(path.join(workspace, 'workspace-sentinel.txt'), 'PromptVault must never read this file.\n');
          args.unshift(workspace);
        } else {
          args.unshift('--folder-uri=pvtest:/');
          args.push(`--extensionDevelopmentPath=${virtualFsExtension}`);
        }
        const env = { ...process.env, PROMPTVAULT_TRUST_SCHEME: scheme, PROMPTVAULT_VSCODE_UNDER_TEST: version };
        delete env.ELECTRON_RUN_AS_NODE;
        const mode = scheme === 'file' ? 'Restricted Mode · local folder' : 'virtual pvtest: workspace';
        console.log(`[trust] VS Code ${version} · ${mode}`);
        const code = await launch(executable, args, env);
        if (code !== 0) failed.push(`${version}/${scheme} (exit ${code})`);
      }
    }
  } finally {
    // Same bounded retry as the Extension Host runner: Electron can hold profile handles
    // for a moment after exit on Windows.
    fs.rmSync(stateRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  }
  if (failed.length > 0) {
    console.error(`[trust] failed: ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[trust] failed', error);
  process.exitCode = 1;
});
