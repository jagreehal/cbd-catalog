import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readDeclarations, readMetadata } from './contracts.mjs';

const location = '../producer/contracts/events/example.json';

test('accepts complete artifact metadata', () => {
  const metadata = {
    id: 'payment.completed',
    version: '1.0.0',
    name: 'Payment completed',
    summary: 'A payment settled.',
    producers: ['payments-service'],
    consumers: ['reporter'],
    owners: ['payments-platform'],
  };

  assert.deepEqual(readMetadata({ 'x-eventcatalog': metadata }, location), metadata);
});

test('requires metadata with an id and version', () => {
  assert.throws(() => readMetadata({}, location), /x-eventcatalog must be an object/);
  assert.throws(
    () => readMetadata({ 'x-eventcatalog': { id: 'payment.completed' } }, location),
    /x-eventcatalog.version/
  );
});

test('rejects path traversal and malformed relationships', () => {
  assert.throws(
    () => readMetadata(
      {
        'x-eventcatalog': {
          id: '../payment.completed',
          version: '1.0.0',
          producers: 'payments-service',
        },
      },
      location
    ),
    /x-eventcatalog.id/
  );
  assert.throws(
    () => readMetadata(
      {
        'x-eventcatalog': {
          id: 'payment.completed',
          version: '1.0.0',
          consumers: ['../reporter'],
        },
      },
      location
    ),
    /x-eventcatalog.consumers/
  );
});

test('reads the consumers a repository declares, by event id', () => {
  const text = JSON.stringify({
    consumes: [
      { service: 'reporter', event: 'payment/payment.completed', fields: ['payment.amount'] },
      { service: 'reporter', event: 'payment/payment.failed' },
    ],
  });

  assert.deepEqual(readDeclarations(text, 'reporter/autocatalog.consumes.json'), [
    { service: 'reporter', event: 'payment.completed' },
    { service: 'reporter', event: 'payment.failed' },
  ]);
});

test('rejects a declaration that is not one', () => {
  const location = 'reporter/autocatalog.consumes.json';

  assert.throws(() => readDeclarations('{}', location), /consumes must be an array/);
  assert.throws(
    () => readDeclarations(JSON.stringify({ consumes: [{ service: '../x', event: 'p/e' }] }), location),
    /service/
  );
  assert.throws(
    () => readDeclarations(JSON.stringify({ consumes: [{ service: 'x', event: 'payment.completed' }] }), location),
    /event/
  );
});
