/* Shared spatial focus and safe Back handling for the TBTV Fire TV remote. */
(() => {
  const directions = {ArrowUp:[0,-1],ArrowRight:[1,0],ArrowDown:[0,1],ArrowLeft:[-1,0],Up:[0,-1],Right:[1,0],Down:[0,1],Left:[-1,0],DPAD_UP:[0,-1],DPAD_RIGHT:[1,0],DPAD_DOWN:[0,1],DPAD_LEFT:[-1,0]};
  const backKeys = new Set(["Escape","BrowserBack","GoBack","Back","Backspace"]);
  const selector = "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[role=button]:not([aria-disabled=true]),[tabindex='0']";
  let lastKey = "", scheduled = false;
  const visible = el => !!el.getClientRects().length && getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none";
  const scope = () => {
    const dialogs = [...document.querySelectorAll("[role=dialog],.modal-backdrop.open,.tv-session-setup-overlay")].filter(visible);
    return dialogs.length ? dialogs[dialogs.length-1] : document;
  };
  const items = () => [...scope().querySelectorAll(selector)].filter(el => visible(el) && el.getAttribute("aria-hidden") !== "true");
  const keyOf = el => el?.dataset?.remoteFocusKey || el?.dataset?.focusKey || el?.id || el?.getAttribute("aria-label") || "";
  const labelOf = el => [el.getAttribute("aria-label"),el.getAttribute("title"),el.textContent].filter(Boolean).join(" ").trim().toLowerCase();
  const isEditable = el => el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !["button","submit","checkbox","radio"].includes(el.type)) || el?.isContentEditable;
  function restoreFocus() {
    scheduled = false;
    const controls = items();
    if (!controls.length || controls.includes(document.activeElement)) return;
    const next = controls.find(el => el.hasAttribute("autofocus")) || controls.find(el => lastKey && keyOf(el) === lastKey) || controls[0];
    next?.focus({preventScroll:true});
  }
  function scheduleFocus() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(restoreFocus);
  }
  function move(current, dx, dy, controls) {
    if (!current) return controls[0] || null;
    const a=current.getBoundingClientRect(),ax=a.left+a.width/2,ay=a.top+a.height/2;
    let best=null,bestScore=Infinity;
    for(const el of controls){
      if(el===current)continue;
      const r=el.getBoundingClientRect(),x=r.left+r.width/2-ax,y=r.top+r.height/2-ay,forward=x*dx+y*dy;
      if(forward<=0)continue;
      const score=forward+Math.abs(x*dy-y*dx)*2.25;
      if(score<bestScore){best=el;bestScore=score}
    }
    return best;
  }
  document.addEventListener("focusin",event=>{if(event.target instanceof Element)lastKey=keyOf(event.target)},{capture:true});
  document.addEventListener("keydown",event=>{
    if(backKeys.has(event.key)){
      if(isEditable(event.target)||(event.target instanceof HTMLSelectElement&&event.key==="Escape"))return;
      const controls=items(),dialog=scope()!==document;
      const priority=dialog?["close","cancel","back to lobby","back","return to game select","return to game selection"]:["back to lobby","back","return to game select","return to game selection","cancel","close"];
      const explicit=controls.find(el=>el.hasAttribute("data-remote-back"));
      const target=explicit||priority.map(part=>controls.find(el=>labelOf(el)===part||labelOf(el).includes(part))).find(Boolean);
      event.preventDefault();event.stopImmediatePropagation();if(target)target.click();return;
    }
    const direction=directions[event.key];
    if(!direction||isEditable(event.target)||event.target instanceof HTMLSelectElement)return;
    const controls=items();if(!controls.length)return;
    const current=controls.includes(document.activeElement)?document.activeElement:null;
    const next=move(current,direction[0],direction[1],controls);
    if(next){event.preventDefault();event.stopImmediatePropagation();next.focus({preventScroll:true})}
  },{capture:true});
  const style=document.createElement("style");
  style.textContent=":focus-visible{outline:3px solid #fff;outline-offset:4px;box-shadow:0 0 0 5px #e4cd7955!important}";
  document.head.appendChild(style);
  let quitEnabled = false;
  function ensureQuitControls() {
    if (document.getElementById("tbtv-quit-control")) return;
    const button = document.createElement("button");
    button.id = "tbtv-quit-control";
    button.type = "button";
    button.setAttribute("aria-label", "Quit game");
    button.setAttribute("title", "Quit game");
    button.textContent = "×";
    button.hidden = true;
    const overlay = document.createElement("div");
    overlay.id = "tbtv-quit-confirmation";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "tbtv-quit-title");
    overlay.hidden = true;
    overlay.innerHTML = '<section class="tbtv-quit-panel"><h2 id="tbtv-quit-title">Quit this game?</h2><p>The game will end and everyone will return to game select.</p><div class="tbtv-quit-actions"><button type="button" data-remote-back data-quit-cancel>Keep playing</button><button type="button" data-quit-confirm>Quit to game select</button></div></section>';
    document.body.prepend(button);
    document.body.append(overlay);
    const close = () => { overlay.hidden = true; button.focus({preventScroll:true}); };
    button.addEventListener("click", () => { if (!quitEnabled) return; overlay.hidden = false; overlay.querySelector("[data-quit-cancel]")?.focus({preventScroll:true}); });
    overlay.querySelector("[data-quit-cancel]")?.addEventListener("click", close);
    overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
    overlay.querySelector("[data-quit-confirm]")?.addEventListener("click", () => {
      overlay.hidden = true;
      window.dispatchEvent(new CustomEvent("tbtv:quit-confirmed"));
    });
  }
  function setQuitEnabled(enabled) {
    quitEnabled = Boolean(enabled);
    ensureQuitControls();
    const button = document.getElementById("tbtv-quit-control");
    if (button) button.hidden = !quitEnabled;
    if (!quitEnabled) {
      const dialog = document.getElementById("tbtv-quit-confirmation");
      if (dialog) dialog.hidden = true;
    }
  }
  window.TBTVRemoteNavigation = { setQuitEnabled };
  const quitStyle = document.createElement("style");
  quitStyle.textContent = "#tbtv-quit-control{position:fixed;top:calc(env(safe-area-inset-top,0px) + clamp(14px,2vh,28px));left:calc(env(safe-area-inset-left,0px) + clamp(14px,2vw,28px));z-index:1100;width:50px;height:50px;padding:0;border:2px solid rgba(255,255,255,.82);border-radius:12px;background:rgba(7,11,18,.78);color:#fff;font-size:36px;line-height:1;cursor:pointer;backdrop-filter:blur(8px)}#tbtv-quit-control[hidden],#tbtv-quit-confirmation[hidden]{display:none}#tbtv-quit-confirmation{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:24px;background:rgba(3,7,13,.76);backdrop-filter:blur(10px)}.tbtv-quit-panel{width:min(540px,90vw);padding:clamp(24px,4vw,42px);border:1px solid rgba(255,255,255,.25);border-radius:22px;background:#111821;color:#fff;box-shadow:0 24px 80px #0009}.tbtv-quit-panel h2{margin:0 0 10px;font-size:clamp(28px,3.4vw,42px)}.tbtv-quit-panel p{margin:0 0 26px;color:#d5dbe2;font-size:clamp(17px,2vw,22px)}.tbtv-quit-actions{display:flex;justify-content:flex-end;gap:12px;flex-wrap:wrap}.tbtv-quit-actions button{min-height:50px;padding:10px 18px;border:1px solid #ffffff55;border-radius:12px;background:#202a35;color:#fff;font:inherit;font-weight:700}.tbtv-quit-actions [data-quit-confirm]{border-color:#e4cd79;background:#e4cd79;color:#111}";
  document.head.append(quitStyle);
  const observe=()=>{if(document.body)new MutationObserver(scheduleFocus).observe(document.body,{childList:true,subtree:true})};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",observe,{once:true});else observe();
})();