// OCS VR progress: the Flask calls, and the only module in this project that does I/O.
//
// The page passes pythonURI and fetchOptions from assets/js/api/config.js (the
// cookie and CORS settings every Flask call uses), so this module keeps ./ imports.

/** Thrown when Flask refuses a request; `status` lets the page pick what to show. */
export class VrProgressApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'VrProgressApiError';
    this.status = status;
  }
}

/** Builds the client. `fetchImpl` is for tests; pages use the browser's fetch. */
export function createVrProgressApi({ pythonURI, fetchOptions, fetchImpl = globalThis.fetch }) {
  if (!pythonURI) throw new Error('createVrProgressApi needs pythonURI from config.js');

  async function getJson(path) {
    let response;
    try {
      response = await fetchImpl(`${pythonURI}${path}`, { ...fetchOptions, method: 'GET' });
    } catch {
      throw new VrProgressApiError('Could not reach the server.', 0);
    }
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      // A proxy error page is not JSON; the status code below still explains the failure.
    }
    if (!response.ok) {
      throw new VrProgressApiError(payload?.message || `Request failed (HTTP ${response.status})`, response.status);
    }
    return payload;
  }

  return {
    /** The signed-in account: {uid, name, is_teacher, is_admin, ...}. A 401 means signed out. */
    me: () => getJson('/api/id'),
    /** A learner's progress report. Learners get their own; staff may ask for anyone's. */
    progress: uid => getJson(`/api/learners/${encodeURIComponent(uid)}/progress`),
  };
}
