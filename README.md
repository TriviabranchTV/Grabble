# Grabble

Grabble is a TV led TBTV game with phone play. Its shared session compatibility is described in `tbtv.capabilities.json` and the page shells.

Core starts Grabble through `POST /api/tbtv/session/start`, passing the session ID, session code, launch ID, and player roster. Grabble opens one room per launch, keeps session player IDs stable, and returns the TV and player destinations. Repeating the same launch reuses its room. At the TV’s return point, Grabble sends the session and launch IDs to Core and closes the game room.

The handoff uses no shared secret, signing key, or per player grant. Session and player IDs are context, not credentials. Grabble checks that session players are on the room roster. Standalone play remains available through the game’s own entry flow.

## Surfaces

Each page has a separate static HTML shell, stylesheet, and controller under `public/surfaces`, `public/css`, and `public/js`. The TV surface owns the session lobby, countdown, live board, results, and return action. The player surface handles standalone joining and phone gameplay. `src/worker.js` routes requests; `src/room.js` owns transient room state.

## Checks

Run `node tests/conformance/html-surfaces.mjs`, `node tests/conformance/tbtv-contract.mjs`, `node tests/conformance/tbtv-session-1.52.mjs`, and `node tests/conformance/room-persistence.mjs`. The browser-flow test covers standalone play. Manual TV and phone checks are useful but are not release gates under the current TBTV contract.
