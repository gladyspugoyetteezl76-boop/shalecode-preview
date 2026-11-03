// Вариант A «Graphite»: WebGL-пласты в hero, горизонтальная витрина, анимации по скроллу.
(function () {
  const { reduced, rtl, lenis, splitWords, fontsReady } = window.SC;
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  const dir = rtl ? -1 : 1;

  // ---------- WebGL: слои сланца, реагирующие на курсор ----------
  const gl$ = { intro: 0, scroll: 0 };
  function initGL(canvas) {
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
    if (!gl) { canvas.classList.add("no-gl"); return; }
    const vs = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
    const fs = `
      precision highp float;
      uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uIntro; uniform float uScroll;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}
      float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
      void main(){
        vec2 uv=gl_FragCoord.xy/uRes;
        float asp=uRes.x/uRes.y;
        vec2 p=vec2(uv.x*asp,uv.y);
        vec2 m=vec2(uMouse.x*asp,uMouse.y);
        float t=uTime*.035;
        float md=distance(p,m);
        float bulge=exp(-md*md*7.)*.13;
        float tilt=(p.x-asp*.5)*-.24;
        float warp=fbm(p*vec2(1.1,2.1)+vec2(t,-t*.6))*.6+fbm(p*3.2+t*1.4)*.07;
        float y=p.y+tilt+warp+bulge+uScroll*.35;
        float bands=y*13.;
        float id=floor(bands);
        float f=fract(bands);
        float e=min(f,1.-f);
        float line=1.-smoothstep(0.,.045,e);
        float glow=(1.-smoothstep(0.,.35,e))*.18;
        float shade=.025+hash(vec2(id,3.))*.045+fbm(vec2(p.x*7.,id*1.3))*.035;
        vec3 base=vec3(.037,.045,.058)+vec3(shade*.9,shade,shade*1.15);
        vec3 accent=vec3(.56,.70,1.);
        float near=exp(-md*md*3.2);
        vec3 lc=mix(vec3(.30,.35,.43),accent,clamp(near*1.4,0.,1.));
        float lw=.25+.75*hash(vec2(id,7.));
        float sweep=.5+.5*sin(p.x*1.8-uTime*.55+id*1.7);
        vec3 col=base+lc*(line+glow)*lw*(.3+.7*sweep)*.75;
        col+=accent*near*.05;
        float vig=1.-smoothstep(.25,1.35,length((uv-vec2(.55,.5))*vec2(1.25,1.)));
        col*=mix(.35,1.,vig);
        // появление снизу вверх
        float reveal=smoothstep(uv.y-.25,uv.y,uIntro*1.3-.05);
        col=mix(vec3(.039,.047,.059),col,reveal);
        col+=(hash(gl_FragCoord.xy+fract(uTime*7.))-.5)*.022;
        gl_FragColor=vec4(col,1.);
      }`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(prog, n);
    const uRes = U("uRes"), uTime = U("uTime"), uMouse = U("uMouse"), uIntro = U("uIntro"), uScroll = U("uScroll");

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener("resize", resize);

    const mouse = { x: .62, y: .55, tx: .62, ty: .55 };
    window.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.tx = (e.clientX - r.left) / r.width;
      mouse.ty = 1 - (e.clientY - r.top) / r.height;
    });

    let visible = true;
    new IntersectionObserver(([en]) => (visible = en.isIntersecting)).observe(canvas);
    const t0 = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);
      if (!visible) return;
      mouse.x += (mouse.tx - mouse.x) * .06;
      mouse.y += (mouse.ty - mouse.y) * .06;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, reduced ? 10 : (now - t0) / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uIntro, gl$.intro);
      gl.uniform1f(uScroll, gl$.scroll);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    requestAnimationFrame(frame);
  }

  function heroIn() {
    const tl = gsap.timeline();
    const words = document.querySelectorAll(".hero-title .wi");
    tl.to(gl$, { intro: 1, duration: 2.4, ease: "power2.out" }, 0)
      .from(words, { yPercent: 110, rotate: 4 * dir, duration: 1.3, stagger: .06, ease: "expo.out" }, .1)
      .from(".hero-eyebrow", { y: 20, opacity: 0, duration: 1, ease: "power3.out" }, .2)
      .from(".hero-sub, .hero-ctas .btn", { y: 30, opacity: 0, duration: 1.1, stagger: .08, ease: "power3.out" }, .6)
      .from(".nav > *", { y: -30, opacity: 0, duration: 1, stagger: .08, ease: "power3.out" }, .4)
      .from(".scroll-ind", { opacity: 0, duration: 1 }, 1);
    return tl;
  }

  // ---------- Скролл-анимации ----------
  function scrollAnims() {
    // Hero уходит со сдвигом
    gsap.to(".hero-inner", { yPercent: -18, opacity: .2, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    ScrollTrigger.create({ trigger: ".hero", start: "top top", end: "bottom top", scrub: true, onUpdate: (s) => (gl$.scroll = s.progress) });


    // Бегущая строка, ускоряется от скорости скролла
    const track = document.querySelector(".marquee-track");
    const group = track.querySelector(".marquee-group");
    let x = 0, speed = 1, w = group.offsetWidth;
    window.addEventListener("resize", () => (w = group.offsetWidth));
    gsap.ticker.add(() => {
      const v = lenis ? lenis.velocity : 0;
      speed += ((1 + Math.abs(v) * .25) * (v < 0 ? -1 : 1) - speed) * .08;
      x -= speed * .9;
      if (x <= -w) x += w;
      if (x > 0) x -= w;
      track.style.transform = `translate3d(${x}px,0,0)`;
    });

    // Заголовки секций
    document.querySelectorAll(".sec-title, .contact-title").forEach((el) => {
      gsap.from(el.querySelectorAll(".wi"), { yPercent: 110, duration: 1.2, stagger: .05, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 85%" } });
    });
    gsap.utils.toArray(".label").forEach((el) => {
      gsap.from(el, { opacity: 0, x: -20 * dir, duration: 1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%" } });
    });

    // Манифест: слова «загораются» по мере скролла
    const aw = document.querySelectorAll(".about-text .wi");
    gsap.to(aw, { opacity: 1, stagger: .1, ease: "none", scrollTrigger: { trigger: ".about-text", start: "top 75%", end: "bottom 45%", scrub: true } });

    // Услуги: карточки волной, иконки прорисовываются линией
    const srvST = { trigger: ".srv-grid", start: "top 82%" };
    gsap.from(".srv", { y: 50, opacity: 0, duration: 1.1, stagger: { each: .06, grid: "auto", from: "start" }, ease: "expo.out", clearProps: "transform,opacity", scrollTrigger: srvST });
    document.querySelectorAll(".srv-ic svg > *").forEach((p) => {
      const len = p.getTotalLength ? p.getTotalLength() : 0;
      if (len) gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.6, ease: "power2.inOut", delay: .3, scrollTrigger: srvST });
    });
    document.querySelectorAll(".srv-stat [data-count]").forEach((n) => {
      const o = { v: 0 };
      gsap.to(o, { v: +n.dataset.count, duration: 1.6, ease: "power2.out", scrollTrigger: { trigger: ".srv-stats", start: "top 88%" }, onUpdate: () => (n.textContent = Math.round(o.v)) });
    });
    gsap.from(".srv-stat", { y: 30, opacity: 0, duration: 1, stagger: .1, ease: "power3.out", scrollTrigger: { trigger: ".srv-stats", start: "top 88%" } });

    // Отзывы
    if (document.querySelector(".rev")) gsap.from(".rev", { y: 60, opacity: 0, duration: 1.1, stagger: .08, ease: "expo.out", scrollTrigger: { trigger: ".rev-grid", start: "top 85%" } });

    // Процесс: линия заполняется, шаги включаются
    gsap.to(".steps-line i", { scaleY: 1, ease: "none", scrollTrigger: { trigger: ".steps", start: "top 60%", end: "bottom 60%", scrub: true } });
    gsap.utils.toArray(".step").forEach((el) => {
      ScrollTrigger.create({ trigger: el, start: "top 60%", onToggle: (s) => el.classList.toggle("is-on", s.isActive || s.progress > 0), end: "max" });
      gsap.from(el.querySelectorAll("h3, p"), { y: 30, opacity: 0, duration: 1, stagger: .08, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 80%" } });
    });

    // Почему мы
    gsap.from(".vcard", { y: 60, opacity: 0, duration: 1.1, stagger: .1, ease: "expo.out", scrollTrigger: { trigger: ".why-grid", start: "top 85%" } });
    document.querySelectorAll(".vcard").forEach((c) => {
      c.addEventListener("pointermove", (e) => {
        const r = c.getBoundingClientRect();
        c.style.setProperty("--mx", e.clientX - r.left + "px");
        c.style.setProperty("--my", e.clientY - r.top + "px");
      });
    });

    // Контакты
    gsap.from("#contact .contact-sub, #contact .contact-links > *, #contact .contact-form", { y: 40, opacity: 0, duration: 1.1, stagger: .1, ease: "power3.out", scrollTrigger: { trigger: ".contact", start: "top 75%" } });

    // Футер: буквы поднимаются
    const fw = document.querySelector(".footer-word");
    fw.innerHTML = [...fw.textContent].map((ch) => `<span class="ch">${ch}</span>`).join("");
    gsap.from(".footer-word .ch", { yPercent: 100, opacity: 0, duration: 1.4, stagger: .04, ease: "expo.out", scrollTrigger: { trigger: ".footer", start: "top 90%" } });

    // Витрина: появление карусели и элементов управления
    gsap.from(".work-viewport", { y: 80, opacity: 0, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: ".work-viewport", start: "top 85%" } });
    gsap.from(".car-ctrl > *, .car-dots", { y: 24, opacity: 0, duration: 1, stagger: .08, ease: "power3.out", scrollTrigger: { trigger: ".work-head", start: "top 80%" } });

    // Наклон карточек за курсором
    if (!window.SC.isTouch) {
      document.querySelectorAll(".wcard-media").forEach((m) => {
        m.addEventListener("pointermove", (e) => {
          const r = m.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
          gsap.to(m, { rotateY: px * 8, rotateX: -py * 8, duration: .8, ease: "power3.out" });
        });
        m.addEventListener("pointerleave", () => gsap.to(m, { rotateY: 0, rotateX: 0, duration: 1.2, ease: "elastic.out(1,.4)" }));
      });
    }
  }

  // ---------- Верхняя панель ----------
  // Работает всегда, в том числе при «уменьшить движение»: после первого экрана панель получает
  // плотную подложку, при прокрутке вниз прячется, при прокрутке вверх возвращается.
  function initNav() {
    const nav = document.querySelector(".nav");
    let lastY = window.scrollY;
    const update = () => {
      const y = window.scrollY;
      nav.classList.toggle("is-scrolled", y > 40);
      const busy = document.body.classList.contains("menu-open") || document.documentElement.classList.contains("modal-open");
      if (y > 400 && y > lastY + 4 && !busy) nav.classList.add("is-hidden");
      else if (y < lastY - 4 || y <= 400) nav.classList.remove("is-hidden");
      lastY = y;
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  // ---------- Карусель работ: автопрокрутка, стрелки, полоски, свайп ----------
  const SLIDE_SECONDS = 5;
  function initCarousel() {
    const sec = document.getElementById("work");
    const vp = sec.querySelector(".work-viewport"), track = sec.querySelector(".work-track");
    const cards = [...track.children];
    const n = cards.length;
    if (!n) return;
    const { dict } = window.SC;
    const cur = sec.querySelector(".car-cur b"), ring = sec.querySelector(".car-ring"), live = sec.querySelector(".car-live");
    const dotsBox = sec.querySelector(".car-dots");
    const pad2 = (v) => String(v).padStart(2, "0");
    const slideLabel = (i) => dict["work.slide"].replace("{n}", i + 1).replace("{t}", n);
    sec.style.setProperty("--dur", SLIDE_SECONDS + "s");
    sec.querySelector(".car-total").textContent = pad2(n);
    sec.querySelector(".car-ctrl").hidden = n < 2;
    dotsBox.hidden = n < 2;

    dotsBox.textContent = "";
    const dots = cards.map((c, i) => {
      c.setAttribute("aria-roledescription", "slide");
      c.setAttribute("aria-label", slideLabel(i));
      const d = document.createElement("button");
      d.className = "car-dot"; d.setAttribute("role", "tab"); d.setAttribute("aria-label", slideLabel(i));
      d.append(document.createElement("i"));
      d.addEventListener("click", () => go(i, true));
      // Полоска заполнилась — пора следующий слайд
      d.firstChild.addEventListener("animationend", () => { if (d.classList.contains("is-active")) go(idx + 1); });
      dotsBox.append(d);
      return d;
    });

    let idx = 0, x = 0;
    // Автопрокрутка работает и при «уменьшить движение» — тогда слайды меняются без анимации сдвига
    const autoplay = n > 1;
    if (autoplay) sec.classList.add("is-playing");
    // Автопрокрутка стоит на паузе, пока есть хоть одна причина: курсор над карточками, фокус, раздел не на экране, открыто окно и т. п.
    const pauses = new Set();
    const pause = (why, on) => { on ? pauses.add(why) : pauses.delete(why); sec.classList.toggle("is-paused", pauses.size > 0); };

    function targetX(i) {
      const off = Math.abs(cards[i].getBoundingClientRect().left - cards[0].getBoundingClientRect().left);
      const max = Math.max(0, track.scrollWidth - vp.clientWidth);
      return Math.min(off, max) * (rtl ? 1 : -1);
    }

    function go(i, byUser) {
      i = (i + n) % n;
      // направление «вперёд/назад» по кратчайшему пути по кругу — для анимации счётчика
      const prev = idx, step = i === prev ? 0 : (i - prev + n) % n <= n / 2 ? 1 : -1;
      idx = i;
      cards.forEach((c, k) => { c.classList.toggle("is-active", k === i); c.tabIndex = k === i ? 0 : -1; });
      dots.forEach((d, k) => { d.classList.toggle("is-active", k === i); d.classList.toggle("is-done", k < i); d.classList.remove("run"); d.setAttribute("aria-selected", String(k === i)); });
      ring.classList.remove("run");
      void sec.offsetWidth; // перезапуск CSS-анимаций таймера
      if (autoplay) { dots[i].classList.add("run"); ring.classList.add("run"); }

      x = targetX(i);
      if (reduced) gsap.set(track, { x });
      else gsap.to(track, { x, duration: 1.3, ease: "expo.inOut", overwrite: true });

      if (step && !reduced) {
        gsap.timeline()
          .to(cur, { yPercent: -110 * step, duration: .3, ease: "power2.in" })
          .add(() => (cur.textContent = pad2(i + 1)))
          .fromTo(cur, { yPercent: 110 * step }, { yPercent: 0, duration: .6, ease: "expo.out" });
        const m = cards[i].querySelector(".mock, .mock-img");
        if (m) gsap.fromTo(m, { scale: 1.14 }, { scale: 1, duration: 1.8, ease: "expo.out", delay: .2 });
      } else cur.textContent = pad2(i + 1);
      if (byUser) live.textContent = slideLabel(i);
    }

    sec.querySelector(".car-prev").addEventListener("click", () => go(idx - 1, true));
    sec.querySelector(".car-next").addEventListener("click", () => go(idx + 1, true));
    sec.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      go(idx + ((e.key === "ArrowRight") !== rtl ? 1 : -1), true);
    });

    // Пауза: навигация с клавиатуры внутри карусели, раздел вне экрана, вкладка скрыта, открыто окно заявки.
    // Фокус после клика мышью по стрелке паузу не ставит — иначе автопрокрутка замирала бы навсегда.
    sec.addEventListener("focusin", (e) => { if (e.target.matches(":focus-visible")) pause("focus", true); });
    sec.addEventListener("focusout", (e) => { if (!sec.contains(e.relatedTarget)) pause("focus", false); });
    sec.addEventListener("pointerdown", () => pause("focus", false));
    pause("offscreen", true);
    new IntersectionObserver(([en]) => pause("offscreen", !en.isIntersecting), { threshold: .35 }).observe(sec);
    document.addEventListener("visibilitychange", () => pause("tab", document.hidden));
    document.addEventListener("sc:modal", (e) => pause("modal", e.detail));

    // Свайп и перетаскивание
    let startX = null, startY = 0, dx = 0, dragged = false;
    vp.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      startX = e.clientX; startY = e.clientY; dx = 0; dragged = false;
    });
    window.addEventListener("pointermove", (e) => {
      if (startX === null) return;
      dx = e.clientX - startX;
      if (!dragged && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - startY)) { dragged = true; vp.classList.add("is-drag"); pause("drag", true); gsap.killTweensOf(track); }
      if (dragged) gsap.set(track, { x: x + dx * .85 });
    });
    window.addEventListener("pointerup", () => {
      if (startX === null) return;
      startX = null;
      vp.classList.remove("is-drag");
      if (!dragged) return;
      pause("drag", false);
      setTimeout(() => (dragged = false), 60); // на таче после свайпа click может не прийти
      const dirStep = (dx < 0) !== rtl ? 1 : -1;
      go(Math.abs(dx) > 60 ? idx + dirStep : idx, true);
    });
    // После перетаскивания клик не открывает ссылку; клик по соседней карточке — сначала делает её активной
    track.addEventListener("click", (e) => {
      const c = e.target.closest(".wcard");
      if (dragged) { e.preventDefault(); return; }
      if (c && !c.classList.contains("is-active")) { e.preventDefault(); go(cards.indexOf(c), true); }
    }, true);

    window.addEventListener("resize", () => { x = targetX(idx); gsap.set(track, { x }); });
    go(0);
  }

  // ---------- Старт ----------
  initGL(document.querySelector(".hero-gl"));
  initNav();
  // Ждём шрифты и контент из админки: от них зависят размеры блоков и горизонтальная витрина
  Promise.all([fontsReady, window.SC_CONTENT]).then(() => {
    document.querySelectorAll("[data-split]").forEach(splitWords);
    initCarousel();
    if (reduced) {
      gl$.intro = 1;
      return;
    }
    scrollAnims();
    heroIn();
    ScrollTrigger.refresh();
  });
})();
