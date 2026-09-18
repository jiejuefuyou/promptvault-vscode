'use strict';

// The full Extension Host flow of tests/integration, run twice by scripts/run-trust-tests.cjs:
// in Restricted Mode on an untrusted local folder, and on a virtual (`pvtest:`) workspace.
// That runner launches VS Code itself: @vscode/test-electron's runTests() always appends
// --disable-workspace-trust, so the regular run can never observe Restricted Mode.
// VS Code treats virtual (non-file, non-remote) workspaces as trusted by design, so the
// virtual run asserts the scheme and the recorded file access instead of isTrusted.
const assert = require('node:assert/strict');
const vscode = require('vscode');
const integration = require('../integration/index.cjs');

const SENTINEL_PATH = '/workspace-sentinel.txt';

async function run() {
  const expectedScheme = process.env.PROMPTVAULT_TRUST_SCHEME;
  assert.ok(['file', 'pvtest'].includes(expectedScheme), 'the runner must say which workspace it opened');
  const folders = vscode.workspace.workspaceFolders || [];
  assert.equal(folders.length, 1, 'exactly one workspace folder must be open');
  assert.equal(folders[0].uri.scheme, expectedScheme);
  if (expectedScheme === 'file') {
    assert.equal(vscode.workspace.isTrusted, false, 'the local-folder run must be in Restricted Mode');
  }

  await integration.run();

  if (expectedScheme === 'pvtest') {
    const accessLog = await vscode.commands.executeCommand('promptvaultTests.virtualAccessLog');
    assert.ok(accessLog.length > 0, 'the workspace must really have been served by the test file system');
    const sentinelReads = accessLog.filter(
      (entry) => entry.operation === 'readFile' && entry.path === SENTINEL_PATH
    );
    assert.deepEqual(sentinelReads, [], 'PromptVault must never read workspace files');
  }
  const mode = expectedScheme === 'file' ? 'Restricted Mode, local folder' : 'virtual pvtest: workspace';
  console.log(`[PromptVault trust] PASS: ${mode}`);
}

module.exports = { run };
