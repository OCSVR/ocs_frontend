// The page controller against a stub document and a stub API: what each case shows.
import assert from 'node:assert/strict';
import test from 'node:test';

function stubNode(tag) {
  return {
    tag, className: '', children: [], attributes: {}, listeners: {}, textContent: '', id: '', value: '',
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    addEventListener(type, handler) { this.listeners[type] = handler; },
  };
}
globalThis.document = { createElement: stubNode };

const { MESSAGES, startVrProgress } = await import('../js/vr-progress-page.js');
const { VrProgressApiError } = await import('../js/vr-progress-api.js');

function all(node, found = []) {
  found.push(node);
  (node.children || []).forEach(child => all(child, found));
  return found;
}
const texts = root => all(root).map(node => node.textContent).filter(Boolean);
const find = (root, tag) => all(root).filter(node => node.tag === tag);

function stubLocation(search = '') {
  return { pathname: '/vr/progress/', search, assigned: null, assign(url) { this.assigned = url; } };
}

const report = {
  learner_id: 'hop', name: 'Grace Hopper',
  summary: { modules_completed: 1, sessions_started: 1, sessions_completed: 1, attempts: 2, duration_s: 184 },
  modules: [{ module: 'build_computer.identify_components', completed: true, sessions_started: 1, sessions_completed: 1,
    best_score: 85, last_score: 85, attempts: 2, best_duration_s: 184, last_completed_at: '2026-11-13T20:42:02Z' }],
  recent_sessions: [{ session_id: 'x', module: 'build_computer.identify_components', status: 'completed', score: 85,
    attempts: 2, duration_s: 184, device: 'quest3', started_at: '2026-11-13T20:39:00Z', completed_at: '2026-11-13T20:42:02Z' }],
};

function api({ me, progress }) {
  const asked = [];
  return {
    asked,
    me: async () => { if (me instanceof Error) throw me; return me; },
    progress: async uid => { asked.push(uid); if (progress instanceof Error) throw progress; return progress; },
  };
}

test('signed out: a sign-in button that returns to this page', async () => {
  const root = stubNode('div');
  await startVrProgress({ root, api: api({ me: new VrProgressApiError('no', 401) }), location: stubLocation('?uid=x'), loginPath: '/login' });
  assert.ok(texts(root).includes(MESSAGES.signedOut));
  const [link] = find(root, 'a');
  assert.equal(link.href, '/login?returnTo=%2Fvr%2Fprogress%2F%3Fuid%3Dx');
});

test('a student sees their own report, with no lookup box, even when ?uid= names someone else', async () => {
  const root = stubNode('div');
  const stub = api({ me: { uid: 'hop', name: 'Grace Hopper', is_teacher: false, is_admin: false }, progress: report });
  await startVrProgress({ root, api: stub, location: stubLocation('?uid=toby'), loginPath: '/login' });
  assert.deepEqual(stub.asked, ['hop']);
  assert.equal(find(root, 'form').length, 0);
  assert.ok(texts(root).includes('Signed in as Grace Hopper.'));
  assert.ok(texts(root).includes('Identify Components'));
  assert.ok(texts(root).includes('3m 04s'));
  assert.equal(find(root, 'table').length, 2);
});

test('a teacher gets the lookup box, and it reloads with ?uid=', async () => {
  const root = stubNode('div');
  const location = stubLocation('?uid=hop');
  const stub = api({ me: { uid: 'niko', name: 'Nikola Tesla', is_teacher: true }, progress: report });
  await startVrProgress({ root, api: stub, location, loginPath: '/login' });
  assert.deepEqual(stub.asked, ['hop']);
  assert.ok(texts(root).includes('Showing Grace Hopper (hop).'));
  const [form] = find(root, 'form');
  const [input] = find(form, 'input');
  input.value = ' merlin ';
  form.listeners.submit({ preventDefault() {} });
  assert.equal(location.assigned, '/vr/progress/?uid=merlin');
  input.value = 'niko';
  form.listeners.submit({ preventDefault() {} });
  assert.equal(location.assigned, '/vr/progress/');
});

test('no sessions yet: tiles plus the empty message, no tables', async () => {
  const root = stubNode('div');
  const empty = { learner_id: 'hop', name: 'Grace Hopper', summary: {}, modules: [], recent_sessions: [] };
  await startVrProgress({ root, api: api({ me: { uid: 'hop' }, progress: empty }), location: stubLocation(), loginPath: '/login' });
  assert.ok(texts(root).includes(MESSAGES.noSessions));
  assert.equal(find(root, 'table').length, 0);
});

test('unknown learner and server failure show their own messages', async () => {
  const notFound = stubNode('div');
  await startVrProgress({ root: notFound, api: api({ me: { uid: 'niko', is_teacher: true }, progress: new VrProgressApiError('x', 404) }),
    location: stubLocation('?uid=nobody'), loginPath: '/login' });
  assert.ok(texts(notFound).includes(MESSAGES.notFound));
  assert.equal(find(notFound, 'a')[0].href, '/vr/progress/');

  const failed = stubNode('div');
  await startVrProgress({ root: failed, api: api({ me: { uid: 'hop' }, progress: new VrProgressApiError('x', 500) }),
    location: stubLocation(), loginPath: '/login' });
  assert.ok(texts(failed).includes(MESSAGES.failed));
});

test('text from the server is set as text, never parsed as HTML', async () => {
  const root = stubNode('div');
  const evil = { ...report, recent_sessions: [{ ...report.recent_sessions[0], device: '<img src=x onerror=alert(1)>' }] };
  await startVrProgress({ root, api: api({ me: { uid: 'hop' }, progress: evil }), location: stubLocation(), loginPath: '/login' });
  assert.ok(texts(root).includes('<img src=x onerror=alert(1)>'));
  assert.ok(all(root).every(node => !('innerHTML' in node)));
});
