(function () {
  let api = {};

  // One setup definition drives both host and TV room creation. The surfaces
  // can style it independently, but the choices and submitted config stay the same.
  const createDefinition = Object.freeze({
    options: [
      { id: "single", title: "Single game", detail: "One quick game." },
      { id: "competition", title: "Competition", detail: "Play a series of rounds." },
    ],
  });

  const configure = (next) => { api = next; };
  const opaqueSplash = (after) => {
    const splash = document.createElement("div");
    splash.className = "tblive-entry-splash";
    splash.setAttribute("aria-label", "Grabble");
    splash.innerHTML = api.logo();
    document.body.append(splash);
    window.setTimeout(() => {
      splash.remove();
      after?.();
    }, 2500);
  };

  function createSetup(context, hostName = "") {
    let chosen = "single";
    const tv = context === "tv";
    const modal = document.createElement("div");
    modal.className = "setup-modal" + (tv ? " setup-modal-tv" : " setup-modal-host");
    modal.innerHTML =
      '<div class="setup-backdrop"></div><section class="setup-card" role="dialog" aria-modal="true" aria-labelledby="setup-title">' +
      '<div class="setup-head setup-head-tv">' + (tv ? '<button class="setup-tv-back" id="setup-tv-back" type="button" aria-label="Back to TriviaBranch TV">← TriviaBranch</button>' : "") + api.logo() +
      '<p class="setup-step-label">GAME SETUP</p></div><div class="setup-page active"><p class="setup-kicker">GAME FORMAT</p><h2 id="setup-title">Choose a format</h2><div class="setup-options">' +
      createDefinition.options.map((option, index) => '<button class="setup-option' + (index === 0 ? " selected" : "") + '" aria-pressed="' + (index === 0 ? "true" : "false") + '" data-mode="' + option.id + '"><strong>' + option.title + '</strong><small>' + option.detail + "</small></button>").join("") +
      '</div><div class="setup-page-actions"><button class="next" id="create-room">Open lobby</button></div></div></section>';
    document.body.append(modal);
    modal.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
      chosen = button.dataset.mode;
      modal.querySelectorAll("[data-mode]").forEach((option) => {
        const selected = option === button;
        option.classList.toggle("selected", selected);
        option.setAttribute("aria-pressed", String(selected));
      });
    }));
    modal.querySelector("#setup-tv-back")?.addEventListener("click", () => modal.remove());
    modal.querySelector("#create-room").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "Creating…";
      try {
        const result = await api.create({ gameId: "grabble", contractVersion: "1.52", creationContext: context, config: { mode: chosen }, hostPlayer: context === "host" ? { displayName: hostName } : undefined });
        if (!result.controlToken) throw new Error("The room was created without its TV or host control token.");
        localStorage.setItem("grabble-" + context + "-token:" + result.code, result.controlToken);
        if (result.playerToken) {
          localStorage.setItem("grabble-player-token:" + result.code, result.playerToken);
          localStorage.setItem("grabble-name:" + result.code, hostName);
        }
        if (result.creationContext !== context || result.controllerRole !== context || result.route !== "/" + context + "/" + result.code) throw new Error("Room setup returned the wrong controller route.");
        location.href = result.route;
      } catch (error) {
        button.disabled = false;
        button.textContent = "Open lobby";
        let note = modal.querySelector(".create-error");
        if (!note) {
          note = document.createElement("p");
          note.className = "status create-error";
          modal.querySelector(".setup-page").append(note);
        }
        note.textContent = error?.message || "Could not create the room. Try again.";
      }
    });
  }

  function hostNameEntry() {
    const modal = document.createElement("div");
    modal.className = "setup-modal host-name-modal";
    modal.innerHTML = '<div class="setup-backdrop"></div><section class="setup-card" role="dialog" aria-modal="true" aria-labelledby="host-name-title"><div class="setup-head">' + api.logo() + '</div><div class="setup-page active"><p class="eyebrow">HOST</p><h2 id="host-name-title">Your Name</h2><p>Your name will appear in the room as its first player.</p><div class="setup-field"><input id="host-name" maxlength="18" placeholder="YOUR NAME" autocomplete="name"></div><div class="setup-page-actions"><button class="next" id="confirm-host-name">Continue</button></div></div></section>';
    document.body.append(modal);
    const input = modal.querySelector("#host-name");
    input.value = localStorage.getItem("grabble-host-name") || "";
    input.focus();
    const proceed = () => {
      const name = input.value.trim().slice(0, 18);
      if (!name) { input.focus(); return; }
      localStorage.setItem("grabble-host-name", name);
      modal.remove();
      createSetup("host", name);
    };
    modal.querySelector("#confirm-host-name").addEventListener("click", proceed);
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") proceed(); });
  }

  function tvHome() {
    createSetup("tv");
  }

  function home() {
    api.shell('<section class="center home-hero"><div class="home-panel panel"><p class="home-kicker">GRABBLE</p><h1>Build the longest word before time runs out.</h1><p class="home-copy">Grab letters from the pool. Make your word before the clock runs out.</p><div class="home-actions"><button id="open-host">Play Now</button><button class="secondary" id="open-join">Join Room</button></div></div></section>');
    document.getElementById("open-host").addEventListener("click", () => {
      sessionStorage.setItem("grabble-entry-splash", "host");
      location.href = "/host";
    });
    document.getElementById("open-join").addEventListener("click", () => {
      opaqueSplash(joinRoomForm);
    });
  }

  function joinRoomForm() {
    const modal = document.createElement("div");
    modal.className = "setup-modal join-room-modal";
    modal.innerHTML = '<div class="setup-backdrop"></div><section class="setup-card" role="dialog" aria-modal="true" aria-labelledby="join-title"><div class="setup-head">' + api.logo() + '</div><div class="setup-page active"><p class="eyebrow">JOIN ROOM</p><h2 id="join-title">Enter the room code</h2><div class="setup-field"><input id="room-code" maxlength="4" placeholder="ROOM CODE" autocomplete="off" inputmode="text"></div><label class="setup-field"><span>Your Name</span><input id="join-name" maxlength="18" placeholder="YOUR NAME" autocomplete="name"></label></div><div class="setup-footer"><button class="back" id="cancel-join">Cancel</button><button class="next" id="join-room">Join Room</button></div></section>';
    document.body.append(modal);
    const codeInput = modal.querySelector("#room-code");
    const nameInput = modal.querySelector("#join-name");
    nameInput.value = localStorage.getItem("grabble-last-player-name") || "";
    const close = () => modal.remove();
    modal.querySelector("#cancel-join").addEventListener("click", close);
    modal.querySelector(".setup-backdrop").addEventListener("click", close);
    modal.querySelector("#join-room").addEventListener("click", () => {
      const code = codeInput.value.trim().toUpperCase();
      const name = nameInput.value.trim().slice(0, 18);
      if (!/^[A-Z0-9]{4}$/.test(code)) { codeInput.focus(); return; }
      if (!name) { nameInput.focus(); return; }
      localStorage.setItem("grabble-last-player-name", name);
      localStorage.setItem("grabble-pending-join", JSON.stringify({ code, name }));
      location.href = "/play/" + code;
    });
    codeInput.focus();
  }

  function hostHome() {
    const begin = () => hostNameEntry();
    if (sessionStorage.getItem("grabble-entry-splash") === "host") {
      sessionStorage.removeItem("grabble-entry-splash");
      opaqueSplash(begin);
    } else begin();
  }

  window.GrabbleCreate = { configure, createDefinition, tvHome, home, hostHome, createSetup, opaqueSplash };
})();
