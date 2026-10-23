(function () {
  let api = {},
    adminTimer;
  const shell = (...args) => api.shell(...args),
    esc = (...args) => api.esc(...args);
  async function admin() {
    shell('<section class="center panel admin-panel"><p class="eyebrow">GRABBLE ADMIN</p><h1>Admin</h1><p class="status">Loading live rooms and dictionary controls…</p></section>');
    try {
    const responses = await Promise.all([
      fetch("/api/admin", { cache: "no-store" }),
      fetch("/api/admin/config", { cache: "no-store" }),
    ]);
    if (responses.some(response => !response.ok)) throw new Error("Admin API unavailable");
    const [x, cfg] = await Promise.all(responses.map(response => response.json()));
    x.rooms = Array.isArray(x.rooms) ? x.rooms : [];
    shell(
      '<section class="center panel admin-panel"><div class="controls"><div><p class="eyebrow">GRABBLE ADMIN</p><h1>Admin</h1><p class="status">Dictionary controls and active transient TBLive sessions.</p></div><button id="refresh">Refresh</button></div><nav class="admin-tabs" role="tablist"><button class="admin-tab active" data-admin-tab="api" role="tab" aria-selected="true">Dictionary API</button><button class="admin-tab" data-admin-tab="rooms" role="tab" aria-selected="false">Live rooms</button></nav><section id="admin-tab-api" class="admin-tab-panel active" role="tabpanel"><section class="panel dictionary-config"><p class="eyebrow">LIVE DICTIONARY API</p><h2>Scoring provider</h2><p>Choose which cached API powers live word validation.</p><div class="config-row"><select id="dictionary-provider"><option value="datamuse">Datamuse</option><option value="dictionaryapi">dictionaryapi.dev</option></select><button id="save-dictionary-provider">Save provider</button><span id="dictionary-provider-status" aria-live="polite"></span></div></section><section class="panel dictionary-health"><p class="eyebrow">DICTIONARY COMPARISON</p><h2>Test a word across APIs</h2><p>One lookup, using the same server-side path that live scoring can use.</p><form id="dictionary-form" class="join"><input id="dictionary-word" maxlength="32" autocomplete="off" placeholder="Enter a word"><button type="submit">Compare APIs</button></form><div id="dictionary-result" class="dictionary-result" aria-live="polite">Try trains, title, rare, cleaners or a nonsense word.</div></section></section><section id="admin-tab-rooms" class="admin-tab-panel" role="tabpanel" hidden><div class="admin-list">' +
        (x.rooms.length
          ? x.rooms
              .map(
                (r) =>
                  '<div class="admin-room"><span><b>' +
                  esc(r.code) +
                  "</b><br><small>" +
                  esc(r.mode) +
                  " · " +
                  r.players +
                  " players · " +
                  new Date(r.updatedAt || r.createdAt).toLocaleTimeString() +
                  '</small></span><button class="danger" data-kill="' +
                  r.code +
                  '">Kill</button></div>',
              )
              .join("")
          : "<p>No live rooms.</p>") +
        '</div></section><small class="admin-build">Build persistent-registry</small></section>',
    );
    document.querySelectorAll("[data-admin-tab]").forEach(
      (tab) =>
        (tab.onclick = () => {
          const target = tab.dataset.adminTab;
          document.querySelectorAll("[data-admin-tab]").forEach((x) => {
            const active = x === tab;
            x.classList.toggle("active", active);
            x.setAttribute("aria-selected", active ? "true" : "false");
          });
          document.querySelectorAll(".admin-tab-panel").forEach((panel) => {
            const active = panel.id === "admin-tab-" + target;
            panel.classList.toggle("active", active);
            panel.hidden = !active;
          });
        }),
    );
    document.getElementById("refresh").onclick = admin;
    const provider = document.getElementById("dictionary-provider"),
      providerStatus = document.getElementById("dictionary-provider-status");
    provider.value = cfg.dictionaryProvider || "datamuse";
    document.getElementById("save-dictionary-provider").onclick = async () => {
      providerStatus.textContent = "Saving…";
      const response = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dictionaryProvider: provider.value }),
      });
      const saved = await response.json();
      providerStatus.textContent = saved.ok ? "Saved" : "Could not save";
    };
    document.getElementById("dictionary-form").onsubmit = async (e) => {
      e.preventDefault();
      const input = document.getElementById("dictionary-word"),
        result = document.getElementById("dictionary-result"),
        word = input.value.trim();
      if (!word) {
        input.focus();
        return;
      }
      result.textContent = "Checking APIs…";
      try {
        const response = await fetch(
            "/api/admin/compare?word=" + encodeURIComponent(word),
            { cache: "no-store" },
          ),
          data = await response.json();
        const rows = (data.results || [])
          .map(
            (item) =>
              "<tr><th>" +
              esc(item.name) +
              "</th><td>" +
              (item.valid === true
                ? "Valid"
                : item.valid === false
                  ? "Not found"
                  : "Unavailable") +
              "</td><td>" +
              (item.score == null ? "—" : item.score) +
              "</td><td>" +
              (item.latencyMs == null ? "—" : item.latencyMs + "ms") +
              "</td><td>" +
              (item.cached ? "cached" : "fresh") +
              (item.error ? " · " + esc(item.error) : "") +
              "</td></tr>",
          )
          .join("");
        result.innerHTML =
          "<strong>" +
          esc(data.word || word) +
          "</strong><table><thead><tr><th>API</th><th>Result</th><th>Score</th><th>Time</th><th>State</th></tr></thead><tbody>" +
          rows +
          "</tbody></table>";
      } catch {
        result.textContent =
          "The API comparison failed before a result was returned.";
      }
    };
    document.querySelectorAll("[data-kill]").forEach(
      (b) =>
        (b.onclick = async () => {
          await fetch("/api/admin/kill/" + b.dataset.kill, { method: "POST" });
          admin();
        }),
    );
    clearTimeout(adminTimer);
    adminTimer = setTimeout(admin, 30000);
    } catch (error) {
      shell('<section class="center panel admin-panel"><p class="eyebrow">GRABBLE ADMIN</p><h1>Admin</h1><p class="status" role="status">Admin data is temporarily unavailable. Use Refresh to try again.</p><button id="refresh">Refresh</button></section>');
      document.getElementById("refresh").onclick = admin;
      clearTimeout(adminTimer);
      adminTimer = setTimeout(admin, 30000);
    }
  }
  window.GrabbleAdmin = {
    configure: (next) => {
      api = next || {};
    },
    render: admin,
  };
})();
