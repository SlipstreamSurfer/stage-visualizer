import test from 'node:test';
import assert from 'node:assert/strict';
import { serve } from '../tools/serve.mjs';

test('the local server refuses a broken address and writes from other sites, and keeps serving', async () => {
  const server = await serve(0), base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base + '/%')).status, 400);
    assert.equal((await fetch(base + '/')).status, 200, 'still serving after a broken address');
    for (const path of ['/__log', '/__feedback']) assert.equal((await fetch(base + path, { method: 'POST', headers: { Origin: 'http://elsewhere.example' }, body: '{}' })).status, 403, path);
  } finally { server.close(); }
});
