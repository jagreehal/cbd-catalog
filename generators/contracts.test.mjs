import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readMetadata } from './contracts.mjs';

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
