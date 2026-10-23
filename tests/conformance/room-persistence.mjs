import assert from 'node:assert/strict';
import { GrabbleRoom } from '../../src/room.js';

let writes = 0;
let alarmWrites = 0;
let currentAlarm = null;
let stored = null;
const state = {
  storage: {
    async get() { return stored; },
    async put(key, value) { writes++; stored = value; },
    async deleteAlarm() {},
    async getAlarm() { return currentAlarm; },
    setAlarm(value) { alarmWrites++; currentAlarm = value; return Promise.resolve(); },
  },
};
const room = new GrabbleRoom(state, {});
await room.init(new Request('https://room/init', {
  method: 'POST',
  body: JSON.stringify({
    code: 'TEST',
    mode: 'single',
    controlToken: 'control',
  }),
}));
const afterInit = writes;
const afterInitAlarms = alarmWrites;
room.clients.set('player', { send() {} });
room.data.players = [{ id: 'player', name: 'Ash', word: '', wordTiles: [], score: 0, totalScore: 0 }];
room.data.ownerId = 'player';

for (let i = 0; i < 25; i++) await room.broadcastSnapshot(false);
assert.equal(writes, afterInit, 'snapshots used for transport must not write storage');
for (let i = 0; i < 100; i++) await room.activity(false);
assert.equal(alarmWrites, afterInitAlarms, 'frequent transport activity must not refresh the inactivity alarm on every message');
room.data.endAt = Date.now() + 30000;
assert.equal(room.nextAlarm(), room.data.endAt, 'round timers schedule one deadline instead of one-second alarms');
room.data.endAt = 0;

await room.start();
assert.equal(writes, afterInit + 1, 'a meaningful lifecycle transition must persist once');

for (let i = 0; i < 25; i++) await room.broadcastSnapshot(false);
assert.equal(writes, afterInit + 1, 'repeated transport snapshots must remain write-free');

console.log('Grabble bounded-write room-flow checks passed');

let hostSnapshot = null;
const hostRoom = new GrabbleRoom({ storage: {
  async get() { return hostSnapshot; },
  async put(key, value) { hostSnapshot = value; },
  async deleteAlarm() {},
  setAlarm() { return Promise.resolve(); },
} }, {});
await hostRoom.init(new Request('https://room/init', {
  method: 'POST',
  body: JSON.stringify({ code: 'HOST', mode: 'single', creationContext: 'host', hostName: 'Ash', playerToken: 'host-player-token' }),
}));
const createdState = hostRoom.safe();
assert.equal(createdState.controllerRole, 'host');
assert.equal(createdState.players.length, 1, 'host must be present in the first room snapshot');
assert.equal(createdState.players[0].name, 'Ash');
assert.equal(createdState.players[0].isHost, true);
assert.equal(createdState.ownerId, 'host-player');
console.log('Standalone host creation registers its host as the first player');
