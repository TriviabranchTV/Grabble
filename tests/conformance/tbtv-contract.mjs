import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(file, 'utf8');
const capabilities = JSON.parse(await read('tbtv.capabilities.json'));
const worker = await read('src/worker.js');
const room = await read('src/room.js');
const transport = await read('public/js/grabble-transport.js');
const player = await read('public/js/grabble-play.js');
const tv = await read('public/js/grabble-tv.js');

assert.equal(capabilities.contractVersion, '1.52');
assert.equal(capabilities.gameId, 'grabble');
assert.equal(capabilities.handoff.protocol, 'tbtv-session-v1');
assert.equal(capabilities.handoff.launchRetryIsIdempotent, true);
assert.match(worker, /protocol !== 'tbtv-session-v1'/);
assert.match(worker, /sessionRoomCode/);
assert.match(worker, /launchId/);
assert.match(worker, /sessionPlayerId/);
assert.match(room, /this\.data\.sessionId === x\.sessionId && this\.data\.launchId === x\.launchId/);
assert.match(room, /PLAYER_NOT_IN_SESSION_ROSTER/);
assert.match(room, /returnToSession/);
assert.match(room, /api\/tbtv\/session\/return/);
assert.match(transport, /sessionPlayerId/);
assert.match(player, /state\.sessionMode/);
assert.match(tv, /state\.sessionMode/);
assert.doesNotMatch(worker + room, /SESSION_GRANT_SECRET|signGrant|verifyGrant/);
assert.doesNotMatch(worker, /contractVersion\s*!==/);
console.log('Grabble v1.52 session compatibility checks passed');
