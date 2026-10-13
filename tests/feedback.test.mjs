import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { serve } from '../tools/serve.mjs';

test('feedback is saved locally with a derived filename; invalid or foreign-origin writes are rejected', async () => {
  const server = await serve(0), base = `http://127.0.0.1:${server.address().port}`;
  const file = { name: `../test-feedback-${randomUUID()}.mp3`, size: 12, lastModified: 42 };
  const id = createHash('sha256').update(JSON.stringify([file.name, file.size, file.lastModified])).digest('hex').slice(0, 20);
  const target = `rec/feedback/${id}.json`;
  const marks = [{ seconds: 25.5, event: 'observation', feedback: 'good', notes: 'Muziek én licht passen', context: { section: 'groove' } }];
  const post = (data, origin = base) => fetch(base + '/__feedback', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(data) });
  try {
    const response = await post({ file, marks });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).saved, true);
    const saved = JSON.parse(fs.readFileSync(target, 'utf8'));
    assert.deepEqual(saved.marks, marks);
    assert.deepEqual(saved.file, file, 'the original filename is metadata, not a write destination');
    assert.equal((await post({ file, marks: [{ ...marks[0], seconds: -1 }] })).status, 400);
    assert.equal((await post({ file, marks }, 'https://example.com')).status, 403);
    assert.deepEqual(JSON.parse(fs.readFileSync(target, 'utf8')), saved, 'rejected writes preserve the saved feedback');
    assert.equal((await post({ file, marks: [] })).status, 200, 'deleting a mark updates the project copy too');
    assert.deepEqual(JSON.parse(fs.readFileSync(target, 'utf8')).marks, []);
  } finally {
    fs.rmSync(target, { force: true });
    await new Promise(resolve => server.close(resolve));
  }
});
