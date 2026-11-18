// OCS VR progress: turns the Flask progress report into what the page shows.
// Pure functions only; no fetch and no DOM, so tests run them directly.
//
// The report comes from GET /api/learners/<uid>/progress (OCSVR/ocs_backend,
// api/training_api.py). Module names are "module.mission" in lower snake case,
// e.g. build_computer.identify_components.

/** "184" seconds -> "3m 04s"; under a minute -> "45s"; an hour or more -> "1h 02m". */
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.round(seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(rest).padStart(2, '0')}s`;
  return `${rest}s`;
}

/** "build_computer.identify_components" -> { module: "Build Computer", mission: "Identify Components" }. */
export function splitModuleName(name) {
  const words = part => part.split('_').filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  const [module = '', ...rest] = String(name || '').split('.');
  return { module: words(module), mission: rest.length ? words(rest.join(' ')) : '' };
}

/** An ISO time from the server ("2026-11-13T20:42:02Z") as a short local date and time. */
export function formatWhen(iso, locale) {
  if (!iso) return '—';
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '—';
  return when.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

/** A score 0 to 100, or a dash when there is none yet. */
export function formatScore(score) {
  return Number.isFinite(score) ? `${score}` : '—';
}

/** The four tiles at the top of the page. */
export function summaryTiles(summary = {}) {
  return [
    { label: 'Missions completed', value: `${summary.modules_completed ?? 0}` },
    { label: 'Sessions completed', value: `${summary.sessions_completed ?? 0} of ${summary.sessions_started ?? 0}` },
    { label: 'Attempts', value: `${summary.attempts ?? 0}` },
    { label: 'Time in training', value: formatDuration(summary.duration_s ?? 0) },
  ];
}

/** One row per mission line in the report, in the order the server sent them. */
export function missionRows(modules = []) {
  return modules.map(line => {
    const { module, mission } = splitModuleName(line.module);
    return {
      key: line.module,
      module,
      mission,
      status: line.completed ? 'Completed' : 'Started',
      tone: line.completed ? 'good' : 'warn',
      bestScore: formatScore(line.best_score),
      lastScore: formatScore(line.last_score),
      attempts: `${line.attempts ?? 0}`,
      bestTime: line.best_duration_s == null ? '—' : formatDuration(line.best_duration_s),
      lastCompleted: formatWhen(line.last_completed_at),
    };
  });
}

/** One row per recent session, newest first as the server sends them. */
export function sessionRows(sessions = []) {
  return sessions.map(session => {
    const { module, mission } = splitModuleName(session.module);
    const done = session.status === 'completed';
    return {
      key: session.session_id,
      name: mission ? `${module}: ${mission}` : module,
      status: done ? 'Completed' : 'Started',
      tone: done ? 'good' : 'warn',
      score: formatScore(session.score),
      attempts: session.attempts == null ? '—' : `${session.attempts}`,
      time: session.duration_s == null ? '—' : formatDuration(session.duration_s),
      device: session.device || '—',
      when: formatWhen(session.completed_at || session.started_at),
    };
  });
}

/** Teachers and Admins may look up any learner; everyone else sees only themselves. */
export function canViewOthers(me) {
  return Boolean(me && (me.is_teacher || me.is_admin));
}

/** Which uid to show: ?uid= for staff, otherwise the signed-in account. */
export function chooseLearner(me, requestedUid) {
  const wanted = (requestedUid || '').trim();
  if (wanted && canViewOthers(me)) return wanted;
  return me.uid;
}
