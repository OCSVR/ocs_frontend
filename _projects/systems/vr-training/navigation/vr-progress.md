---
layout: opencs
title: VR Training Progress
description: Your OCS VR mission scores, attempts and time, saved by the VR app
permalink: /vr/progress/
search_exclude: true
---

{% comment %}
  OCS VR progress page. Source: _projects/systems/vr-training/ (published by its Makefile).
  Reads GET /api/id and GET /api/learners/<uid>/progress from the Flask backend
  (OCSVR/ocs_backend, api/training_api.py). Teachers and Admins can add ?uid=<learner>.
{% endcomment %}

<div class="vr-progress" id="vr-progress-app" aria-live="polite">
  <div class="ocs__loading">
    <div class="ocs__spinner"></div>
  </div>
</div>

<script type="module">
  import { pythonURI, fetchOptions } from '{{ site.baseurl }}/assets/js/api/config.js';
  import { createVrProgressApi } from '{{ site.baseurl }}/assets/js/projects/vr-training/vr-progress-api.js';
  import { startVrProgress } from '{{ site.baseurl }}/assets/js/projects/vr-training/vr-progress-page.js';

  startVrProgress({
    root: document.getElementById('vr-progress-app'),
    api: createVrProgressApi({ pythonURI, fetchOptions }),
    location: window.location,
    loginPath: '{{ site.baseurl }}/login',
  });
</script>
