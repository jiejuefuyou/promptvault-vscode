'use strict';

const path = require('node:path');
const { runTests } = require('@vscode/test-electron');

const extensionDevelopmentPath = path.resolve(__dirname, '..');
const extensionTestsPath = path.resolve(extensionDevelopmentPath, 'tests', 'integration', 'index.cjs');
const versions = process.env.PROMPTVAULT_VSCODE_VERSIONS
  ? process.env.PROMPTVAULT_VSCODE_VERSIONS.split(',').map((version) => version.trim()).filter(Boolean)
  : ['1.80.2', 'stable'];

async function main() {
  for (const version of versions) {
    console.log(`[extension-host] VS Code ${version}`);
    await runTests({
      version,
      extensionDevelopmentPath,
      extensionTestsPath,
      extensionTestsEnv: { PROMPTVAULT_VSCODE_UNDER_TEST: version },
      launchArgs: [
        '--disable-extensions',
        '--disable-gpu',
        '--skip-welcome',
        '--skip-release-notes',
      ],
    });
  }
}

main().catch((error) => {
  console.error('[extension-host] failed', error);
  process.exitCode = 1;
});
