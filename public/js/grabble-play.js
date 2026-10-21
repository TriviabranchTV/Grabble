(function () {
  const s = window.GrabbleSurface;
  s.configureCreate();
  window.GrabblePlayer.configure({
    getState: () => s.getState(),
    send: (message) => window.GrabbleTransport.send(message),
  });
  let timer = null;
  const updateTimer = (state) => {
    clearInterval(timer);
    timer = null;
    if (!["countdown", "running"].includes(state.phase)) return;
    const paint = () => {
      const node = document.querySelector(".play-timer");
      if (!node) return;
      const seconds = Math.max(0, Math.ceil(((state.endAt || Date.now()) - Date.now()) / 1000));
      node.textContent = seconds + "s";
    };
    paint();
    timer = setInterval(paint, 100);
  };
  const entry = (after) => {
    const modal = document.createElement("div");
    modal.className = "entry rules show how-to-play-modal";
    modal.innerHTML = '<div class="entry-card">' + s.logo() + '<h2>How to play</h2><div class="rules-list"><div class="rule"><span class="rule-index">01</span><p>Grab a letter from the pool.</p></div><div class="rule"><span class="rule-index">02</span><p>Build the longest word before time runs out.</p></div><div class="rule"><span class="rule-index">03</span><p>You can only grab the next letter on your word.</p></div><div class="rule"><span class="rule-index">04</span><p>If you make a mistake or change your mind, release all your letters and start again.</p></div></div><button id="go">Continue</button></div>';
    document.body.append(modal);
    modal.querySelector("#go").onclick = () => { modal.remove(); after?.(); };
  };
  const lobby = (state, me) => '<section class="mobile-lobby panel"><div class="mobile-lobby-head"><p class="eyebrow">' + (state.totalRounds > 1 ? "ROUND " + state.round + " OF " + state.totalRounds : "SINGLE GAME") + '</p><h1>Lobby</h1><p class="mobile-room-code">Room <strong>' + s.esc(s.code) + '</strong></p><p class="mobile-player-count">' + state.players.length + " player" + (state.players.length === 1 ? "" : "s") + ' joined</p></div><div class="mobile-lobby-players">' + (state.players.length ? state.players.map(p => '<div class="mobile-player"><span class="mobile-player-dot"></span><strong>' + s.esc(p.name) + "</strong>" + (p.id === me ? "<small>YOU</small>" : "") + "</div>").join("") : '<p class="status">Waiting for players</p>') + '</div>' + window.GrabbleRoomCommon.rules().replace("display-rules","mobile-lobby-rules") + '<div class="mobile-lobby-action"><button class="secondary" id="how-to-play">How to play</button>' + ((state.ownerId === me || state.players.length === 1) ? '<button id="start" class="race-start-cta">Start game</button>' : "<button disabled>Waiting for the creator</button>") + "</div></section>";
  const playerTiles = (word) => Array.from(word || "").map((letter) => '<span class="player-word-tile">' + s.esc(letter) + "</span>").join("");
  const playerResults = (state, me) => {
    const players = [...(state.players || [])].sort((a,b) => (b.totalScore || 0) - (a.totalScore || 0));
    const isOwner = state.ownerId === me || players.length === 1;
    const action = state.phase === "final"
      ? (isOwner ? '<button id="play-again">Play again</button>' : '<p class="status">Waiting for the creator to play again.</p>')
      : (isOwner ? '<button id="next-round">Next round</button>' : '<p class="status">Waiting for the next round.</p>');
    return '<section class="player-result-stage"><div class="player-result-heading"><p class="eyebrow">' + (state.phase === "final" ? "GAME COMPLETE" : "TIME’S UP") + '</p><h1>' + (state.phase === "final" ? "Final leaderboard" : "Round complete") + '</h1></div><div class="player-result-cards">' + players.map((p, i) => '<article class="player-result-card"><div class="player-result-card-head"><strong>' + (i + 1) + ". " + s.esc(p.name) + (p.id === me ? " · you" : "") + '</strong><span>' + (p.score || 0) + " points</span></div><div class=\"player-result-word\">" + (playerTiles(p.word) || '<span class="word-empty">No word</span>') + '</div><small>' + (p.totalScore || 0) + " total</small></article>").join("") + '</div><div class="player-result-actions">' + action + '<button class="secondary" id="leave-game">Leave game</button></div></section>';
  };
  const game = (state, me) => {
    const tokens = state.pool || [];
    const columns = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(tokens.length || 1))));
    const rows = Math.max(1, Math.ceil(tokens.length / columns));
    const poolTokens = tokens.map((t, i) => {
      const column = i % columns;
      const row = Math.floor(i / columns);
      const left = columns === 1 ? 50 : 12 + (column / (columns - 1)) * 76;
      const top = rows === 1 ? 50 : 16 + (row / (rows - 1)) * 68;
      const speed = (1.8 + (i % 5) * 0.22).toFixed(2);
      return '<div class="token ' + (t.letter === "*" ? "wild" : "") + '" data-id="' + s.esc(t.id) + '" style="left:' + left.toFixed(1) + '%;top:' + top.toFixed(1) + '%;--speed:' + speed + 's">' + (state.phase === "running" ? (t.letter === "*" ? "★" : s.esc(t.letter)) : "") + "</div>";
    }).join("");
    const mine = (state.players || []).find((p) => p.id === me) || { word: "" };
    const countdown = Math.max(1, Math.ceil(((state.endAt || Date.now()) - Date.now()) / 1000));
    const timer = state.phase === "countdown" ? countdown + "s" : state.phase === "running" ? countdown + "s" : "READY";
    return '<section class="center player-game"><div class="controls"><div class="play-round"><div class="timer play-timer">' + timer + '</div><small>' + (state.phase === "countdown" ? "Get ready · " : "") + 'Round ' + state.round + " of " + state.totalRounds + '</small></div></div>' + (state.phase === "results" || state.phase === "final" ? playerResults(state,me) : '<section class="pool">' + poolTokens + '</section><div class="panel player-word-panel"><div class="word-card-head"><h2>Your word</h2><button class="release-x" id="release" aria-label="Reset word">Reset</button></div><div class="wordline" id="wordline">' + (playerTiles(mine.word) || '<span class="word-empty">Drag letters here</span>') + '</div></div>') + "</section>";
  };
  const join = () => {
    s.shell('<section class="center join-room-card panel"><div class="join-room-head"><p class="eyebrow">JOIN THIS GAME</p><h1>Join this room</h1><p>Enter your name to play.</p><span class="room-code-mini">' + s.esc(s.code) + '</span></div><div class="join-field"><input id="name" maxlength="18" placeholder="YOUR NAME"><button id="join">Join game</button></div></section>');
    document.getElementById("join").onclick = () => {
      const input = document.getElementById("name");
      const name = input.value.trim().slice(0, 18);
      if (!name) { input.focus(); return; }
      localStorage.setItem("grabble-last-player-name", name);
      localStorage.setItem("grabble-name:" + s.code, name);
      s.shell('<section class="center hero panel"><h1>Joining the room</h1><p class="status">Room <b>' + s.esc(s.code) + "</b></p></section>");
      s.connect("play", name, (next) => render(next));
    };
  };
  const render = (state) => {
    const me = s.getMe();
    if (state.phase === "lobby") {
      clearInterval(timer);
      timer = null;
      s.shell(lobby(state, me));
      document.getElementById("start")?.addEventListener("click", () => window.GrabbleTransport.send({type:"start"}), {once:true});
      document.getElementById("how-to-play")?.addEventListener("click", () => entry());
      return;
    }
    s.shell(game(state, me));
    updateTimer(state);
    if (state.phase === "results" || state.phase === "final") {
      document.getElementById("next-round")?.addEventListener("click", () => window.GrabbleTransport.send({type:"next"}), {once:true});
      document.getElementById("play-again")?.addEventListener("click", () => window.GrabbleTransport.send({type:"restart"}), {once:true});
      document.getElementById("leave-game")?.addEventListener("click", () => s.leave(), {once:true});
    } else if (state.phase === "running") {
      window.GrabblePlayer.bind();
    }
  };
  const boot = () => {
    const query = new URLSearchParams(location.search);
    if (query.get("sessionPlayerId")) {
      if (query.get("playerToken")) localStorage.setItem("grabble-player-token:" + s.code, query.get("playerToken"));
      localStorage.setItem("grabble-name:" + s.code, query.get("name") || "Player");
      s.connect("play", query.get("name") || "Player", (next) => render(next));
      return;
    }
    if (!s.code) return window.GrabbleCreate.home();
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem("grabble-pending-join") || "null"); } catch {}
    if (pending && pending.code === s.code && pending.name) {
      localStorage.removeItem("grabble-pending-join");
      s.shell('<section class="center hero panel"><h1>Joining the room</h1><p class="status">Room <b>' + s.esc(s.code) + "</b></p></section>");
      s.connect("play", pending.name, (next) => render(next));
    } else if (localStorage.getItem("grabble-player-token:" + s.code)) {
      s.connect("play", localStorage.getItem("grabble-name:" + s.code) || localStorage.getItem("grabble-last-player-name") || "Player", (next) => render(next));
    } else join();
  };
  boot();
})();
