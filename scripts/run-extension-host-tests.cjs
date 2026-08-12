'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runTests } = require('@vscode/test-electron');

const extensionDevelopmentPath = path.resolve(__dirname, '..');
const extensionTestsPath = path.resolve(extensionDevelopmentPath, 'tests', 'integration', 'index.cjs');
const versions = process.env.PROMPTVAULT_VSCODE_VERSIONS
  ? process.env.PROMPTVAULT_VSCODE_VERSIONS.split(',').map((version) => version.trim()).filter(Boolean)
  : ['1.80.2', 'stable'];

async function main() {
  // VS Code creates a Unix-domain socket below user-data-dir. Detached local-CI
  // worktrees are intentionally descriptive and can exceed macOS's 103-byte
  // socket-path limit, so keep only ephemeral editor state in a short temp root.
  const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-vsc-'));
  try {
    for (const [index, version] of versions.entries()) {
      const versionRoot = path.join(stateRoot, `v${index}`);
      const userDataDir = path.join(versionRoot, 'u');
      const extensionsDir = path.join(versionRoot, 'e');
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.mkdirSync(extensionsDir, { recursive: true });

      console.log(`[extension-host] VS Code ${version}`);
      await runTests({
        version,
        extensionDevelopmentPath,
        extensionTestsPath,
        extensionTestsEnv: { PROMPTVAULT_VSCODE_UNDER_TEST: version },
        launchArgs: [
          `--user-data-dir=${userDataDir}`,
          `--extensions-dir=${extensionsDir}`,
          '--disable-extensions',
          '--disable-gpu',
          '--skip-welcome',
          '--skip-release-notes',
        ],
      });
    }
  } finally {
    fs.rmSync(stateRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('[extension-host] failed', error);
  process.exitCode = 1;
});
