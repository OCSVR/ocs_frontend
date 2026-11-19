// The pure model: formatting and who may see whose progress. No network or DOM.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canViewOthers, chooseLearner, formatDuration, formatScore, missionRows, sessionRows,
  splitModuleName, summaryTiles,
} from '../js/vr-progress-model.js';

test('formatDuration covers seconds, minutes, hours and bad input', () => {
  assert.equal(formatDuration(0), '0s');
  assert.equal(formatDuration(45), '45s');
  assert.equal(formatDuration(184), '3m 04s');
  assert.equal(formatDuration(3720), '1h 02m');
  assert.equal(formatDuration(-1), '—');
  assert.equal(formatDuration(undefined), '—');
});

test('splitModuleName turns module.mission into words', () => {
  assert.deepEqual(splitModuleName('build_computer.identify_components'),
    { module: 'Build Computer', mission: 'Identify Components' });
  assert.deepEqual(splitModuleName('gpio_wiring'), { module: 'Gpio Wiring', mission: '' });
  assert.deepEqual(splitModuleName(''), { module: '', mission: '' });
});

test('formatScore shows a dash when there is no score yet', () => {
  assert.equal(formatScore(85), '85');
  assert.equal(formatScore(0), '0');
  assert.equal(formatScore(null), '—');
});

test('summaryTiles reads the server summary, and an empty one as zeros', () => {
  const tiles = summaryTiles({ modules_completed: 2, sessions_started: 3, sessions_completed: 2, attempts: 3, duration_s: 244 });
  assert.deepEqual(tiles.map(t => t.value), ['2', '2 of 3', '3', '4m 04s']);
  assert.deepEqual(summaryTiles().map(t => t.value), ['0', '0 of 0', '0', '0s']);
});

test('missionRows marks unfinished missions and keeps the server order', () => {
  const rows = missionRows([
    { module: 'build_computer.identify_components', completed: true, best_score: 100, last_score: 85,
      attempts: 3, best_duration_s: 90, last_completed_at: '2026-11-13T20:42:02Z' },
    { module: 'build_network.add_router', completed: false, best_score: null, last_score: null,
      attempts: 0, best_duration_s: null, last_completed_at: null },
  ]);
  assert.equal(rows[0].mission, 'Identify Components');
  assert.equal(rows[0].tone, 'good');
  assert.equal(rows[0].bestTime, '1m 30s');
  assert.equal(rows[1].status, 'Started');
  assert.equal(rows[1].tone, 'warn');
  assert.equal(rows[1].bestScore, '—');
  assert.equal(rows[1].lastCompleted, '—');
});

test('sessionRows shows a started session without a result', () => {
  const [row] = sessionRows([{ session_id: 'abc', module: 'build_network.add_router', status: 'started',
    score: null, attempts: null, duration_s: null, device: null, started_at: '2026-11-13T20:00:00Z', completed_at: null }]);
  assert.equal(row.name, 'Build Network: Add Router');
  assert.equal(row.status, 'Started');
  assert.equal(row.score, '—');
  assert.equal(row.device, '—');
  assert.notEqual(row.when, '—');
});

test('only Teachers and Admins choose another learner', () => {
  const student = { uid: 'hop', is_teacher: false, is_admin: false };
  const teacher = { uid: 'niko', is_teacher: true, is_admin: false };
  assert.equal(canViewOthers(student), false);
  assert.equal(canViewOthers(teacher), true);
  assert.equal(chooseLearner(student, 'toby'), 'hop');
  assert.equal(chooseLearner(teacher, ' hop '), 'hop');
  assert.equal(chooseLearner(teacher, ''), 'niko');
  assert.equal(chooseLearner(teacher, null), 'niko');
});
