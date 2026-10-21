import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:8787';
const browser = await chromium.launch({ headless: true });
try {
  // Hosted creation is exercised at a phone viewport, including the homepage
  // entry splash, name-first setup and host-as-first-player room snapshot.
  const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const host = await hostContext.newPage();
  await host.goto(base + '/', { waitUntil: 'networkidle' });
  assert.equal(await host.getByRole('button', { name: 'Play Now', exact: true }).count(), 1);
  assert.equal(await host.getByRole('button', { name: 'Join Room', exact: true }).count(), 1);
  await host.getByRole('button', { name: 'Play Now', exact: true }).click();
  await host.locator('.tblive-entry-splash').waitFor({ state: 'visible' });
  await host.locator('#host-name').waitFor({ state: 'visible', timeout: 5000 });
  await host.locator('#host-name').fill('Ash');
  await host.getByRole('button', { name: 'Continue', exact: true }).click();
  await host.getByRole('heading', { name: 'Choose a format' }).waitFor();
  const hostRequestPromise = host.waitForRequest(request => request.url().endsWith('/api/create'));
  await host.getByRole('button', { name: 'Open lobby', exact: true }).click();
  const hostRequest = await hostRequestPromise;
  const hostPayload = hostRequest.postDataJSON();
  assert.equal(hostPayload.creationContext, 'host');
  assert.equal(hostPayload.contractVersion, '1.52');
  assert.deepEqual(hostPayload.hostPlayer, { displayName: 'Ash' });
  await host.waitForURL(url => /^\/host\/[A-Z0-9]{4}$/.test(url.pathname));
  const hostCode = new URL(host.url()).pathname.split('/').pop();
  await host.getByText('Ash', { exact: true }).waitFor();
  await host.locator('[data-join-qr]').waitFor();
  assert.equal(await host.getByText(/https?:\/\//).count(), 0, 'host lobby must not display the raw join URL');
  await host.getByRole('button', { name: 'Start game', exact: true }).waitFor();

  const hostPlayerPopup = host.waitForEvent('popup');
  await host.getByRole('button', { name: 'Join as a player', exact: true }).click();
  const hostPlayer = await hostPlayerPopup;
  await hostPlayer.waitForURL(new RegExp('/play/' + hostCode + '$'));
  await hostPlayer.locator('.mobile-lobby').waitFor();
  await hostPlayer.getByText('Ash', { exact: true }).waitFor();

  const joinContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const guest = await joinContext.newPage();
  await guest.goto(base + '/', { waitUntil: 'networkidle' });
  await guest.getByRole('button', { name: 'Join Room', exact: true }).click();
  await guest.locator('.tblive-entry-splash').waitFor({ state: 'visible' });
  await guest.locator('#room-code').waitFor({ state: 'visible', timeout: 5000 });
  await guest.locator('#room-code').fill(hostCode);
  await guest.locator('#join-name').fill('Guest');
  await guest.getByRole('button', { name: 'Join Room', exact: true }).last().click();
  await guest.waitForURL(new RegExp('/play/' + hostCode + '$'));
  await guest.locator('.mobile-lobby').waitFor();
  await guest.getByText('Guest', { exact: true }).waitFor();
  await host.getByText('Guest', { exact: true }).waitFor();

  const display = await hostContext.newPage();
  await display.goto(base + '/display/' + hostCode, { waitUntil: 'networkidle' });
  await display.locator('[data-join-qr]').waitFor();
  await display.getByText('Ash', { exact: true }).waitFor();

  const projection = await hostContext.newPage();
  await projection.goto(base + '/tv/' + hostCode, { waitUntil: 'networkidle' });
  await projection.getByText('Ash', { exact: true }).waitFor();
  assert.equal(await projection.getByRole('button', { name: 'Start game', exact: true }).count(), 0, 'TV projection of a hosted room must be read-only');

  // The TV portal explicitly marks its handoff so only that entry gets a splash.
  const tvContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const tv = await tvContext.newPage();
  await tv.goto(base + '/tv?entry=portal', { waitUntil: 'networkidle' });
  await tv.locator('.tblive-entry-splash').waitFor({ state: 'visible' });
  await tv.getByRole('heading', { name: 'Choose a format' }).waitFor({ timeout: 5000 });
  const tvRequestPromise = tv.waitForRequest(request => request.url().endsWith('/api/create'));
  await tv.getByRole('button', { name: 'Open lobby', exact: true }).click();
  const tvRequest = await tvRequestPromise;
  const tvPayload = tvRequest.postDataJSON();
  assert.equal(tvPayload.creationContext, 'tv');
  assert.equal(tvPayload.gameId, 'grabble');
  await tv.waitForURL(url => /^\/tv\/[A-Z0-9]{4}$/.test(url.pathname));
  const tvCode = new URL(tv.url()).pathname.split('/').pop();
  await tv.locator('[data-join-qr]').waitFor();
  assert.ok(await tv.evaluate(code => localStorage.getItem('grabble-tv-token:' + code), tvCode), 'TV creation must retain its controller token');
  await tv.getByRole('button', { name: 'Start game', exact: true }).waitFor();

  const player = await tvContext.newPage();
  await player.goto(base + '/play/' + tvCode, { waitUntil: 'networkidle' });
  await player.locator('#name').fill('Riley');
  await player.getByRole('button', { name: 'Join game' }).click();
  await player.locator('.mobile-lobby').waitFor();
  await tv.getByText('Riley', { exact: true }).waitFor();
  await tv.getByRole('button', { name: 'Start game', exact: true }).click();
  await tv.locator('.display-pool').waitFor({ state: 'visible', timeout: 10000 });
  const roundClock = tv.locator('#tv-round-clock');
  await roundClock.waitFor({ state: 'visible' });
  assert.match(await roundClock.textContent(), /^\d+s$/, 'TV gameplay must show a live countdown clock');
  await tv.waitForTimeout(33000);
  await tv.locator('.display-result-stage .time-up').waitFor({ state: 'visible', timeout: 10000 });
  await tv.getByRole('button', { name: 'Play again', exact: true }).click();
  await tv.locator('.display-lobby').waitFor({ state: 'visible', timeout: 10000 });

  await browser.close();
  console.log('Grabble standalone create, player join, TV projection and replay browser flow passed');
} catch (error) {
  await browser.close();
  throw error;
}
