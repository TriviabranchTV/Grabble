(function () {
  const s = window.GrabbleSurface;
  const common = window.GrabbleRoomCommon;
  const avatarText = value => typeof value === "string" ? value : value?.value || (value?.type === "photo" ? "📷" : "");
  s.configureCreate();
  document.getElementById("tv-back")?.addEventListener("click", () => {
    s.setLeaving();
    location.href = "https://tv.triviabranch.com";
  });
  const qr = () => {
    const node = document.querySelector("[data-join-qr]");
    if (!node || !window.TBLiveQR || activeState?.sessionMode) return;
    window.TBLiveQR.renderJoinQr(window.TBLiveQR.buildJoinTarget({origin:location.origin,code:s.code}), {container:node,size:180,alt:"Scan to join Grabble room " + s.code,title:"Join Grabble"});
  };
  const lobby = (state) => {
    const canControl = state.controllerRole === "tv" && s.getConnectionRole() === "tv";
    const join = state.sessionMode ? '<aside class="display-qr session-roster"><img class="display-qr-logo" src="/assets/grabble-wordmark.png" alt="Grabble"><p>Games night</p><p>Players joined from the shared lobby</p></aside>' : '<div class="display-qr"><img class="display-qr-logo" src="/assets/grabble-wordmark.png" alt="Grabble"><div class="display-qr-code" data-join-qr></div><p>Scan to join</p><p>Room code <strong>' + s.esc(s.code) + '</strong></p></div>';
    return '<div class="display-stage"><div class="display-lobby"><div class="display-copy"><p class="eyebrow">' + (state.sessionMode ? 'GRABBLE' : 'ROOM ' + s.esc(s.code)) + '</p><h1>Lobby</h1><p>' + state.players.length + " player" + (state.players.length === 1 ? "" : "s") + ' joined</p><div class="display-drawings">' + (state.players.length ? state.players.map(p => '<div class="display-drawing-card pending"><strong>' + s.esc((avatarText(p.avatar) ? avatarText(p.avatar) + ' ' : '') + p.name) + '</strong><span class="player-presence">' + (p.isHost ? 'Host · ready to play' : 'Joined') + '</span></div>').join("") : '<div class="display-drawing-card pending"><strong>Waiting for players</strong><span class="player-presence">Share the QR code to join</span></div>') + '</div>' + common.rules() + '<div class="display-controls">' + (canControl && state.players.length ? '<button id="start" class="race-start-cta">Start game</button>' : "") + '</div></div>' + join + '</div></div>';
  };
  const live = state => `<div class="display-stage"><div class="tv-round-clock" id="tv-round-clock" role="timer" aria-label="Time remaining"></div>${common.pool(state, true)}<div class="corners">${(state.players || []).map(player => `<article class="corner" data-player-id="${s.esc(player.id)}"><div class="display-player-head"><b>${s.esc((avatarText(player.avatar) ? avatarText(player.avatar) + " " : "") + player.name)}</b></div><div class="live-word" aria-label="Selected letters">${player.word ? Array.from(player.word).map(letter => `<i class="live-letter-tile">${s.esc(letter)}</i>`).join("") : '<span class="live-word-empty">Waiting for letters</span>'}</div><small class="player-score-line"><span>${(player.word || "").length} letters · ${player.totalScore || 0} total</span></small></article>`).join("")}</div></div>`;
  const paintClock = () => {
    const clock = document.getElementById("tv-round-clock");
    if (!clock || !activeState) return;
    const seconds = Math.max(0, Math.ceil((activeState.endAt - Date.now()) / 1000));
    clock.textContent = seconds + "s";
    clock.setAttribute("aria-label", seconds + " seconds remaining");
  };
  const fitPlayerWords = () => {
    document.querySelectorAll(".shell-tv .corner .live-word").forEach(word => {
      const tiles = word.querySelectorAll(".live-letter-tile");
      if (!tiles.length) return;
      const available = word.clientWidth;
      const gap = parseFloat(getComputedStyle(word).columnGap) || 0;
      const size = Math.max(14, Math.min(52, (available - gap * (tiles.length - 1)) / tiles.length));
      word.style.setProperty("--tile-size", size + "px");
    });
  };
  let activeState = null;
  window.setInterval(paintClock, 200);
  const bind = (state) => {
    document.getElementById("start")?.addEventListener("click", () => window.GrabbleTransport.send({type:"start"}), {once:true});
  };
  const render = (state) => {
    activeState = state;
    if (state.phase === "lobby") { s.shell(lobby(state)); qr(); bind(state); return; }
    if (state.phase === "countdown" || state.phase === "running" || state.phase === "scoring") {
      s.shell(state.phase === "scoring" ? '<div class="display-stage scoring-stage"><section class="display-pool result-pool"><div class="display-pool-title">Letter cache</div></section><div class="scoring-screen"><div><p class="eyebrow">TIME’S UP</p><h1>Scoring…</h1></div></div></div>' : live(state));
      requestAnimationFrame(fitPlayerWords);
      paintClock();
      return;
    }
    const canControl = state.controllerRole === "tv" && s.getConnectionRole() === "tv";
    const actions = canControl ? (state.phase === "final" ? '<div class="tv-result-actions"><button id="play-again">Play again</button>' + (state.sessionMode ? '<button class="secondary" id="return-session">Back to games night</button>' : '<button class="secondary" id="tv-home">Back to TriviaBranch TV</button>') + '</div>' : '<div class="tv-result-actions"><button id="start">Next round</button></div>') : "";
    s.shell(common.results(state,s.getMe(),actions));
    document.getElementById("start")?.addEventListener("click", () => window.GrabbleTransport.send({type:"next"}), {once:true});
    document.getElementById("play-again")?.addEventListener("click", () => window.GrabbleTransport.send({type:"restart"}), {once:true});
    document.getElementById("tv-home")?.addEventListener("click", () => location.href="https://tv.triviabranch.com", {once:true});
    document.getElementById("return-session")?.addEventListener("click", () => window.GrabbleTransport.send({type:"returnToSession"}), {once:true});
  };
  const enter = () => {
    s.onEvent = event => { if (event.type === "return_to_session" && s.sessionCode) location.href = "https://tv.triviabranch.com/tv/" + encodeURIComponent(s.sessionCode); };
    if (!s.code) window.GrabbleCreate.tvHome();
    else s.connect("tv", "TV", render);
  };
  if (new URLSearchParams(location.search).get("entry") === "portal") window.GrabbleCreate.opaqueSplash(enter);
  else enter();
})();
