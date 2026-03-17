import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseDocumentIdFromPdf417Payload } = require('../../dist/shared/types/scanner.js');

test('parseDocumentIdFromPdf417Payload extracts a document id between hash tokens', () => {
  const payload = [
    'abc#0',
    '1010101421#LZZXX',
    'suffix'
  ].join('\n');

  const extracted = parseDocumentIdFromPdf417Payload(payload);
  assert.equal(extracted, '1010101421');
});

test('parseDocumentIdFromPdf417Payload prefers 10-digit value when multiple ids exist', () => {
  const payload = '#12345678# random #1010101421# tail';
  const extracted = parseDocumentIdFromPdf417Payload(payload);
  assert.equal(extracted, '1010101421');
});

test('parseDocumentIdFromPdf417Payload returns null when no numeric hash token exists', () => {
  const payload = '#abc#foo#bar';
  const extracted = parseDocumentIdFromPdf417Payload(payload);
  assert.equal(extracted, null);
});

