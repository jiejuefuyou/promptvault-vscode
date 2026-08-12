const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/core');

test('normalizes and freezes prompt data', () => {
  const prompts = core.normalizePromptLibrary([
    { title: ' A ', body: ' B ', tags: [' work ', 'work', ''] },
  ]);
  assert.deepEqual(prompts[0], { title: 'A', body: 'B', tags: ['work'] });
  assert.ok(Object.isFrozen(prompts));
  assert.ok(Object.isFrozen(prompts[0]));
});

test('rejects malformed or empty prompt data', () => {
  assert.throws(() => core.normalizePromptLibrary([]), /size/);
  assert.throws(() => core.normalizePromptLibrary([{ title: '', body: 'x' }]), /title and body/);
  assert.throws(() => core.normalizePromptLibrary('not-an-array'), /array/);
});

test('parses typed variables and deduplicates by bare name', () => {
  const variables = core.parseVariables('{{count:int=5}} {{notes:multiline=}} {{name:unknown=Sam}} {{count:string=9}}');
  assert.deepEqual(variables.map(({ name, type, defaultValue }) => ({ name, type, defaultValue })), [
    { name: 'count', type: 'int', defaultValue: '5' },
    { name: 'notes', type: 'multiline', defaultValue: '' },
    { name: 'name', type: 'string', defaultValue: 'Sam' },
  ]);
});

test('renders typed variables, defaults, multiline escapes, and unresolved placeholders', () => {
  const body = 'Count {{count:int=5}}\nTopic {{topic}}\nNotes {{notes:multiline=}}';
  const values = { count: '3', topic: '', notes: 'one\\ntwo' };
  assert.equal(core.renderPrompt(body, values), 'Count 3\nTopic {{topic}}\nNotes one\ntwo');
  assert.deepEqual(core.unresolvedVariables(body, values).map((v) => v.name), ['topic']);
});

test('validates integer variables without making empty optional placeholders invalid', () => {
  const variable = core.parseVariableToken('count:int');
  assert.equal(core.validateVariableValue(variable, ''), null);
  assert.equal(core.validateVariableValue(variable, '-42'), null);
  assert.match(core.validateVariableValue(variable, '4.2'), /whole number/);
});

test('quick pick items expose searchable tags and bounded one-line detail', () => {
  const prompt = core.normalizePromptLibrary([
    { title: 'Review code', body: 'Line one\nLine two '.repeat(20), tags: ['Coding', 'Review', 'Claude', 'Extra'] },
  ])[0];
  const [item] = core.quickPickItems([prompt]);
  assert.equal(item.label, 'Review code');
  assert.equal(item.description, 'Coding · Review · Claude');
  assert.ok(item.detail.length <= 141);
  assert.ok(!item.detail.includes('\n'));
  assert.equal(item.prompt, prompt);
});
