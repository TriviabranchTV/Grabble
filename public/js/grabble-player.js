(function () {
  let api = {},
    drag = null,
    ghost = null;
  const send = (...args) => api.send(...args);
  function bind() {
    const state = api.getState?.();
    const wildcardModal = (tokenId) => {
      const modal = document.createElement("div");
      modal.className = "wildcard-modal";
      modal.innerHTML =
        '<form class="wildcard-card"><p class="eyebrow">WILDCARD LETTER</p><h2>Choose its letter</h2><p>What letter should the ★ represent?</p><div class="wildcard-field"><input id="wildcard-letter" maxlength="1" inputmode="text" autocomplete="off" aria-label="Wildcard letter" required></div><div class="wildcard-actions"><button type="button" class="secondary" id="wildcard-cancel">Cancel</button><button type="submit">Use letter</button></div></form>';
      document.body.appendChild(modal);
      const form = modal.querySelector("form"),
        input = modal.querySelector("#wildcard-letter");
      input.addEventListener("input", () => {
        input.value = input.value
          .replace(/[^a-z]/gi, "")
          .slice(0, 1)
          .toUpperCase();
      });
      const close = (commit) => {
        if (commit && /^[A-Z]$/.test(input.value))
          send({ type: "commit", tokenId, letter: input.value });
        else send({ type: "cancel", tokenId });
        modal.remove();
      };
      form.onsubmit = (e) => {
        e.preventDefault();
        close(true);
      };
      modal.querySelector("#wildcard-cancel").onclick = () => close(false);
      modal.onclick = (e) => {
        if (e.target === modal) close(false);
      };
      input.focus();
    };
    const finish = (e) => {
      if (!drag) return;
      const d = drag,
        hit = document.elementFromPoint(e.clientX, e.clientY),
        board = document.getElementById("wordline"),
        rect = board?.getBoundingClientRect(),
        ok =
          !!(hit && hit.closest("#wordline")) ||
          !!(
            rect &&
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
          );
      if (ok && d.el.classList.contains("wild")) {
        const tokenId = d.id;
        d.el.classList.remove("dragging");
        ghost?.remove();
        drag = null;
        wildcardModal(tokenId);
        return;
      }
      send({ type: ok ? "commit" : "cancel", tokenId: d.id });
      d.el.classList.remove("dragging");
      ghost?.remove();
      drag = null;
    };
    document.querySelectorAll(".token:not(.claimed)").forEach((el) => {
      el.addEventListener("pointerdown", (e) => {
        if (!state || state.phase !== "running" || drag) return;
        e.preventDefault();
        drag = { id: el.dataset.id, el };
        el.classList.add("dragging");
        el.setPointerCapture?.(e.pointerId);
        send({ type: "reserve", tokenId: drag.id });
        ghost = el.cloneNode(true);
        ghost.style.position = "fixed";
        ghost.style.pointerEvents = "none";
        ghost.style.left = e.clientX + "px";
        ghost.style.top = e.clientY + "px";
        ghost.style.zIndex = 20;
        document.body.appendChild(ghost);
      });
    });
    document.onpointermove = (e) => {
      if (!drag) return;
      e.preventDefault();
      ghost.style.left = e.clientX + "px";
      ghost.style.top = e.clientY + "px";
    };
    window.onpointerup = finish;
    window.onpointercancel = () => {
      if (drag) {
        send({ type: "cancel", tokenId: drag.id });
        drag.el.classList.remove("dragging");
        ghost?.remove();
        drag = null;
      }
    };
    const release = document.getElementById("release");
    if (release)
      release.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (state?.phase === "running") send({ type: "releaseWord" });
      };
  }
  window.GrabblePlayer = {
    configure: (next) => {
      api = next || {};
    },
    bind,
    isDragging: () => !!drag,
  };
})();
