// Разметка мини-макетов концептов: вставляется в любой элемент с data-mock="...".
(function () {
  const sk = (n) => '<span class="sk"></span>'.repeat(n);
  const nav = (logo) => `<div class="mock-nav"><span class="logo">${logo}</span><span class="links">${sk(4)}</span></div>`;
  const tpl = {
    aurum: `${nav("AURUM")}<div class="glow"></div><div class="ring"></div><div class="gem"></div>
      <h4>Вечный свет</h4><div class="row"><span></span><span></span><span></span><span></span></div>`,
    nord: `${nav("NORDHAUS")}<div class="sun"></div><h4>Жизнь над городом</h4>
      <div class="search">${sk(3)}<b></b></div>
      <div class="city">${[38, 62, 48, 80, 55, 92, 44, 70, 52, 86, 40, 64].map((h) => `<i style="height:${h}%"></i>`).join("")}</div>`,
    qalam: `${nav("<b class='ar'>قلم</b>Qalam")}<div class="pat"></div><h4>Арабский — <em>с первой буквы</em></h4><div class="prog"><i></i></div><div class="btn"></div>
      <div class="medal"><span class="ar">ع</span></div><div class="tiles">${["ا", "ب", "ت", "ث"].map((c) => `<span class="ar">${c}</span>`).join("")}</div>`,
    ombre: `${nav("Maison Ombre")}<h4>Maison<br>Ombre</h4><div class="plate"></div>
      <div class="menu">${"<span>" + sk(2) + "</span>"}${"<span>" + sk(2) + "</span>"}${"<span>" + sk(2) + "</span>"}</div>`,
    atlas: `${nav("ATLAS")}<h4>Забота в удобное для вас время</h4><div class="txt">${sk(2)}</div><div class="btn"></div>
      <div class="cal">${Array.from({ length: 28 }, (_, i) => `<i class="${i === 17 ? "on" : i < 3 ? "off" : ""}"></i>`).join("")}</div>
      <div class="doc">${sk(1)}</div>`
  };
  function render(root) {
    (root || document).querySelectorAll("[data-mock]").forEach((el) => {
      el.innerHTML = `<div class="mock-frame"><div class="mock-bar"><i></i><i></i><i></i><b></b></div>
        <div class="mock mock--${el.dataset.mock}">${tpl[el.dataset.mock] || ""}</div></div>`;
    });
  }
  window.SC_renderMocks = render;
  render();
})();
