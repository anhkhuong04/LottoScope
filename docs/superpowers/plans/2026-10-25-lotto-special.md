# Lotto special ball and running frontend

User correction: Lotto simulation must draw one special number from 1–12
after five main numbers from 1–35. The running local frontend must show it.

Use two sequential physical pools in the existing scene. A small session
controller retains the five main results, disposes the main pool and starts
a new 12-ball pool for one special result. The same controls/visibility
handling operate on the active pool. Main and special are separate fields;
duplicates across them are valid. No RNG selection or backend API changes.

Copy format: sorted main numbers followed by ` | ĐB: NN`; checker receives
only main numbers. Mega/Power keep their current main-only simulation.

The running Compose frontend image is 27 hours old, from before SIM-04.
After checks, rebuild and recreate only frontend on localhost:8088, then
verify the actual deployed app. Preserve backend/PostgreSQL and untracked logo.

- [x] RED: session transition/physical special/duplicate/pause/cleanup tests;
  UI completion, labels/copy/main-only checker; update Lotto E2E expectations.
- [x] Implement physical session controller and scene/UI integration.
- [x] Update domain/spec/agent notes for the user's explicit special exception.
- [x] Run lint/format/typecheck/unit/build, review, rebuild/up frontend only,
  run browser checks against localhost:8088, inspect images, record and commit.

Result: 51 unit pass; all frontend gates pass. Frontend-only Compose rebuild/up
is healthy, backend/PostgreSQL preserved. Full deployed E2E: 86 pass/4 device
skips, including Lotto special pause/resume. Independent review has no important
finding; desktop/mobile screenshots inspected. Details in DRAW_SIMULATION.md,
SIM-05 evidence. Existing large scene bundle/deprecations remain; mobile is
Chromium device emulation. No push or external deployment.
