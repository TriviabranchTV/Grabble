import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const surfaces = ['home', 'play', 'host', 'display', 'tv', 'admin'];
const controllers = {
  home: 'grabble-home.js',
  play: 'grabble-play.js',
  host: 'grabble-host.js',
  display: 'grabble-display.js',
  tv: 'grabble-tv.js',
  admin: 'grabble-admin-surface.js',
};
const read = file => readFile(path.join(root, file), 'utf8');

for (const surface of surfaces) {
  const file = 'public/surfaces/' + surface + '.html';
  await access(path.join(root, file));
  const source = await read(file);
  assert.match(source, /<html\b/i, file + ' must be an HTML document');
  assert.match(source, new RegExp('<main class="shell shell-' + surface + '">'), file + ' must declare its own surface shell');
  assert.match(source, /id="surface-content"/, file + ' must provide its own page content mount');
  assert.match(source, new RegExp('href="/css/grabble-base\\.css"'), file + ' must load shared primitives');
  assert.match(source, new RegExp('href="/css/grabble-' + surface + '\\.css(?:\\?[^"]*)?"'), file + ' must load its own stylesheet');
  const stylesheets = [...source.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(match => match[1].replace(/\?.*$/, '')).sort();
  assert.deepEqual(stylesheets, ['/css/grabble-' + surface + '.css', '/css/grabble-base.css'].sort(), file + ' must load only its surface stylesheet and shared primitives');
  await access(path.join(root, 'public/css/grabble-' + surface + '.css'));
  assert.match(source, new RegExp('src="/js/' + controllers[surface] + '([^"]*)?"'), file + ' must load its own controller');
  assert.doesNotMatch(source, /grabble-client\.js/, file + ' must not load the presentation monolith');
  assert.doesNotMatch(source, /<script>(?!\s*<\/script>)/i, file + ' must not contain inline application code');
  assert.match(source, /tbtv-contract-version" content="1\.52"/, file + ' must declare TBTV 1.52');
}
await assert.rejects(access(path.join(root, 'public/js/grabble-client.js')), 'the obsolete presentation monolith must be removed');
await assert.rejects(access(path.join(root, 'public/css/grabble.css')), 'the obsolete all-surface stylesheet must be removed');

const server = (await Promise.all([
  read('src/index.js'), read('src/worker.js'), read('src/room.js'), read('src/admin.js'),
])).join('\n');
const browser = (await Promise.all([
  read('public/js/grabble-surface.js'), read('public/js/grabble-room-common.js'),
  read('public/js/grabble-create.js'), read('public/js/grabble-transport.js'),
  read('public/js/grabble-player.js'), read('public/js/grabble-admin.js'), read('public/js/tblive-qr.js'),
])).join('\n');
const index = await read('src/index.js');
const surfaceRuntime = await read('public/js/grabble-surface.js');
assert.ok(index.length < 1000, 'Worker entrypoint must remain a thin adapter');
assert.doesNotMatch(surfaceRuntime, /app\.innerHTML|main\.shell-/ , 'shared surface utilities must not generate page shells');
assert.match(await read('src/worker.js'), /import \{ registryCall \} from ['"]\.\/shared\.js['"];/);
const wrangler = await read('wrangler.toml');
assert.doesNotMatch(server, /const CSS=|const CLIENT=|function page\(/);
assert.match(server, /\['play', 'display', 'tv', 'host'\]\.includes\(p\[0\]\).*p\.length === 2/);
assert.match(server, /p\.length === 0\) return serveSurface\('home'\)/);
assert.doesNotMatch(server, /return serveSurface\('play'\)\}\s*;\s*$/);
assert.match(server, /env\.ASSETS\.fetch/);
assert.match(server, /controlToken/);
assert.match(server, /UNAUTHORISED_CONTROL_ROLE/);
assert.match(server, /player_left/);
assert.match(server, /player_joined/);
assert.match(wrangler, /binding\s*=\s*"ASSETS"/);
assert.match(server, /p\[2\] === 'rooms'/);
assert.match(server, /p\[2\] === 'games'/);
assert.match(server, /kill-all/);

const capabilities = JSON.parse(await read('tbtv.capabilities.json'));
assert.equal(capabilities.contractVersion, '1.52');
assert.equal(capabilities.handoff.protocol, 'tbtv-session-v1');
for (const [surface, controller] of Object.entries(controllers)) {
  assert.match(await read('public/surfaces/' + surface + '.html'), new RegExp(controller));
}
assert.doesNotMatch(browser, /<script[^>]+src=["'][^"']*grabble-client\.js/);
assert.doesNotMatch(browser, /api\.qrserver\.com|quickchart\.io|chart\.google\.com/);
assert.match(browser, /TBLiveQR/);
assert.match(await read('public/js/grabble-transport.js'), /v:\s*1/);
assert.match(await read('public/js/grabble-transport.js'), /snapshot/);
assert.match(server, /setAlarm|alarm\(/);
assert.match(server, /storage\.get|storage\.put/);
assert.match(server, /seq/);

const display = await read('public/surfaces/display.html');
const tv = await read('public/surfaces/tv.html');
assert.notEqual(display, tv);
const css = await read('public/css/grabble-tv.css');
const baseCss = await read('public/css/grabble-base.css');
assert.ok(Buffer.byteLength(baseCss) < 3000, 'shared stylesheet must stay limited to small primitives');
assert.match(css, /setup-modal-tv[\s\S]*100dvh/);
assert.match(css, /setup-modal-tv[\s\S]*overflow:hidden/);
assert.match(css, /setup-modal-tv[\s\S]*setup-footer/);
assert.match(css, /aspect-ratio:auto!important/);
assert.match(css, /setup-tv-back/);
console.log('TBTV 1.52 static surface and monolith-boundary checks passed');
