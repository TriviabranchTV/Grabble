import assert from 'node:assert/strict';
import { GrabbleRoom } from '../../src/room.js';
import worker from '../../src/worker.js';

function roomState() {
  const values = new Map();
  return { storage: {
    async get(key) { return values.get(key); },
    async put(key, value) { values.set(key, structuredClone(value)); },
    async deleteAlarm() {},
    async setAlarm() {},
  } };
}
const roomStates = new Map();
const env = {
  ROOMS: {
    idFromName(name) { return name; },
    get(name) {
      if (!roomStates.has(name)) roomStates.set(name, { instance: new GrabbleRoom(roomState(), env) });
      const instance = roomStates.get(name).instance;
      return { fetch: (input, init) => instance.fetch(input instanceof Request ? input : new Request(input, init)) };
    },
  },
  ADMIN: { idFromName: () => 'global', get: () => ({ fetch: async () => new Response('ok') }) },
};
const handoff = {
  protocol: 'tbtv-session-v1', gameId: 'grabble', sessionId: 'session-abc', sessionCode: 'ABCD', launchId: 'launch-123',
  players: [
    { sessionPlayerId: 'player-stable-a', displayName: 'Rae', avatar: '🦊' },
    { sessionPlayerId: 'player-stable-b', displayName: 'Sam', avatar: { type: 'emoji', value: '🎲' } },
  ],
};
async function start(payload) {
  return worker.fetch(new Request('https://grabble.triviabranch.com/api/tbtv/session/start', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  }), env);
}

const first = await start(handoff);
if (first.status !== 200) console.log(await first.clone().text());
assert.equal(first.status, 200);
const result = await first.json();
assert.ok(result.roomCode);
assert.equal(result.tvUrl, `https://grabble.triviabranch.com/tv/${result.roomCode}?session=ABCD`);
assert.deepEqual(result.players.map(player => player.sessionPlayerId), ['player-stable-a', 'player-stable-b']);
assert.match(result.players[0].url, /session=ABCD&sessionPlayerId=player-stable-a/);
const repeated = await (await start(handoff)).json();
assert.equal(repeated.roomCode, result.roomCode, 'retry with the same launch ID reuses the room');
assert.equal(roomStates.size, 1, 'retry must not create another room');

const room = roomStates.get(result.roomCode).instance;
const snapshot = room.safe();
assert.equal(snapshot.sessionMode, true);
assert.deepEqual(snapshot.players.map(player => [player.id, player.name]), [['player-stable-a', 'Rae'], ['player-stable-b', 'Sam']]);
assert.deepEqual(snapshot.players.map(player => player.avatar), ['🦊', { type: 'emoji', value: '🎲' }]);
const previousWebSocketPair = globalThis.WebSocketPair;
const previousResponse = globalThis.Response;
const playerMessages = [];
globalThis.WebSocketPair = class {
  constructor() {
    const client = {};
    const socket = { accept() {}, send(value) { playerMessages.push(JSON.parse(value)); }, addEventListener() {}, close() {} };
    return [client, socket];
  }
};
globalThis.Response = new Proxy(previousResponse, {
  get(target, property) { return Reflect.get(target, property, target); },
  construct(target, args) {
    if (args[1]?.status === 101) return { status: 101, webSocket: args[1].webSocket };
    return Reflect.construct(target, args);
  },
});
try {
  await room.fetch(new Request(`https://room/ws/${result.roomCode}?role=play&sessionPlayerId=player-stable-a`, { headers: { Upgrade: 'websocket' } }));
  assert.ok(playerMessages.some(message => message.type === 'hello' && message.payload.playerId === 'player-stable-a'), 'the player surface must receive its stable roster ID');
} finally { globalThis.WebSocketPair = previousWebSocketPair; globalThis.Response = previousResponse; }
const anotherLaunch = await (await start({ ...handoff, launchId: 'launch-456' })).json();
assert.notEqual(anotherLaunch.roomCode, result.roomCode, 'a new launch receives an isolated game room');
assert.equal(roomStates.size, 2);
const invalid = await start({ ...handoff, players: [handoff.players[0], handoff.players[0]] });
assert.equal(invalid.status, 400, 'duplicate stable player IDs are rejected');

const previousFetch = globalThis.fetch;
let returnBody;
globalThis.fetch = async (url, options) => {
  assert.equal(url, 'https://tv.triviabranch.com/api/tbtv/session/return');
  returnBody = JSON.parse(options.body);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
try {
  const sent = [];
  room.clients.set('tv-client', { send: value => sent.push(JSON.parse(value)), close() {} });
  room.roles.set('tv-client', 'tv');
  await room.action('tv-client', 'tv', JSON.stringify({ v: 1, type: 'action', payload: { type: 'returnToSession' } }));
  assert.deepEqual(returnBody, { sessionId: 'session-abc', sessionCode: 'ABCD', gameId: 'grabble', launchId: 'launch-123', roomCode: result.roomCode });
  assert.ok(sent.some(message => message.type === 'return_to_session'));
  assert.equal(room.data.phase, 'closed');
} finally { globalThis.fetch = previousFetch; }
console.log('TBTV 1.53 handoff, idempotent launch, stable roster, and session return tests passed');
