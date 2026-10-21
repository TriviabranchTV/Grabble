import { registryCall } from './shared.js';

async function makeRoom(env, creationContext, config, hostPlayer, baseUrl) {
  const mode = config.mode === 'competition' ? 'competition' : 'single';
  const hostName = String(hostPlayer?.displayName || '').trim().slice(0, 18);
  if (!['host', 'tv'].includes(creationContext)) throw new Error('INVALID_CREATION_CONTEXT');
  if (creationContext === 'host' && !hostName) throw new Error('HOST_NAME_REQUIRED');
  const code = Math.random().toString(36).slice(2, 6).toUpperCase();
  const controlToken = crypto.randomUUID() + crypto.randomUUID();
  const playerToken = creationContext === 'host' ? crypto.randomUUID() + crypto.randomUUID() : undefined;
  const init = await env.ROOMS.get(env.ROOMS.idFromName(code)).fetch('https://room/init', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, mode, creationContext, hostName, controlToken, playerToken }),
  });
  if (!init.ok) throw new Error('ROOM_INIT_' + init.status);
  await env.ADMIN.get(env.ADMIN.idFromName('global')).fetch('https://admin/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, gameId: 'grabble', gameName: 'Grabble', mode, phase: 'lobby', players: creationContext === 'host' ? 1 : 0, createdAt: Date.now() }),
  }).catch(() => null);
  await registryCall(env, '/register', { gameId: 'grabble', gameName: 'Grabble', roomId: code, roomCode: code, phase: 'lobby', mode, players: creationContext === 'host' ? 1 : 0, createdAt: Date.now(), controlUrl: baseUrl + '/api/tblive/rooms/' + code + '/kill', capabilities: ['hostless-tv', 'host-create', 'room-kill', 'html-surfaces'] }).catch(() => null);
  return { code, creationContext, controllerRole: creationContext, route: '/' + creationContext + '/' + code, controlToken, ...(playerToken ? { playerToken } : {}) };
}

