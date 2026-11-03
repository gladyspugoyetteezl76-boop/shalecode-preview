
  (function () {
    const $ = (s) => document.querySelector(s);
    const LANGS = [["ru", "RU"], ["en", "EN"], ["ar", "AR"]];
    const MOCKS = { aurum: "Aurum — ювелирный", nord: "Nordhaus — недвижимость", qalam: "Qalam — онлайн-школа", ombre: "Maison Ombre — ресторан", atlas: "Atlas — клиника" };
    const ICONS = {
      up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
      edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'
    };
    const TABS = {
      works: { label: "Работы", add: "+ Добавить работу", hint: "Карточки в разделе «Что мы можем сделать». Настоящие проекты отмечайте как «Кейс» и добавляйте скриншот.",
        blank: () => ({ name: "Новая работа", kind: "case", type: { ru: "", en: "", ar: "" }, link: "", mock: "", image: "" }) },
      services: { label: "Услуги", add: "+ Добавить услугу", hint: "Список в разделе «Что мы делаем». Если перевод не заполнен, на сайте покажется русский текст.",
        blank: () => ({ title: { ru: "Новая услуга", en: "", ar: "" }, desc: { ru: "", en: "", ar: "" }, icon: "landing" }) },
      reviews: { label: "Отзывы", add: "+ Добавить отзыв", hint: "Раздел «Отзывы» появится на сайте, когда здесь будет хотя бы один видимый отзыв.",
        blank: () => ({ author: "", role: { ru: "", en: "", ar: "" }, text: { ru: "", en: "", ar: "" }, rating: 5 }) }
    };

    TABS.leads = { label: "Заявки", hint: "Контакты видны только после входа. Статус сохраняется сразу; удаление необратимо." };
    let data = null, saved = "", tab = "works", openId = null, canSave = true;
    let csrfToken = null, hasLeads = false, leadPage = 1, leadStatus = "", leadTotal = null, leadRequest = 0;

    // ---------- Сеть ----------
    async function api(path, opt = {}) {
      const headers = new Headers(opt.headers || {});
      if (csrfToken && !["GET", "HEAD"].includes((opt.method || "GET").toUpperCase())) headers.set("X-CSRF-Token", csrfToken);
      const r = await fetch("/api/admin/" + path, { credentials: "same-origin", cache: "no-store", ...opt, headers });
      const d = await r.json().catch(() => ({}));
      if (d.csrf) csrfToken = d.csrf;
      if (typeof d.leads === "boolean") hasLeads = d.leads;
      if (r.status === 401 && path !== "login") { showLogin(); throw new Error("unauthorized"); }
      if (!r.ok || d.ok === false) throw new Error(d.error || "http_" + r.status);
      return d;
    }
    function toast(text, err) {
      const t = $("#toast"); t.textContent = text; t.classList.toggle("err", !!err); t.classList.add("show");
      clearTimeout(toast.tm); toast.tm = setTimeout(() => t.classList.remove("show"), 2600);
    }

    // ---------- Вход ----------
    function showLogin(cfg) {
      csrfToken = null; data = null; saved = ""; leadRequest++;
      $("#list").textContent = "";
      $("#saveBar").classList.remove("show");
      $("#app").hidden = true; $("#login").hidden = false;
      $("#notConfigured").hidden = !(cfg && cfg.configured === false);
      $("#pwd").focus();
    }
    $("#loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      $("#loginErr").hidden = true; $("#loginBtn").disabled = true; $("#loginBtn").textContent = "Проверяем…";
      try {
        await api("login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: $("#pwd").value }) });
        $("#pwd").value = "";
        await start();
      } catch (ex) {
        $("#loginErr").textContent = ex.message === "wrong_password" ? "Неверный пароль." : ex.message === "not_configured" ? "Админка не настроена на сервере." : "Не удалось войти. Попробуйте ещё раз.";
        $("#loginErr").hidden = false;
      } finally { $("#loginBtn").disabled = false; $("#loginBtn").textContent = "Войти"; }
    });
    $("#logout").addEventListener("click", async () => {
      if (dirty() && !confirm("Есть несохранённые изменения. Всё равно выйти?")) return;
      try { await api("logout", { method: "POST" }); showLogin(); }
      catch (ex) { if (ex.message !== "unauthorized") toast("Не удалось выйти. Повторите попытку.", true); }
    });

    async function start() {
      const { content } = await api("content");
      let c = content;
      if (!c) c = await fetch("/assets/data/content.json", { cache: "no-store" }).then((r) => r.json()); // первое открытие — стартовые данные
      data = c; saved = JSON.stringify(c);
      $("#login").hidden = true; $("#app").hidden = false;
      render();
    }

    // ---------- Состояние ----------
    const dirty = () => data && JSON.stringify(data) !== saved;
    function touch() { $("#saveBar").classList.toggle("show", dirty()); $("#saveBtn").disabled = !canSave; }
    const uid = () => Math.random().toString(36).slice(2, 10);
    window.addEventListener("beforeunload", (e) => { if (dirty()) { e.preventDefault(); e.returnValue = ""; } });

    $("#saveBtn").addEventListener("click", async () => {
      $("#saveBtn").disabled = true; $("#saveBtn").textContent = "Сохраняем…";
      try {
        const r = await api("content", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
        data = r.content; saved = JSON.stringify(data);
        render(); toast("Сохранено — изменения уже на сайте");
      } catch (ex) { if (ex.message !== "unauthorized") toast("Не удалось сохранить: " + ex.message, true); }
      finally { $("#saveBtn").textContent = "Сохранить"; touch(); }
    });
    $("#revert").addEventListener("click", () => { if (confirm("Отменить все несохранённые изменения?")) { data = JSON.parse(saved); render(); } });

    // ---------- DOM-помощники (тексты — только через value/textContent) ----------
    function h(tag, props = {}, ...kids) {
      const e = document.createElement(tag);
      for (const [k, v] of Object.entries(props)) {
        if (k === "class") e.className = v;
        else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
        else if (k === "text") e.textContent = v;
        else if (k === "html") e.innerHTML = v; // только для своих SVG-иконок
        else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v);
      }
      kids.flat().forEach((c) => c != null && e.append(c));
      return e;
    }
    const icon = (k) => `<svg viewBox="0 0 24 24">${ICONS[k]}</svg>`;
    const field = (label, control, hint) => h("div", { class: "f" }, h("div", { class: "lbl", text: label }), control, hint ? h("div", { class: "hint", text: hint }) : null);
    function text(obj, key, opts = {}) {
      const el = h(opts.area ? "textarea" : "input", { class: "inp", rows: opts.area ? 3 : null, placeholder: opts.ph || "", maxlength: opts.max || null });
      el.value = obj[key] || "";
      el.addEventListener("input", () => { obj[key] = el.value; touch(); if (opts.onInput) opts.onInput(); });
      return el;
    }
    function langs(obj, key, opts = {}) {
      obj[key] = obj[key] || { ru: "", en: "", ar: "" };
      return h("div", { class: "langs" }, LANGS.map(([l, L]) => {
        const inp = text(obj[key], l, { ...opts, ph: opts.ph && opts.ph[l] });
        if (l === "ar") inp.dir = "rtl";
        return h("div", { class: "lang " + l }, inp, h("span", { text: L }));
      }));
    }
    function seg(options, value, onPick) {
      const box = h("div", { class: "seg" });
      options.forEach(([v, label]) => box.append(h("button", { type: "button", class: v === value ? "on" : "", text: label, onclick: () => onPick(v) })));
      return box;
    }

    // ---------- Отрисовка ----------
    function render() {
      leadRequest++;
      $("#tabs").textContent = "";
      Object.entries(TABS).filter(([k]) => k !== "leads" || hasLeads).forEach(([k, t]) => $("#tabs").append(h("button", { class: k === tab ? "on" : "", onclick: () => { tab = k; openId = null; render(); } }, t.label, h("b", { text: String(k === "leads" ? leadTotal ?? "—" : (data[k] || []).length) }))));
      $("#tabHint").textContent = TABS[tab].hint;
      $("#addBtn").hidden = tab === "leads";
      if (tab === "leads") { renderLeads(); touch(); return; }
      $("#addBtn").textContent = TABS[tab].add;
      const list = $("#list");
      list.textContent = "";
      const items = data[tab] = data[tab] || [];
      if (!items.length) list.append(h("div", { class: "empty", text: "Пока пусто. Нажмите «" + TABS[tab].add.replace("+ ", "") + "»." }));
      items.forEach((it, i) => list.append(itemView(it, i, items)));
      touch();
    }

    async function renderLeads() {
      const generation = leadRequest;
      const list = $("#list");
      list.textContent = "";
      const statuses = [["", "Все"], ["new", "Новые"], ["active", "В работе"], ["closed", "Закрытые"]];
      list.append(seg(statuses, leadStatus, (value) => { leadStatus = value; leadPage = 1; render(); }));
      list.append(h("button", { class: "btn", text: "Обновить", onclick: () => render() }));
      const box = h("div", { class: "list", text: "Загружаем заявки…" }); list.append(box);
      try {
        const result = await api(`leads?page=${leadPage}&status=${encodeURIComponent(leadStatus)}`);
        if (tab !== "leads" || generation !== leadRequest) return;
        if (leadPage > Math.max(1, result.pages)) { leadPage = Math.max(1, result.pages); render(); return; }
        leadTotal = result.total;
        const count = $("#tabs button.on b"); if (count) count.textContent = result.total;
        box.textContent = "";
        if (!result.leads.length) box.append(h("div", { class: "empty", text: "Заявок пока нет." }));
        const date = (value) => new Date(value.replace(" ", "T") + "Z").toLocaleString("ru-RU");
        result.leads.forEach((lead) => {
          const fields = h("div", { class: "body lead-body" },
            h("p", { text: "Получена: " + date(lead.created_at) }),
            lead.phone ? h("p", {}, "Телефон: ", h("a", { href: "tel:" + lead.phone.replace(/[^\d+]/g, ""), text: lead.phone })) : null,
            lead.telegram && /^[A-Za-z0-9_]{5,32}$/.test(lead.telegram) ? h("p", {}, "Telegram: ", h("a", { href: "https://t.me/" + lead.telegram, target: "_blank", rel: "noopener noreferrer", text: "@" + lead.telegram })) : null,
            h("p", { text: "Тип проекта: " + (lead.type || "—") }),
            h("p", { class: "lead-message", text: lead.msg || "Без описания" }));
          const select = h("select", { class: "inp", "aria-label": "Статус заявки" }, statuses.slice(1).map(([value, label]) => h("option", { value, text: label })));
          select.value = lead.status;
          select.addEventListener("change", async () => {
            select.disabled = true;
            try { await api("leads/" + lead.id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: select.value }) }); render(); toast("Статус сохранён"); }
            catch (ex) { select.value = lead.status; if (ex.message !== "unauthorized") toast("Не удалось изменить статус", true); }
            finally { select.disabled = false; }
          });
          fields.append(field("Статус", select), h("button", { class: "btn btn-d", text: "Удалить заявку", onclick: async (event) => {
            if (!confirm("Удалить заявку и контакты клиента? Восстановление через админку невозможно.")) return;
            const button = event.currentTarget; button.disabled = true;
            try { await api("leads/" + lead.id, { method: "DELETE" }); render(); toast("Заявка удалена"); }
            catch (ex) { if (ex.message !== "unauthorized") toast("Не удалось удалить заявку", true); button.disabled = false; }
          } }));
          box.append(h("article", { class: "item" }, h("div", { class: "head" }, h("b", { text: lead.name })), fields));
        });
        box.append(h("div", { class: "lead-pages" },
          h("button", { class: "btn", text: "← Назад", disabled: leadPage <= 1, onclick: () => { leadPage--; render(); } }),
          h("span", { text: `Страница ${leadPage} из ${Math.max(1, result.pages)} · Всего: ${result.total}` }),
          h("button", { class: "btn", text: "Далее →", disabled: leadPage >= result.pages, onclick: () => { leadPage++; render(); } })));
      } catch (ex) { if (generation === leadRequest && ex.message !== "unauthorized") box.textContent = "Не удалось загрузить заявки. Нажмите «Обновить»."; }
    }

    function summary(it) {
      if (tab === "works") return [it.name || "Без названия", (it.type && it.type.ru) || "—"];
      if (tab === "services") return [(it.title && it.title.ru) || "Без названия", (it.desc && it.desc.ru) || "—"];
      return [it.author || "Без имени", (it.text && it.text.ru) || "—"];
    }

    function itemView(it, i, items) {
      if (!it.id) it.id = uid();
      const open = openId === it.id;
      const [title, sub] = summary(it);
      const ttlB = h("b", { text: title }), ttlS = h("small", { text: sub });
      const refreshTitle = () => { const [a, b] = summary(it); ttlB.textContent = a; ttlS.textContent = b; };
      const vis = h("button", { class: "switch" + (it.visible !== false ? " on" : ""), title: "Показывать на сайте", "aria-label": "Показывать на сайте", onclick: () => { it.visible = it.visible === false; render(); } });
      const move = (d) => { const j = i + d; if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; render(); };
      const head = h("div", { class: "head" },
        h("span", { class: "num", text: String(i + 1).padStart(2, "0") }),
        h("div", { class: "ttl", onclick: () => { openId = open ? null : it.id; render(); } }, ttlB, ttlS),
        tab === "works" ? h("span", { class: "badge" + (it.kind === "case" ? " case" : ""), text: it.kind === "case" ? "Кейс" : "Концепт" }) : null,
        tab === "reviews" ? h("span", { class: "badge", text: "★ " + (it.rating || 5) }) : null,
        h("div", { class: "tools" },
          vis,
          h("button", { class: "btn ico", title: "Выше", html: icon("up"), disabled: i === 0, onclick: () => move(-1) }),
          h("button", { class: "btn ico", title: "Ниже", html: icon("down"), disabled: i === items.length - 1, onclick: () => move(1) }),
          h("button", { class: "btn ico", title: "Редактировать", html: icon("edit"), onclick: () => { openId = open ? null : it.id; render(); } }),
          h("button", { class: "btn ico btn-d", title: "Удалить", html: icon("trash"), onclick: () => { if (confirm("Удалить «" + title + "»?")) { items.splice(i, 1); render(); } } })));
      const card = h("div", { class: "item" + (open ? " open" : "") + (it.visible === false ? " off" : "") }, head);
      if (open) card.append(h("div", { class: "body" }, editor(it, refreshTitle)));
      return card;
    }

    function editor(it, refresh) {
      if (tab === "services") {
        // Иконка: сетка с превью
        const icons = h("div", { class: "icons" }, Object.entries(window.SC_SERVICE_ICONS || {}).map(([k, v]) =>
          h("button", { type: "button", class: (it.icon || "landing") === k ? "on" : "", title: v.label, "aria-label": v.label,
            html: `<svg viewBox="0 0 24 24">${v.svg}</svg>`, onclick: () => { it.icon = k; render(); } })));
        return [
          field("Название", langs(it, "title", { max: 80, onInput: refresh })),
          field("Описание", langs(it, "desc", { area: true, max: 400, onInput: refresh }), "На карточке видны первые три строки — пишите коротко."),
          field("Иконка", icons)
        ];
      }
      if (tab === "reviews") {
        const stars = h("div", { class: "stars" });
        for (let n = 1; n <= 5; n++) stars.append(h("button", { type: "button", class: n <= (it.rating || 5) ? "on" : "", text: "★", onclick: () => { it.rating = n; render(); } }));
        return [
          h("div", { class: "row2" }, field("Автор", text(it, "author", { max: 80, ph: "Имя Фамилия", onInput: refresh })), field("Оценка", stars)),
          field("Должность / компания", langs(it, "role", { max: 120, ph: { ru: "Основатель, Aurum", en: "Founder, Aurum", ar: "" } })),
          field("Текст отзыва", langs(it, "text", { area: true, max: 1200, onInput: refresh }), "Публикуйте только настоящие отзывы — с согласия клиента.")
        ];
      }
      // Работы
      const coverMode = it.image ? "image" : it.mock ? "mock" : "none";
      const cover = h("div", { class: "cover" });
      if (coverMode === "mock") {
        const sel = h("select", { class: "inp", style: "max-width:320px" }, Object.entries(MOCKS).map(([v, l]) => h("option", { value: v, text: l })));
        sel.value = it.mock; sel.addEventListener("change", () => { it.mock = sel.value; touch(); });
        cover.append(sel);
      } else if (coverMode === "image") {
        cover.append(h("img", { src: it.image, alt: "" }), uploadBtn(it, "Заменить"), h("button", { type: "button", class: "btn btn-d", text: "Убрать", onclick: () => { it.image = ""; render(); } }));
      }
      return [
        h("div", { class: "row2" },
          field("Название проекта", text(it, "name", { max: 60, onInput: refresh })),
          field("Тип", seg([["case", "Кейс (реальный проект)"], ["concept", "Концепт"]], it.kind, (v) => { it.kind = v; render(); }))),
        field("Описание под названием", langs(it, "type", { max: 120, onInput: refresh, ph: { ru: "Ресторан · Сайт-визитка", en: "Restaurant · Showcase site", ar: "" } })),
        field("Ссылка", text(it, "link", { max: 500, ph: "https://site-klienta.ru" }), "Адрес готового сайта клиента. Можно оставить пустым — тогда карточка не будет кликабельной."),
        field("Обложка", h("div", { style: "display:grid;gap:12px" },
          seg([["image", "Скриншот"], ["mock", "Мини-макет"], ["none", "Без обложки"]], coverMode, (v) => {
            if (v === "mock") { it.image = ""; it.mock = it.mock || "aurum"; }
            if (v === "none") { it.image = ""; it.mock = ""; }
            if (v === "image" && !it.image) { it.mock = ""; pickImage(it); return; }
            render();
          }),
          coverMode === "image" || coverMode === "mock" ? cover : (it.mock = "", h("div", { class: "hint", text: "Карточка покажет пустую рамку браузера." }))),
          "Скриншот лучше делать по ширине 1440px. Перед загрузкой он автоматически ужмётся до 1600px."
        )
      ];
    }

    // ---------- Загрузка картинок ----------
    function uploadBtn(it, label) { return h("button", { type: "button", class: "btn", text: label, onclick: () => pickImage(it) }); }
    function pickImage(it) {
      const inp = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp" });
      inp.addEventListener("change", async () => {
        const file = inp.files[0]; if (!file) return;
        try {
          toast("Загружаем картинку…");
          const blob = await shrink(file);
          const r = await api("media", { method: "POST", headers: { "content-type": blob.type }, body: blob });
          it.image = r.url; it.mock = ""; render(); toast("Картинка загружена — не забудьте сохранить");
        } catch (ex) { if (ex.message !== "unauthorized") toast("Не удалось загрузить картинку: " + ex.message, true); }
      });
      inp.click();
    }
    async function shrink(file) {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 1600 / bmp.width);
      const c = h("canvas", { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      const toBlob = (type, q) => new Promise((res) => c.toBlob(res, type, q));
      const webp = await toBlob("image/webp", .85);
      return webp && webp.type === "image/webp" ? webp : toBlob("image/jpeg", .85);
    }

    $("#addBtn").addEventListener("click", () => {
      const it = { id: uid(), visible: true, ...TABS[tab].blank() };
      data[tab].push(it); openId = it.id; render();
      document.querySelector(".item.open").scrollIntoView({ behavior: "smooth", block: "center" });
    });

    // ---------- Старт ----------
    fetch("/api/admin/session", { cache: "no-store" }).then((r) => r.json()).then((s) => {
      csrfToken = s.csrf || null; hasLeads = s.leads === true;
      canSave = s.storage !== false;
      $("#noStorage").hidden = canSave;
      if (s.ok) start().catch(() => showLogin(s)); else showLogin(s);
    }).catch(() => showLogin());
  })();
