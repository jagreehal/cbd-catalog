import assert from 'node:assert/strict';
import { test } from 'node:test';
import { docId, readDoc, relatedSection, summarise } from './docs.mjs';

const location = 'payments-service/docs/runbook.md';

test('reads frontmatter and body', () => {
  const { data, body } = readDoc(
    '---\ntitle: Runbook\nowner: payments-platform\nrelated: [acme-handbook/incident-communications]\n---\nBody text.\n',
    location
  );
  assert.equal(data.title, 'Runbook');
  assert.deepEqual(data.related, ['acme-handbook/incident-communications']);
  assert.equal(body, 'Body text.');
});

test('rejects docs the publishing repo should never have committed', () => {
  assert.throws(() => readDoc('Body with no frontmatter.\n', location), /no frontmatter/);
  assert.throws(() => readDoc('---\ntitle: Runbook\n---\nBody.\n', location), /owner/);
  assert.throws(() => readDoc('---\ntitle: ""\nowner: a\n---\nBody.\n', location), /title/);
});

test('addresses a doc by its path, at any depth', () => {
  assert.equal(docId('payments-service', 'docs/runbook.md'), 'payments-service/runbook');
  assert.equal(docId('payments-service', 'docs/ops/replay.md'), 'payments-service/ops/replay');
});

test('summarises the first paragraph, not the heading', () => {
  assert.equal(summarise('# Title\n\nFirst  paragraph.\n\nSecond.'), 'First paragraph.');
  assert.equal(summarise(''), '');
});

test('resolves related edges to catalog routes', () => {
  assert.equal(relatedSection(), '');
  assert.equal(
    relatedSection(['acme-handbook/incident-communications']),
    '## Related\n- [acme-handbook/incident-communications](/docs/custom/acme-handbook/incident-communications)'
  );
});
