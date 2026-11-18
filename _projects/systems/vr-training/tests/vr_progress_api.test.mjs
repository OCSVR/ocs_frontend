// The Flask client against a stub fetch: URLs, credentials and error statuses.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createVrProgressApi, VrProgressApiError } from '../js/vr-progress-api.js';

function stubFetch(responses) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => {
        if (next.body === undefined) throw new SyntaxError('not JSON');
        return next.body;
      },
    };
  };
  return { calls, fetchImpl };
}

const config = { pythonURI: 'http://localhost:8587', fetchOptions: { credentials: 'include', mode: 'cors' } };

test('me() and progress() call Flask with the shared fetch options', async () => {
  const { calls, fetchImpl } = stubFetch([
    { status: 200, body: { uid: 'hop' } },
    { status: 200, body: { learner_id: 'a b/c' } },
  ]);
  const api = createVrProgressApi({ ...config, fetchImpl });
  assert.deepEqual(await api.me(), { uid: 'hop' });
  await api.progress('a b/c');
  assert.equal(calls[0].url, 'http://localhost:8587/api/id');
  assert.equal(calls[1].url, 'http://localhost:8587/api/learners/a%20b%2Fc/progress');
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(calls[0].options.method, 'GET');
});

test('a refused request rejects with its status and the server message', async () => {
  const { fetchImpl } = stubFetch([{ status: 403, body: { message: 'You can only see your own progress' } }]);
  const api = createVrProgressApi({ ...config, fetchImpl });
  await assert.rejects(api.progress('toby'), error =>
    error instanceof VrProgressApiError && error.status === 403 && /own progress/.test(error.message));
});

test('a non-JSON error page still rejects with its status', async () => {
  const { fetchImpl } = stubFetch([{ status: 502 }]);
  const api = createVrProgressApi({ ...config, fetchImpl });
  await assert.rejects(api.me(), error => error.status === 502);
});

test('a network failure rejects with status 0', async () => {
  const { fetchImpl } = stubFetch([new TypeError('Failed to fetch')]);
  const api = createVrProgressApi({ ...config, fetchImpl });
  await assert.rejects(api.me(), error => error instanceof VrProgressApiError && error.status === 0);
});

test('the client refuses to start without pythonURI', () => {
  assert.throws(() => createVrProgressApi({ fetchOptions: {} }), /pythonURI/);
});
