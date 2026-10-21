import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(file, 'utf8');
const room = await read('src/room.js');
const worker = await read('src/worker.js');
const transport = await read('public/js/grabble-transport.js');
const admin = await read('src/admin.js');
const adminClient = await read('public/js/grabble-admin.js');
const workflow = await read('.github/workflows/tblive-conformance.yml');
const capabilities = JSON.parse(await read('tblive.capabilities.json'));

assert.equal(capabilities.contractVersion, '1.39');
assert.equal(capabilities.capabilities.hostlessTv, true);
assert.equal(capabilities.capabilities.tvCreatesRoom, true);
assert.deepEqual(capabilities.capabilities.creationContexts, ['host', 'tv']);
for (const event of ['hello', 'authenticated', 'snapshot', 'state_changed', 'phase_changed', 'player_joined', 'player_left', 'timer_started', 'timer_updated', 'score_updated', 'finished', 'room_closed']) {
  assert.match(room, new RegExp("['\"]" + event + "['\"]"), 'missing protocol event ' + event);
}
assert.match(room, /type, payload/);
assert.match(room, /requestId/);
assert.match(room, /MALFORMED_MESSAGE|INVALID_ACTION|ACTION_NOT_ALLOWED/);
assert.match(room, /reply\([^\n]+['"]ack['"]/);
assert.match(room, /creationContext/);
assert.match(room, /isHost/);
assert.match(room, /this\.data\.creationContext !== 'host'/);
assert.match(room, /role = 'tv-viewer'/);
assert.match(room, /setAlarm|alarm\(/);
assert.match(room, /deleteAlarm/);
assert.match(room, /double-word|triple-word/);
assert.match(transport, /seq > lastSeq \+ 1/);
assert.doesNotMatch(room, /UNAUTHORISED_DISPLAY_ROLE|displayToken/);
assert.doesNotMatch(transport, /displayToken/);
assert.doesNotMatch(admin + worker, /heartbeat|lastHeartbeat|lastSeen/);
assert.doesNotMatch(adminClient, /lastSeen/);
assert.match(admin, /u\.pathname === ['"]\/register['"]/);
assert.match(room, /\/unregister\//);
assert.doesNotMatch(transport, /setInterval\([^)]*fetch|setInterval\([^)]*api/);
assert.match(workflow, /browser-flow/);
assert.match(worker, /admin\/register/, 'created rooms must be visible to the local admin namespace');
assert.match(worker, /x\.gameId !== 'grabble'/);
assert.doesNotMatch(worker, /contractVersion\s*!==/);
assert.doesNotMatch(worker, /Invalid TBLive 1\.39 create request/);
assert.match(worker, /creationContext === 'host' \? 1 : 0/);
assert.match(await read('public/js/grabble-create.js'), /creationContext: context/);
assert.match(await read('public/js/grabble-create.js'), /hostPlayer: context === "host" \? \{ displayName: hostName \}/);
assert.match(await read('public/js/grabble-create.js'), /2500/);
assert.match(await read('public/js/grabble-create.js'), /grabble-entry-splash/);

const controllers = {
  home: 'public/js/grabble-home.js',
  play: 'public/js/grabble-play.js',
  host: 'public/js/grabble-host.js',
  display: 'public/js/grabble-display.js',
  tv: 'public/js/grabble-tv.js',
  admin: 'public/js/grabble-admin-surface.js',
};
for (const file of Object.values(controllers)) {
  const source = await read(file);
  assert.doesNotMatch(source, /grabble-client\.js/);
}
assert.match(await read('public/js/grabble-play.js'), /GrabblePlayer\.configure/);
assert.match(await read('public/js/grabble-play.js'), /GrabblePlayer\.bind/);
const play = await read('public/js/grabble-play.js');
assert.match(play, /phase === "countdown"/);
assert.match(play, /setInterval\(paint, 100\)/);
console.log('TBLive protocol, version-independent creation-context and controller-boundary checks passed');
