'use strict';

const VARIABLE_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g;
const ALLOWED_TYPES = new Set(['string', 'int', 'multiline']);
const MAX_PROMPTS = 5000;

function parseVariableToken(rawToken) {
  const raw = String(rawToken ?? '').trim();
  const colon = raw.indexOf(':');
  const name = (colon >= 0 ? raw.slice(0, colon) : raw).trim();
  if (!name) return null;

  let type = 'string';
  let defaultValue = null;
  if (colon >= 0) {
    const descriptor = raw.slice(colon + 1).trim();
    const equals = descriptor.indexOf('=');
    const requestedType = (equals >= 0 ? descriptor.slice(0, equals) : descriptor).trim();
    type = ALLOWED_TYPES.has(requestedType) ? requestedType : 'string';
    if (equals >= 0) defaultValue = descriptor.slice(equals + 1);
  }
  return { name, type, defaultValue, raw };
}

function parseVariables(body) {
  const source = String(body ?? '');
  const seen = new Set();
  const variables = [];
  VARIABLE_PATTERN.lastIndex = 0;
  let match;
  while ((match = VARIABLE_PATTERN.exec(source)) !== null) {
    const variable = parseVariableToken(match[1]);
    if (!variable || seen.has(variable.name)) continue;
    seen.add(variable.name);
    variables.push({ ...variable, placeholder: match[0], index: variables.length });
  }
  return variables;
}

function coerceVariableValue(variable, rawValue) {
  const value = String(rawValue ?? '');
  if (variable.type === 'multiline') return value.replace(/\\n/g, '\n');
  return value;
}

function validateVariableValue(variable, rawValue) {
  const value = String(rawValue ?? '');
  if (value.length === 0) return null;
  if (variable.type === 'int' && !/^-?\d+$/.test(value)) {
    return 'Enter a whole number, or leave empty to preserve the placeholder.';
  }
  return null;
}

function renderPrompt(body, values = {}) {
  const source = String(body ?? '');
  VARIABLE_PATTERN.lastIndex = 0;
  return source.replace(VARIABLE_PATTERN, (placeholder, rawToken) => {
    const variable = parseVariableToken(rawToken);
    if (!variable) return placeholder;
    const hasValue = Object.prototype.hasOwnProperty.call(values, variable.name);
    const supplied = hasValue ? coerceVariableValue(variable, values[variable.name]) : '';
    if (supplied.length > 0) return supplied;
    if (variable.defaultValue !== null) return variable.defaultValue;
    return placeholder;
  });
}

function unresolvedVariables(body, values = {}) {
  return parseVariables(body).filter((variable) => {
    const hasValue = Object.prototype.hasOwnProperty.call(values, variable.name);
    const supplied = hasValue ? coerceVariableValue(variable, values[variable.name]) : '';
    return supplied.length === 0 && variable.defaultValue === null;
  });
}

function normalizePrompt(raw, index = 0) {
  if (!raw || typeof raw !== 'object') throw new TypeError(`Prompt ${index + 1} is not an object.`);
  const title = String(raw.title ?? '').trim();
  const body = String(raw.body ?? '').trim();
  if (!title || !body) throw new TypeError(`Prompt ${index + 1} must contain a title and body.`);
  const tags = Array.isArray(raw.tags)
    ? [...new Set(raw.tags.map((tag) => String(tag).trim()).filter(Boolean))]
    : [];
  return Object.freeze({ title, body, tags });
}

function normalizePromptLibrary(rawPrompts) {
  if (!Array.isArray(rawPrompts)) throw new TypeError('Prompt library must be an array.');
  if (rawPrompts.length === 0 || rawPrompts.length > MAX_PROMPTS) {
    throw new RangeError(`Prompt library size must be between 1 and ${MAX_PROMPTS}.`);
  }
  return Object.freeze(rawPrompts.map(normalizePrompt));
}

function quickPickItems(prompts) {
  return prompts.map((prompt) => Object.freeze({
    label: prompt.title,
    description: prompt.tags.slice(0, 3).join(' · '),
    detail: `${prompt.body.slice(0, 140).replace(/\s+/g, ' ').trim()}${prompt.body.length > 140 ? '…' : ''}`,
    prompt,
  }));
}

module.exports = Object.freeze({
  coerceVariableValue,
  normalizePromptLibrary,
  parseVariableToken,
  parseVariables,
  quickPickItems,
  renderPrompt,
  unresolvedVariables,
  validateVariableValue,
});
