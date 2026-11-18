// OCS VR progress: draws the page into its mount from what the API returns.
//
// Everything is built with createElement and textContent, never innerHTML, because
// module names and device names come from the headset and are not trusted.
import {
  canViewOthers, chooseLearner, missionRows, sessionRows, summaryTiles,
} from './vr-progress-model.js';

export const MESSAGES = {
  loading: 'Loading your training progress...',
  signedOut: 'Sign in to see your VR training progress.',
  notAllowed: 'You can only see your own progress.',
  notFound: 'No learner with that user ID.',
  noSessions: 'No training sessions yet. Finish a mission in the VR app and it shows up here.',
  failed: 'Could not load training progress.',
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function card(title) {
  const section = el('section', 'ocs__card vr-progress__card');
  section.append(el('h2', 'ocs__section-title', title));
  return section;
}

function pill(text, tone) {
  return el('span', `ocs__status-pill ocs__status-pill--${tone}`, text);
}

/** A table from column headings and rows; `cells(row)` returns text or nodes in column order. */
function table(headings, rows, cells) {
  const wrap = el('div', 'ocs__table-wrap');
  const grid = el('table', 'ocs__table vr-progress__table');
  const headRow = el('tr');
  headings.forEach(heading => headRow.append(el('th', '', heading)));
  const head = el('thead');
  head.append(headRow);
  const body = el('tbody');
  rows.forEach(row => {
    const tr = el('tr');
    cells(row).forEach(value => {
      const td = el('td');
      if (typeof value === 'string') td.textContent = value;
      else td.append(value);
      tr.append(td);
    });
    body.append(tr);
  });
  grid.append(head, body);
  wrap.append(grid);
  return wrap;
}

function stats(summary) {
  const tiles = el('div', 'ocs__stats');
  summaryTiles(summary).forEach(tile => {
    const box = el('div', 'ocs__stat');
    box.append(el('span', 'ocs__stat-value', tile.value), el('span', 'ocs__stat-label', tile.label));
    tiles.append(box);
  });
  return tiles;
}

/** The lookup box Teachers and Admins get: it reloads the page with ?uid=. */
function lookupForm(currentUid, onLookup) {
  const form = el('form', 'vr-progress__lookup');
  const field = el('div', 'ocs__field');
  const label = el('label', 'ocs__label', 'Learner user ID');
  label.setAttribute('for', 'vr-progress-uid');
  const input = el('input', 'ocs__input small');
  input.id = 'vr-progress-uid';
  input.name = 'uid';
  input.value = currentUid;
  input.setAttribute('autocomplete', 'off');
  field.append(label, input);
  const button = el('button', 'ocs__btn small', 'Show progress');
  button.type = 'submit';
  form.append(field, button);
  form.addEventListener('submit', event => {
    event.preventDefault();
    onLookup(input.value.trim());
  });
  return form;
}

function renderReport(root, report, me, onLookup) {
  const overview = card('VR training progress');
  const who = report.learner_id === me.uid
    ? `Signed in as ${me.name || me.uid}.`
    : `Showing ${report.name || report.learner_id} (${report.learner_id}).`;
  overview.append(el('p', 'ocs__text vr-progress__who', who));
  if (canViewOthers(me)) overview.append(lookupForm(report.learner_id, onLookup));
  overview.append(stats(report.summary));

  const sections = [overview];
  const missions = missionRows(report.modules);
  if (missions.length === 0) {
    overview.append(el('p', 'ocs__text vr-progress__empty', MESSAGES.noSessions));
  } else {
    const missionCard = card('Missions');
    missionCard.append(table(
      ['Module', 'Mission', 'Status', 'Best score', 'Last score', 'Attempts', 'Best time', 'Last completed'],
      missions,
      row => [row.module, row.mission, pill(row.status, row.tone), row.bestScore, row.lastScore,
        row.attempts, row.bestTime, row.lastCompleted],
    ));
    const sessionCard = card('Recent sessions');
    sessionCard.append(table(
      ['Mission', 'Status', 'Score', 'Attempts', 'Time', 'Device', 'When'],
      sessionRows(report.recent_sessions),
      row => [row.name, pill(row.status, row.tone), row.score, row.attempts, row.time, row.device, row.when],
    ));
    sections.push(missionCard, sessionCard);
  }
  root.replaceChildren(...sections);
}

/** A card with one line of text and, optionally, one link button ({href, label}). */
function renderMessage(root, text, action) {
  const box = card('VR training progress');
  box.append(el('p', 'ocs__text vr-progress__status', text));
  if (action) {
    const link = el('a', 'ocs__btn small', action.label);
    link.href = action.href;
    box.append(link);
  }
  root.replaceChildren(box);
}

/**
 * Fills `root`. `api` comes from createVrProgressApi(); `location` is window.location
 * (or a stub in tests); `loginPath` is the site's /login with the base URL.
 */
export async function startVrProgress({ root, api, location, loginPath }) {
  renderMessage(root, MESSAGES.loading);
  const signIn = {
    href: `${loginPath}?returnTo=${encodeURIComponent(location.pathname + location.search)}`,
    label: 'Sign in',
  };

  let me;
  try {
    me = await api.me();
  } catch (error) {
    if (error.status === 401) renderMessage(root, MESSAGES.signedOut, signIn);
    else renderMessage(root, MESSAGES.failed);
    return;
  }

  const requested = new URLSearchParams(location.search).get('uid');
  const uid = chooseLearner(me, requested);
  const onLookup = wanted => {
    const params = new URLSearchParams(location.search);
    if (wanted && wanted !== me.uid) params.set('uid', wanted);
    else params.delete('uid');
    const query = params.toString();
    location.assign(`${location.pathname}${query ? `?${query}` : ''}`);
  };

  try {
    renderReport(root, await api.progress(uid), me, onLookup);
  } catch (error) {
    const backToMine = { href: location.pathname, label: 'Show my progress' };
    if (error.status === 401) renderMessage(root, MESSAGES.signedOut, signIn);
    else if (error.status === 403) renderMessage(root, MESSAGES.notAllowed, backToMine);
    else if (error.status === 404) renderMessage(root, MESSAGES.notFound, backToMine);
    else renderMessage(root, MESSAGES.failed);
  }
}
