// Контент из админки: услуги, работы, отзывы. Берётся из /api/content,
// а если хранилище пустое или недоступно — из стартового файла assets/data/content.json.
// Тексты из админки вставляются только через textContent — HTML из них не исполняется.
(function () {
  const { lang, dict } = window.SC;
  const t = (o) => (o && (o[lang] || o.ru || o.en)) || "";
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const ICONS = window.SC_SERVICE_ICONS || {};

  async function load() {
    try {
      const r = await fetch("/api/content", { cache: "no-store" });
      if (r.ok) { const d = await r.json(); if (d && Array.isArray(d.services)) return d; }
    } catch (e) { /* нет сервера с API — берём стартовые данные */ }
    const r = await fetch("assets/data/content.json", { cache: "no-store" });
    return r.json();
  }

  // Ссылки внутри сайта открываем на том же языке, внешние — в новой вкладке
  function linkFor(a, link) {
    if (!link) { a.removeAttribute("href"); return; }
    if (/^https?:\/\//i.test(link)) { a.href = link; a.target = "_blank"; a.rel = "noopener"; return; }
    const u = new URL(link, location.href);
    u.searchParams.set("lang", lang);
    a.href = u.toString();
  }

  // Услуги: компактные карточки с иконкой.
  // Клик по карточке открывает окно заявки с этой услугой в поле «Тип проекта».
  function renderServices(list) {
    const box = document.querySelector(".srv-grid");
    box.textContent = "";
    list.forEach((s, i) => {
      const title = t(s.title);
      const b = el("button", "srv");
      b.type = "button";
      b.setAttribute("aria-label", `${title}. ${dict["nav.cta"]}`);
      const top = el("span", "srv-top");
      const ic = el("span", "srv-ic");
      ic.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${(ICONS[s.icon] || ICONS.landing || { svg: "" }).svg}</svg>`;
      top.append(ic, el("span", "srv-n", String(i + 1).padStart(2, "0")));
      b.append(top, el("h3", null, title), el("p", null, t(s.desc)));
      b.addEventListener("click", () => window.SC.openLead({ type: title }));
      b.addEventListener("pointermove", (e) => { const r = b.getBoundingClientRect(); b.style.setProperty("--mx", e.clientX - r.left + "px"); b.style.setProperty("--my", e.clientY - r.top + "px"); });
      box.append(b);
    });
    // Сводная цифра в шапке раздела — число направлений
    document.querySelectorAll('[data-srv="count"]').forEach((n) => { n.dataset.count = list.length; n.textContent = list.length; });
  }

  // Варианты «Тип проекта» в формах = услуги + «Другое»
  function fillProjectTypes(list) {
    document.querySelectorAll("form.contact-form select[name=type]").forEach((sel) => {
      sel.textContent = "";
      [...list.map((s) => t(s.title)), dict["form.o4"]].forEach((v) => { const o = el("option", null, v); o.value = v; sel.append(o); });
    });
  }

  function renderWorks(list) {
    const track = document.querySelector(".work-track");
    track.textContent = "";
    document.getElementById("work").hidden = !list.length;
    list.forEach((w, i) => {
      const a = el("a", "wcard");
      a.dataset.cursor = "work.view";
      linkFor(a, w.link);
      const media = el("div", "wcard-media");
      if (w.image) {
        media.innerHTML = '<div class="mock-frame"><div class="mock-bar"><i></i><i></i><i></i><b></b></div></div>';
        const img = el("img", "mock-img");
        img.src = w.image; img.alt = w.name; img.loading = "lazy";
        media.firstChild.append(img);
      } else if (w.mock) {
        media.dataset.mock = w.mock;
      }
      const meta = el("div", "wcard-meta");
      meta.append(el("span", "wcard-i", String(i + 1).padStart(2, "0")), el("h3", null, w.name), el("p", null, t(w.type)),
        el("span", "tag", dict[w.kind === "case" ? "work.case" : "work.concept"]));
      a.append(media, meta);
      track.append(a);
    });
    if (window.SC_renderMocks) window.SC_renderMocks(track);
  }

  function renderReviews(list) {
    const sec = document.getElementById("reviews");
    sec.hidden = !list.length;
    const grid = sec.querySelector(".rev-grid");
    grid.textContent = "";
    list.forEach((r) => {
      const card = el("figure", "rev");
      card.append(el("div", "rev-stars", "★".repeat(r.rating) + "☆".repeat(5 - r.rating)), el("blockquote", null, t(r.text)));
      const cap = el("figcaption");
      cap.append(el("b", null, r.author), el("span", null, t(r.role)));
      card.append(cap);
      grid.append(card);
    });
  }

  window.SC_CONTENT = load()
    .then((d) => {
      const vis = (k) => (d[k] || []).filter((x) => x.visible !== false);
      renderServices(vis("services"));
      fillProjectTypes(vis("services"));
      renderWorks(vis("works"));
      renderReviews(vis("reviews"));
    })
    .catch((e) => console.error("content:", e));
})();
