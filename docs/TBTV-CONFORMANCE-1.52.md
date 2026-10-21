# Grabble TBTV 1.52

Grabble declares TBTV contract 1.52 in `tbtv.capabilities.json` and its static page shells. The numeric version is diagnostic; game launch does not depend on an exact version match.

## Shared session handoff

- `POST /api/tbtv/session/start` accepts a `tbtv-session-v1` handoff with the session ID and code, launch ID, game ID, and stable player roster.
- Repeating the same session and launch IDs reuses the same room.
- Existing player names and avatars are carried into the room. The player route reconnects by the stable session player ID and rejects IDs outside the room roster.
- Session players do not need another QR scan, name entry, per player grant, shared secret, or signing key.
- The TV can return to the shared session after the game. Grabble sends the session ID and launch ID to Core, then closes the room.
- Standalone play remains available through Grabble’s own entry and join flow.

## Verification

The CI workflow runs static shell checks, the TBTV handoff and return tests, room persistence checks, and the standalone browser flow. Core’s launcher and session lifecycle are verified in TBTV-Core; this repository tests Grabble’s side of the handoff.