export default { async fetch(request, env) {
  const u = new URL(request.url), p = u.pathname.split('/').filter(Boolean);
  if (p[0] === 'api' && p[1] === 'tblive' && p[2] === 'rooms' && p[4] === 'kill' && request.method === 'POST') {
    const token = String(env.TBLIVE_REGISTRY_TOKEN || '');
    if (!token || request.headers.get('authorization') !== 'Bearer ' + token) return Response.json({ error: 'UNAUTHORISED' }, { status: 401 });
    const code = String(p[3] || '').toUpperCase();
    return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch('https://room/admin/kill', { method: 'POST' });
  }
  if (p[0] === 'api' && p[1] === 'tbtv' && p[2] === 'session' && p[3] === 'start' && request.method === 'POST') {
    let x = {}; try { x = await request.json(); } catch {}
    if (x.protocol !== 'tbtv-session-v1' || x.gameId !== 'grabble' || !x.sessionId || !/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/.test(String(x.sessionCode || '')) || !x.launchId || !Array.isArray(x.players)) return Response.json({ error: 'INVALID_SESSION_HANDOFF' }, { status: 400 });
    const code = Math.random().toString(36).slice(2, 6).toUpperCase();
    const players = x.players.map(p => ({ id: String(p.sessionPlayerId), name: String(p.displayName || 'Player').slice(0,18), avatar: p.avatar || null, word: '', wordTiles: [], score: 0, totalScore: 0 }));
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    const init = await stub.fetch('https://room/init', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, mode: 'single', creationContext: 'tv', session: { sessionId: x.sessionId, sessionCode: x.sessionCode, gameId: 'grabble', launchId: x.launchId }, players }) });
    if (!init.ok) return Response.json({ error: 'ROOM_INIT_FAILED' }, { status: 500 });
    const origin = u.origin, tvUrl = new URL('/tv/' + code, origin); tvUrl.searchParams.set('core', '1');
    const playerDestinations = players.map(p => { const dest = new URL('/play/' + code, origin); dest.searchParams.set('name', p.name); dest.searchParams.set('sessionPlayerId', p.id); dest.searchParams.set('core', '1'); return { sessionPlayerId: p.id, url: dest.href }; });
    return Response.json({ roomCode: code, tvUrl: tvUrl.href, players: playerDestinations });
  }
  if (p[0] === 'api' && p[1] === 'create' && request.method === 'POST') {
    let x = {}; try { x = await request.json(); } catch {}
    if (x.gameId !== 'grabble' || !['host', 'tv'].includes(x.creationContext) || (x.creationContext === 'host' && !String(x.hostPlayer?.displayName || '').trim())) return Response.json({ error: 'Invalid create request.' }, { status: 400 });
    try { return Response.json(await makeRoom(env, x.creationContext, x.config || {}, x.hostPlayer, u.origin)); }
    catch (error) { return Response.json({ error: 'Unable to create the room right now.', detail: String(error?.message || error) }, { status: 500 }); }
  }
  if (p[0] === 'api' && p[1] === 'admin' && p[2] === 'rooms' && request.method === 'GET') {
    const response = await env.ADMIN.get(env.ADMIN.idFromName('global')).fetch('https://admin/rooms'), data = await response.json();
    return Response.json({ rooms: (data.rooms || []).map(r => ({ ...r, gameId: 'grabble', gameName: 'Grabble', createdAt: r.createdAt, phase: r.phase || 'lobby', mode: r.mode || 'hosted' })) });
  }
  if (p[0] === 'api' && p[1] === 'admin' && p[2] === 'games' && request.method === 'GET') return Response.json({ games: [{ id: 'grabble', name: 'Grabble', status: 'online', rooms: 0, capabilities: ['dictionary', 'room-kill', 'hostless-tv', 'html-surfaces'] }] });
  if (p[0] === 'api' && p[1] === 'admin' && p[2] === 'config' && (request.method === 'GET' || request.method === 'POST')) return env.ADMIN.get(env.ADMIN.idFromName('global')).fetch('https://admin/config', { method: request.method, headers: request.headers, body: request.method === 'POST' ? request.body : undefined });
  if (p[0] === 'api' && p[1] === 'admin' && p[2] === 'compare' && request.method === 'GET') {
    const word = new URL(request.url).searchParams.get('word') || '', adminId = env.ADMIN.idFromName('global');
    const [dictionaryResponse, datamuseResponse] = await Promise.all([env.ADMIN.get(adminId).fetch('https://admin/dictionary/' + encodeURIComponent(word)), env.ADMIN.get(adminId).fetch('https://admin/datamuse/' + encodeURIComponent(word))]);
    const dictionary = await dictionaryResponse.json(), datamuse = await datamuseResponse.json();
    return Response.json({ word, results: [{ name: 'dictionaryapi.dev', ...dictionary }, { name: 'Datamuse', ...datamuse }] });
  }
  if (p[0] === 'api' && p[1] === 'admin' && p[2] === 'dictionary' && request.method === 'GET') {
    const word = new URL(request.url).searchParams.get('word') || '';
    return env.ADMIN.get(env.ADMIN.idFromName('global')).fetch('https://admin/dictionary/' + encodeURIComponent(word));
  }
  if (p[0] === 'api' && p[1] === 'admin' && p.length === 2) return env.ADMIN.get(env.ADMIN.idFromName('global')).fetch('https://admin/rooms');
  if (p[0] === 'ws' && p[1]) return env.ROOMS.get(env.ROOMS.idFromName(p[1].toUpperCase())).fetch(request);
  async function serveSurface(mode) {
    const asset = await env.ASSETS.fetch(new Request(new URL('/surfaces/' + mode + '.html', request.url), { method: 'GET', headers: request.headers }));
    if (asset.ok) return new Response(asset.body, asset);
    return new Response('Surface unavailable', { status: 500 });
  }
  if (p.length === 0) return serveSurface('home');
  if (p[0] === 'admin' && p.length === 1) return serveSurface('admin');
  if (p[0] === 'host' && p.length === 1) return serveSurface('host');
  if (p[0] === 'tv' && p.length === 1) return serveSurface('tv');
  // Entry surfaces are valid without a room code: they open their setup/join flow.
  // Room surfaces remain canonical at /play/[CODE], /host/[CODE], /display/[CODE], /tv/[CODE].
  if (['play', 'host'].includes(p[0]) && p.length === 1) return serveSurface(p[0]);
  if (['play', 'display', 'tv', 'host'].includes(p[0]) && p.length === 2) return serveSurface(p[0]);
  return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain;charset=UTF-8' } });
} };
