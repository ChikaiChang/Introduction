(function () {
  const root = document.documentElement;
  const buttons = document.querySelectorAll(".lang-switch button");
  const saved = localStorage.getItem("site-lang");
  const start = saved === "en" || saved === "zh" ? saved : "zh";

  const titles = {
    home: { zh: "常淇开 · 科研", en: "Qikai Chang · Research" },
    photography: { zh: "常淇开 · 摄影", en: "Qikai Chang · Photography" },
    sports: { zh: "常淇开 · 滑雪", en: "Qikai Chang · Skiing" },
    art: { zh: "常淇开 · 音乐", en: "Qikai Chang · Music" },
    reading: { zh: "常淇开 · 读书", en: "Qikai Chang · Reading" }
  };

  function setLang(lang) {
    root.dataset.lang = lang;
    root.lang = lang === "zh" ? "zh-CN" : "en";
    localStorage.setItem("site-lang", lang);
    buttons.forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
    });
    const page = document.body.dataset.page || "home";
    const pair = titles[page] || titles.home;
    document.title = pair[lang];
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });

  setLang(start);

  document.querySelectorAll(".year").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  const essayMount = document.querySelector("[data-essays]");
  if (essayMount) {
    const items = window.SITE_ESSAYS || [];
    if (!items.length) {
      essayMount.innerHTML = `
        <p class="essay-empty lang-zh">文章会列在这里，点标题打开微信原文。</p>
        <p class="essay-empty lang-en">Pieces will be listed here. Each title opens the original WeChat post.</p>
      `;
    } else {
      essayMount.innerHTML = `<ul class="essay-list">${items.map((item) => `
        <li>
          <span class="date">${item.date || ""}</span>
          <a href="${item.url}" target="_blank" rel="noopener">
            <span class="lang-zh">${item.titleZh || item.title || ""}</span>
            <span class="lang-en">${item.titleEn || item.titleZh || item.title || ""}</span>
          </a>
        </li>
      `).join("")}</ul>`;
    }
  }

  if (/\.github\.io$/i.test(location.hostname)) {
    const script = document.createElement("script");
    script.defer = true;
    script.src = "https://events.vercount.one/js";
    document.body.appendChild(script);
  }
})();
