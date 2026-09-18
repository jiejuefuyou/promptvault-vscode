'use strict';

// Test-only extension: serves an in-memory `pvtest:` workspace and records every access,
// so the trust test can prove PromptVault never reads workspace files. Never packaged
// (tests/** is in .vscodeignore).
const vscode = require('vscode');

const SENTINEL = '/workspace-sentinel.txt';
const files = new Map([[SENTINEL, new TextEncoder().encode('PromptVault must never read this file.\n')]]);
const accessLog = [];

function record(operation, uri) {
  accessLog.push({ operation, path: uri.path });
}

function missing(uri) {
  return vscode.FileSystemError.FileNotFound(uri);
}

class RecordingFileSystem {
  constructor() {
    this.emitter = new vscode.EventEmitter();
    this.onDidChangeFile = this.emitter.event;
  }

  watch() {
    return new vscode.Disposable(() => {});
  }

  stat(uri) {
    record('stat', uri);
    const now = Date.now();
    if (uri.path === '/' || uri.path === '') {
      return { type: vscode.FileType.Directory, ctime: now, mtime: now, size: 0 };
    }
    const bytes = files.get(uri.path);
    if (!bytes) throw missing(uri);
    return { type: vscode.FileType.File, ctime: now, mtime: now, size: bytes.length };
  }

  readDirectory(uri) {
    record('readDirectory', uri);
    if (uri.path !== '/' && uri.path !== '') throw missing(uri);
    return [...files.keys()].map((path) => [path.slice(1), vscode.FileType.File]);
  }

  readFile(uri) {
    record('readFile', uri);
    const bytes = files.get(uri.path);
    if (!bytes) throw missing(uri);
    return bytes;
  }

  createDirectory(uri) {
    record('createDirectory', uri);
    throw vscode.FileSystemError.NoPermissions(uri);
  }

  writeFile(uri) {
    record('writeFile', uri);
    throw vscode.FileSystemError.NoPermissions(uri);
  }

  delete(uri) {
    record('delete', uri);
    throw vscode.FileSystemError.NoPermissions(uri);
  }

  rename(uri) {
    record('rename', uri);
    throw vscode.FileSystemError.NoPermissions(uri);
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider('pvtest', new RecordingFileSystem(), { isReadonly: true }),
    vscode.commands.registerCommand('promptvaultTests.virtualAccessLog', () => accessLog.slice()),
  );
}

module.exports = { activate, SENTINEL };
