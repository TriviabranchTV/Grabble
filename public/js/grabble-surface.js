(function () {
  const parts = location.pathname.split("/").filter(Boolean);
  const mode = parts[0] || "home";
  const code = parts[1] || "";
  const params = new URLSearchParams(location.search);
  const sessionPlayerId = params.get("sessionPlayerId") || "";
  const sessionCode = params.get("session") || "";
  let state = null;
  let me = null;
  let connectionRole = null;
  let leaving = false;
  let leaveTimer = null;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (x) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[x]));
  const logo = () => '<img src="/assets/grabble-wordmark.png" alt="Grabble">';
  const shell = (body) => {
    const content = document.getElementById("surface-content");
    if (content) content.innerHTML = body;
  };
  const create = async (request) => {
    const response = await fetch("/api/create", {
      method: "POST",
      headers: {"content-type":"application/json"},
      body: JSON.stringify(request),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.code) throw new Error(payload?.error || "Room creation failed");
    return payload;
  };
  const configureCreate = () => window.GrabbleCreate?.configure({
    shell, logo, create, mode, setLeaving: () => { leaving = true; }
  });
  const connect = (role, name, onState) => {
    window.GrabbleTransport.configure({
      code,
      sessionPlayerId: role === "play" ? sessionPlayerId : "",
      sessionCode,
      mode,
      getState: () => state,
      isLeaving: () => leaving,
      onHello: (message, actualRole) => {
        me = message.playerId;
        connectionRole = actualRole || connectionRole;
        window.GrabbleSurface.onHello?.(message);
      },
      onAuthenticated: (_message, actualRole) => { connectionRole = actualRole || connectionRole || role; },
      onState: (message) => {
        const previous = state;
        state = message;
        onState?.(state, previous);
      },
      onLeft: () => {
        clearTimeout(leaveTimer);
        localStorage.removeItem("grabble-player-token:" + code);
        localStorage.removeItem("grabble-pending-join");
        location.href = "/";
      },
      onEvent: (event) => window.GrabbleSurface.onEvent?.(event),
    });
    window.GrabbleTransport.connect(role, name);
  };
  const leave = () => {
    if (leaving) return;
    leaving = true;
    const finish = () => {
      clearTimeout(leaveTimer);
      localStorage.removeItem("grabble-player-token:" + code);
      localStorage.removeItem("grabble-pending-join");
      location.href = "/";
    };
    if (window.GrabbleTransport.getSocket()?.readyState === 1) {
      leaveTimer = setTimeout(finish, 700);
      window.GrabbleTransport.send({type:"leave"});
    } else finish();
  };
  window.GrabbleSurface = {
    mode, code, sessionPlayerId, sessionCode, esc, logo, shell, create, configureCreate, connect, leave,
    setLeaving: (value = true) => { leaving = value; },
    getState: () => state, getMe: () => me,
    getConnectionRole: () => connectionRole,
    setState: (next) => { state = next; },
    getLeaving: () => leaving,
  };
})();
