import assert from 'node:assert/strict';
import { GrabbleRoom } from '../../src/room.js';

let writes = 0;
let stored = null;
const state = {
  storage: {
    async get() { return stored; },
    async put(key, value) { writes++; stored = value; },
    async deleteAlarm() {},
    setAlarm() { return Promise.resolve(); },
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
room.clients.set('player', { send() {} });
room.data.players = [{ id: 'player', name: 'Ash', word: '', wordTiles: [], score: 0, totalScore: 0 }];
room.data.ownerId = 'player';

for (let i = 0; i < 25; i++) await room.broadcastSnapshot(false);
assert.equal(writes, afterInit, 'snapshots used for transport must not write storage');

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
