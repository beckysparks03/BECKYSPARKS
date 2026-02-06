const lerp = (a, b, t) => a + (b - a) * t;

document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // OPTIONAL DRAWERS (index page)
  // =========================
  const playToggle = document.getElementById("play-toggle");
  const playDrawer = document.getElementById("play-drawer");
  const playClose  = document.getElementById("play-close");

  const aboutToggle = document.getElementById("about-toggle");
  const aboutDrawer = document.getElementById("about-drawer");
  const aboutClose  = document.getElementById("about-close");

  const isPlayOpen  = () => document.body.classList.contains("play-open");
  const isAboutOpen = () => document.body.classList.contains("about-open");

  function closePlay(){
    document.body.classList.remove("play-open");
    playDrawer?.setAttribute("aria-hidden", "true");
  }
  function openPlay(){
    closeAbout();
    closeInfo();
    document.body.classList.add("play-open");
    playDrawer?.setAttribute("aria-hidden", "false");
  }

  function closeAbout(){
    document.body.classList.remove("about-open");
    aboutDrawer?.setAttribute("aria-hidden", "true");
  }
  function openAbout(){
    closePlay();
    closeInfo();
    document.body.classList.add("about-open");
    aboutDrawer?.setAttribute("aria-hidden", "false");
  }

  playToggle?.addEventListener("click", (e) => {
    e.preventDefault();
    isPlayOpen() ? closePlay() : openPlay();
  });
  playClose?.addEventListener("click", (e) => {
    e.preventDefault();
    closePlay();
  });
  playDrawer?.addEventListener("click", (e) => {
    const inner = playDrawer.querySelector(".drawer-inner");
    if (inner && !inner.contains(e.target)) closePlay();
  });

  aboutToggle?.addEventListener("click", (e) => {
    e.preventDefault();
    isAboutOpen() ? closeAbout() : openAbout();
  });
  aboutClose?.addEventListener("click", (e) => {
    e.preventDefault();
    closeAbout();
  });
  aboutDrawer?.addEventListener("click", (e) => {
    const inner = aboutDrawer.querySelector(".drawer-inner");
    if (inner && !inner.contains(e.target)) closeAbout();
  });

  // open by hash
  if (aboutDrawer && location.hash === "#about") openAbout();

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closePlay();
      closeAbout();
      closeInfo();
    }
  });

  // =========================
  // DOM refs
  // =========================
  const columnsEl = document.getElementById("columns") || document.querySelector(".columns");
  const cols = Array.from(document.querySelectorAll(".col"));
  const poolCards = Array.from(document.querySelectorAll("#media-pool .card"));

  const infoCol = document.querySelector(".info-col");
  const infoContent = document.querySelector(".info-content");
  const infoCloseBtn = document.querySelector(".info-close");

  if (!columnsEl) return console.error("Missing #columns (or .columns).");
  if (!cols.length) return console.error("No .col elements found.");
  if (!poolCards.length) return console.error("No cards in #media-pool.");

  const inners = cols.map((col, i) => {
    const inner = col.querySelector(".inner");
    if (!inner) console.error(`Column ${i + 1} missing .inner`);
    return inner;
  });
  if (inners.some(x => !x)) return;

  // =========================
  // Randomize + distribute
  // =========================
  const shuffled = shuffle([...poolCards]);
  inners.forEach(inner => (inner.innerHTML = ""));

  shuffled.forEach((card, i) => {
    const clone = card.cloneNode(true);
    clone.dataset.key ||= makeKey();
    inners[i % inners.length].appendChild(clone);
  });

  startAllVideos();

  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  if (isMobile) {
    // On mobile, use simple horizontally scrolling rows via CSS only,
    // so skip the advanced column hover/animation logic below.
    return;
  }

  // =========================
  // Column states
  // =========================
  const states = cols.map((col, i) => ({
    col,
    inner: inners[i],
    blurLayer: col.querySelector(".blur-layer"),
    index: i,
    hovered: false,
    offset: 0,
    vRaw: 0,
    vVisual: 0,
    skewValue: 0,
    blurValue: 0,
    gap: getGap(inners[i]),
    speedMult: 0.35 + Math.random() * 0.6
  }));

  // =========================
  // INFO state
  // =========================
  let infoOpen = false;
  let activeState = null;
  let activeKey = null;
  let railShift = 0;
  let closeTimer = null;

  moveInfoToEnd();

  // =========================
  // Feel tuning
  // =========================
  const WHEEL_CLAMP = 220;
  const ACTIVE_MULT = 0.85;
  const OTHER_MULT  = 0.45;

  const FRICTION = 0.88;
  const V_SMOOTH = 0.12;

  const SKEW_SCALE = 0.85;
  const SKEW_MAX = 6;
  const SKEW_SMOOTH = 0.09;

  const BLUR_DIM_HOVER = 24;
  const BLUR_DIM_INFO  = 28;
  const BLUR_SMOOTH = 0.12;

  const IDLE_AFTER_MS = 700;
  const IDLE_PUSH = 0.08;

  let lastWheelAt = performance.now();

  // =========================
  // Hover tracking
  // =========================
  cols.forEach((col, i) => {
    col.addEventListener("mouseenter", () => {
      states[i].hovered = true;
      if (infoOpen && activeState && col !== activeState.col) closeInfo();
    });
    col.addEventListener("mouseleave", () => {
      states[i].hovered = false;
    });
  });

  columnsEl.addEventListener("mouseleave", () => {
    if (infoOpen) closeInfo();
  });

  // =========================
  // Wheel
  // =========================
  window.addEventListener("wheel", (e) => {
    // if drawers open (index), don't scroll behind them
    if (isPlayOpen() || isAboutOpen()) return;

    // if wheel is over info column, its listener handles it
    if (infoOpen && infoCol && infoCol.contains(e.target)) return;

    const active = states.find(s => s.hovered);
    if (!active) return;

    e.preventDefault();
    pushScroll(active, e.deltaY, true);
  }, { passive: false });

  if (infoCol) {
    infoCol.addEventListener("wheel", (e) => {
      if (!infoOpen || !activeState) return;
      e.preventDefault();
      pushScroll(activeState, e.deltaY, true);
    }, { passive: false });
  }

  function pushScroll(active, deltaY, othersOpposite = true) {
    lastWheelAt = performance.now();
    const delta = clamp(deltaY, -WHEEL_CLAMP, WHEEL_CLAMP);

    active.vRaw += delta * ACTIVE_MULT;

    if (othersOpposite) {
      for (const s of states) {
        if (s === active) continue;
        s.vRaw -= delta * OTHER_MULT;
      }
    }
  }

  // =========================
  // Card click => open info
  // =========================
  document.querySelectorAll(".col .card").forEach(card => {
    card.dataset.key ||= makeKey();

    card.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closePlay();
      closeAbout();

      const hostCol = card.closest(".col");
      const state = states.find(s => s.col === hostCol);
      if (!state) return;

      openInfo(state, card.dataset.key);
    });

    const vid = card.querySelector("video");
    if (vid) {
      vid.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closePlay();
        closeAbout();

        const hostCol = card.closest(".col");
        const state = states.find(s => s.col === hostCol);
        if (!state) return;

        openInfo(state, card.dataset.key);
      });
    }
  });

  infoCloseBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeInfo();
  });

  document.addEventListener("click", (e) => {
    if (!infoOpen || !activeState) return;
    const clickedInsideInfo = infoCol && infoCol.contains(e.target);
    const clickedInsideActive = activeState.col.contains(e.target);
    if (!clickedInsideInfo && !clickedInsideActive) closeInfo();
  });

  // =========================
  // Info open/close
  // =========================
  function openInfo(state, key) {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }

    infoOpen = true;
    activeState = state;
    activeKey = key;

    buildInfoRail(state);
    insertInfoAfter(state.col);

    railShift = 0;
    alignClickedLabel(state, key);

    columnsEl.classList.add("info-open");
    infoCol?.setAttribute("aria-hidden", "false");
  }

  function closeInfo() {
    if (!infoOpen) return;

    columnsEl.classList.remove("info-open");

    closeTimer = window.setTimeout(() => {
      infoOpen = false;
      activeState = null;
      activeKey = null;
      railShift = 0;

      moveInfoToEnd();
      if (infoContent) infoContent.innerHTML = "";
      infoCol?.setAttribute("aria-hidden", "true");

      closeTimer = null;
    }, 420);
  }

  function buildInfoRail(state) {
    if (!infoContent) return;

    const cards = Array.from(state.inner.children);
    infoContent.innerHTML = `
      <div class="info-rail" id="info-rail">
        ${cards.map(card => {
          const key = card.dataset.key || "";
          const title = card.dataset.title || "";
          const desc = card.dataset.desc || "";
          const line = [title, desc].filter(Boolean).join(" — ");
          return `<div class="info-item" data-key="${escapeHTML(key)}">${escapeHTML(line || "Untitled")}</div>`;
        }).join("")}
      </div>
    `;
  }

  function alignClickedLabel(state, key) {
    let y = 0;
    state.inner.querySelectorAll(".card").forEach(card => {
      if (card.dataset.key === key) railShift = state.offset - y;
      y += outerHeight(card) + state.gap;
    });
  }

  // =========================
  // Animation
  // =========================
  function animate() {
    const now = performance.now();
    const hoveredAny = states.some(s => s.hovered);
    const idle = (now - lastWheelAt) > IDLE_AFTER_MS;

    const drawersOpen = isPlayOpen() || isAboutOpen();

    for (const s of states) {
      if (!hoveredAny && idle && !infoOpen && !drawersOpen) {
        s.vRaw += (s.index % 2 ? -1 : 1) * IDLE_PUSH;
      }

      s.vRaw *= FRICTION;
      s.vVisual = lerp(s.vVisual, s.vRaw, V_SMOOTH);

      s.offset += s.vVisual * s.speedMult;

      conveyorWrap(s);

      const targetSkew = clamp(s.vVisual * SKEW_SCALE, -SKEW_MAX, SKEW_MAX);
      s.skewValue = lerp(s.skewValue, targetSkew, SKEW_SMOOTH);

      s.inner.style.transform =
        `translate3d(0, ${-s.offset}px, 0) skewY(${s.skewValue}deg)`;

      let targetBlur = 0;
      if (infoOpen) targetBlur = (s === activeState) ? 0 : BLUR_DIM_INFO;
      else if (hoveredAny) targetBlur = s.hovered ? 0 : BLUR_DIM_HOVER;

      s.blurValue = lerp(s.blurValue, targetBlur, BLUR_SMOOTH);
      s.blurLayer && (s.blurLayer.style.filter = `blur(${s.blurValue}px)`);
    }

    if (infoOpen && activeState) updateInfoRail(activeState);

    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  function updateInfoRail(state) {
    const rail = infoContent?.querySelector("#info-rail");
    if (!rail) return;

    rail.style.transform = `skewY(${state.skewValue}deg)`;

    let y = 0;
    state.inner.querySelectorAll(".card").forEach(card => {
      const key = card.dataset.key;
      const item = rail.querySelector(`[data-key="${CSS.escape(key)}"]`);
      if (!item) return;

      const top = (y - state.offset) + railShift;
      item.style.transform = `translateY(${top}px)`;
      item.classList.toggle("is-active", key === activeKey);

      y += outerHeight(card) + state.gap;
    });
  }

  // =========================
  // Conveyor wrap
  // =========================
  function conveyorWrap(s) {
    let guard = 0;

    while (s.offset > 0 && guard++ < 200) {
      const first = s.inner.firstElementChild;
      if (!first) break;

      const step = outerHeight(first) + s.gap;
      if (s.offset < step) break;

      s.offset -= step;
      s.inner.appendChild(first);

      if (infoOpen && activeState === s) buildInfoRail(s);
    }

    guard = 0;
    while (s.offset < 0 && guard++ < 200) {
      const last = s.inner.lastElementChild;
      if (!last) break;

      const step = outerHeight(last) + s.gap;
      s.offset += step;
      s.inner.insertBefore(last, s.inner.firstElementChild);

      if (infoOpen && activeState === s) buildInfoRail(s);
    }
  }

  // =========================
  // Helpers
  // =========================
  function moveInfoToEnd() {
    if (infoCol) columnsEl.appendChild(infoCol);
  }

  function insertInfoAfter(hostCol) {
    if (!infoCol) return;
    columnsEl.insertBefore(infoCol, hostCol.nextSibling);
  }

  function getGap(el) {
    const cs = getComputedStyle(el);
    return parseFloat(cs.rowGap || cs.gap || "0") || 0;
  }

  function outerHeight(el) {
    return el.getBoundingClientRect().height;
  }

  function startAllVideos() {
    document.querySelectorAll("video").forEach(v => {
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    });
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function makeKey() {
    return "k_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m]));
  }
});

