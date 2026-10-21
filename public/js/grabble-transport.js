/* Shared room transport. Each surface owns its page markup and rendering. */
(function () {
  let config = {},
    socket = null,
    connection = null,
    reconnectTimer = null,
    queuedAction = null,
    lastSeq = 0,
    lastSnapshotSeq = 0;
  const configure = (next) => {
    config = next || {};
  };
  const envelope = (payload) => ({ v: 1, type: "action", requestId: crypto.randomUUID(), payload });
  const send = (action) => {
    if (socket?.readyState === 1) socket.send(JSON.stringify(envelope(action)));
    else if (action.type === "start" || action.type === "next" || action.type === "restart") {
      queuedAction = action;
      if ((!socket || socket.readyState > 1) && connection && !reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect(connection.role, connection.name);
        }, 50);
      }
    }
  };
  const connect = (role, name) => {
    connection = { role, name };
    const code = config.code || "",
      mode = config.mode || "play";
    const query = new URLSearchParams(location.search);
    const playerToken =
      role === "play" ? (query.get("playerToken") || localStorage.getItem("grabble-player-token:" + config.code) || "") : "";
    const queryControlToken = query.get("controlToken") || "";
    const sessionPlayerId = query.get("sessionPlayerId") || "";
    if (role === "play" && playerToken) localStorage.setItem("grabble-player-token:" + config.code, playerToken);
    const controlToken =
      role === "tv"
        ? (queryControlToken || localStorage.getItem("grabble-tv-token:" + config.code) || "")
        : role === "host"
          ? (queryControlToken || localStorage.getItem("grabble-host-token:" + config.code) || "")
          : "";
    socket = new WebSocket(
      (location.protocol === "https:" ? "wss" : "ws") +
        "://" +
        location.host +
        "/ws/" +
        code +
        "?role=" +
        role +
        "&name=" +
        encodeURIComponent(name || "") +
        "&playerToken=" +
        encodeURIComponent(playerToken) +
        "&sessionPlayerId=" +\n        encodeURIComponent(sessionPlayerId) +\n        "&controlToken=" +
        encodeURIComponent(controlToken),
    );
    socket.onopen = () => {
      if (queuedAction) {
          socket.send(JSON.stringify(envelope(queuedAction)));
        queuedAction = null;
      }
    };
    socket.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type === "session_returned") { const code = message.payload?.sessionCode || message.sessionCode; if (code) location.href = "https://tv.triviabranch.com/" + (role === "tv" ? "tv/" : "join/") + encodeURIComponent(code); return; }
      if (message.type === "hello") {
        const hello = message.payload || message;
        config.onHello?.({ ...message, ...hello }, role);
        if (role === "play" && hello.playerToken)
          localStorage.setItem("grabble-player-token:" + config.code, hello.playerToken);
      }
      const sequence = Number(message.seq);
      if (Number.isFinite(message.seq) && message.seq > lastSeq + 1 && lastSeq > 0)
        send({ type: "sync" });
      if (Number.isFinite(sequence) && sequence > lastSeq) lastSeq = sequence;
      if (message.type === "authenticated") config.onAuthenticated?.(message.payload || {}, (message.payload || {}).role);
      if (["ack", "error", "state_changed", "phase_changed", "player_joined", "player_left", "timer_started", "timer_updated", "score_updated", "finished", "room_closed", "session_returned"].includes(message.type))
        config.onEvent?.({ ...message, ...(message.payload || {}) });
      if (message.type === "left") {
        config.onLeft?.();
        return;
      }
      if (message.type === "snapshot") {
        if (Number.isFinite(sequence) && sequence <= lastSnapshotSeq) return;
        if (Number.isFinite(sequence)) lastSnapshotSeq = sequence;
        config.onState?.({ ...message.payload, type: "state", v: message.v, seq: message.seq });
      }
    };
    socket.onclose = () => {
      const current = config.getState?.();
      if (
        !config.isLeaving?.() &&
        code &&
        current?.phase !== "final" &&
        current?.phase !== "closed" &&
        connection &&
        !reconnectTimer
      )
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect(connection.role, connection.name);
        }, 500);
    };
  };
  document.addEventListener("visibilitychange", () => {
    if (
      document.visibilityState === "visible" &&
      config.mode === "play" &&
      config.code &&
      (!socket || socket.readyState > 1)
    )
      connect("play", localStorage.getItem("grabble-name:" + config.code) || "Player");
  });
  window.GrabbleTransport = {
    configure,
    connect,
    send,
    getSocket: () => socket,
  };
})();
