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
  const observe=()=>{if(document.body)new MutationObserver(scheduleFocus).observe(document.body,{childList:true,subtree:true})};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",observe,{once:true});else observe();
})();