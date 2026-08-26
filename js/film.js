(function () {
  const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
  const CAMERA_RE = /(Fujifilm[\w\-]*|Fuji[\w\-]*|Sony[\w\-]*|Canon[\w\-]*|Nikon[\w\-]*|Leica[\w\-]*|Hasselblad[\w\-]*|iPhone[\w\-]*|Apple)/i;
  const NOTES_REPO = "ChikaiChang/Introduction";
  const NOTES_LABEL = "life-note";
  const DRAFT_KEY = "site-journal-drafts";

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fileName(path) {
    return decodeURIComponent((path || "").split("/").pop() || "");
  }

  function joinFolder(folder, name) {
    const base = folder.endsWith("/") ? folder : folder + "/";
    return base + name;
  }

  function hrefFor(src) {
    return src
      .split("/")
      .map((part, index) => (index === 0 ? part : encodeURIComponent(part)))
      .join("/");
  }

  function formatShutter(value) {
    if (value == null || value === "") return "";
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return String(value);
    if (n >= 1) return `${Number(n.toFixed(1))}s`;
    return `1/${Math.round(1 / n)}`;
  }

  function formatAperture(value) {
    if (value == null || value === "") return "";
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    const digits = n < 10 && !Number.isInteger(n) ? 1 : (n % 1 ? 1 : 0);
    return `f/${n.toFixed(digits)}`;
  }

  function formatFocal(value) {
    if (value == null || value === "") return "";
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return `${Math.round(n * 10) / 10}mm`.replace(/\.0mm$/, "mm");
  }

  function prettyCamera(value) {
    return String(value || "")
      .replace(/Fujifilm\s*XT-?/i, "Fujifilm X-T")
      .replace(/^FUJIFILM\s*/i, "Fujifilm ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function prettyLens(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    const compact = text.match(/^([A-Za-z]+)?(\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)(?:mm)?F(\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)$/i);
    if (compact) {
      const brand = compact[1] ? `${compact[1]} ` : "";
      return `${brand}${compact[2]}mm f/${compact[3]}`.trim();
    }
    return text.replace(/\s+/g, " ");
  }

  const PLACE_EN = {
    北京: "Beijing",
    深圳: "Shenzhen",
    重庆: "Chongqing",
    香港: "Hong Kong",
    前门: "Qianmen",
    景山: "Jingshan",
    南山: "Nanshan",
    洪崖洞: "Hongyadong",
    中环: "Central",
    CBD: "CBD",
    K11: "K11",
    北京展览馆: "Beijing Exhibition Center",
    北京美术馆: "Art Museum, Beijing"
  };

  function prettyLocationZh(zh) {
    return String(zh || "").replace(/\s+/g, " · ").trim();
  }

  function prettyLocationEn(zh) {
    const text = String(zh || "").trim();
    if (!text) return "";
    if (PLACE_EN[text]) return PLACE_EN[text];
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && PLACE_EN[parts[0]]) {
      const city = PLACE_EN[parts[0]];
      const rest = parts.slice(1).map((part) => PLACE_EN[part] || part).join(" ");
      if (rest.includes(city)) return rest;
      return `${rest}, ${city}`;
    }
    return parts.map((part) => PLACE_EN[part] || part).join(" ");
  }

  function parseFilenameMeta(name) {
    let base = fileName(name);
    while (IMAGE_EXT.test(base)) base = base.replace(IMAGE_EXT, "");
    base = base.replace(/\s*\(\d+\)\s*$/, "").replace(/\s+\d+$/, "").trim();
    const match = base.match(CAMERA_RE);
    let locationZh = "";
    let camera = "";
    let lens = "";
    if (match) {
      locationZh = base.slice(0, match.index).trim();
      const rest = base.slice(match.index).trim();
      const parts = rest.split(/\s+/);
      camera = prettyCamera(parts[0] || match[1]);
      lens = prettyLens(parts.slice(1).join(" "));
    } else {
      locationZh = base;
    }
    return {
      locationZh: prettyLocationZh(locationZh),
      locationEn: prettyLocationEn(locationZh),
      camera,
      lens
    };
  }

  function row(labelZh, labelEn, value) {
    if (!value) return "";
    return `<div class="film-exif-row"><span><span class="lang-zh">${esc(labelZh)}</span><span class="lang-en">${esc(labelEn)}</span></span><b>${esc(value)}</b></div>`;
  }

  function loadDrafts() {
    try {
      return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function draftKey(gallery, file) {
    return `${gallery}::${file}`;
  }

  function saveDraft(gallery, file, text) {
    const drafts = loadDrafts();
    const key = draftKey(gallery, file);
    if (text) drafts[key] = text;
    else delete drafts[key];
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  }

  function noteFromFile(gallery, file, entry) {
    const bag = window.SITE_NOTES && window.SITE_NOTES[gallery];
    const fromNotes = bag && typeof bag[file] === "string" ? bag[file] : "";
    return (entry && (entry.noteZh || entry.note)) || fromNotes || "";
  }

  function stripIssueBody(body) {
    return String(body || "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/^\s+|\s+$/g, "");
  }

  let issueNotes = new Map();
  let issuesReady = null;

  function issueTitle(gallery, file) {
    return `${gallery} / ${file}`;
  }

  function newIssueUrl(gallery, file, text) {
    const params = new URLSearchParams({
      labels: NOTES_LABEL,
      title: issueTitle(gallery, file),
      body: `<!-- life-note：改这一段即可，回到网页刷新就会出现在照片旁边。 -->\n\n${text || ""}`
    });
    return `https://github.com/${NOTES_REPO}/issues/new?${params.toString()}`;
  }

  function fetchIssueNotes() {
    if (issuesReady) return issuesReady;
    const cached = sessionStorage.getItem("site-life-notes");
    if (cached) {
      try {
        JSON.parse(cached).forEach((row) => issueNotes.set(row.key, row));
      } catch {
        /* ignore */
      }
    }
    issuesReady = fetch(
      `https://api.github.com/repos/${NOTES_REPO}/issues?creator=ChikaiChang&state=open&per_page=100`
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => {
        if (!Array.isArray(list)) return;
        issueNotes = new Map();
        const dump = [];
        list.forEach((issue) => {
          if (!issue.user || issue.user.login !== "ChikaiChang") return;
          const match = String(issue.title || "").match(/^(photography|sports|art)\s*\/\s*(.+)$/);
          if (!match) return;
          const row = {
            key: draftKey(match[1], match[2].trim()),
            text: stripIssueBody(issue.body),
            url: issue.html_url,
            number: issue.number
          };
          issueNotes.set(row.key, row);
          dump.push(row);
        });
        sessionStorage.setItem("site-life-notes", JSON.stringify(dump));
      })
      .catch(() => {});
    return issuesReady;
  }

  async function listFolder(folder) {
    if (!folder) return [];
    try {
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 1200) : null;
      const res = await fetch(folder, ctrl ? { signal: ctrl.signal } : {});
      if (timer) clearTimeout(timer);
      if (!res.ok) return [];
      const html = await res.text();
      const names = [...html.matchAll(/href="([^"]+)"/gi)]
        .map((match) => decodeURIComponent(match[1].split("?")[0]))
        .map((href) => href.split("/").pop())
        .filter((name) => name && IMAGE_EXT.test(name) && !name.startsWith("."));
      return [...new Set(names)].sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
    } catch {
      return [];
    }
  }

  async function readPrefix(src, maxBytes) {
    const res = await fetch(hrefFor(src));
    if (!res.ok) return null;
    if (!res.body || !res.body.getReader) {
      const buf = await res.arrayBuffer();
      return buf.byteLength > maxBytes ? buf.slice(0, maxBytes) : buf;
    }
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
    try {
      await reader.cancel();
    } catch (_) {
      /* ignore */
    }
    const out = new Uint8Array(Math.min(total, maxBytes));
    let offset = 0;
    for (const chunk of chunks) {
      const size = Math.min(chunk.byteLength, out.length - offset);
      out.set(chunk.subarray(0, size), offset);
      offset += size;
      if (offset >= out.length) break;
    }
    return out.buffer;
  }

  async function readExif(src) {
    if (!window.exifr || !window.exifr.parse) return {};
    try {
      const buf = await readPrefix(src, 256 * 1024);
      if (!buf) return {};
      const data = await window.exifr.parse(buf);
      if (!data) return {};
      const iso = data.ISO || data.ISOSpeedRatings || data.PhotographicSensitivity;
      let date = "";
      if (data.DateTimeOriginal instanceof Date) {
        const d = data.DateTimeOriginal;
        date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
      } else if (typeof data.DateTimeOriginal === "string") {
        date = data.DateTimeOriginal.replace(/^(\d{4}):(\d{2}):(\d{2}).*/, "$1.$2.$3");
      }
      return {
        camera: prettyCamera([data.Make, data.Model].filter(Boolean).join(" ")),
        lens: prettyLens(data.LensModel || data.Lens || ""),
        focal: formatFocal(data.FocalLength),
        aperture: formatAperture(data.FNumber || data.ApertureValue),
        shutter: formatShutter(data.ExposureTime),
        iso: iso != null ? String(Array.isArray(iso) ? iso[0] : iso) : "",
        date
      };
    } catch {
      return {};
    }
  }

  function mergeItem(entry, folder, webFolder, gallery) {
    const file = entry.file || fileName(entry.src);
    const src = entry.src || (file ? joinFolder(folder, file) : "");
    const webSrc = webFolder && file ? joinFolder(webFolder, file) : "";
    const fromName = parseFilenameMeta(file);
    const published = noteFromFile(gallery, file, entry);
    const issue = issueNotes.get(draftKey(gallery, file));
    const draft = loadDrafts()[draftKey(gallery, file)] || "";
    return {
      ...fromName,
      ...entry,
      gallery,
      file,
      src,
      webSrc,
      locationZh: entry.locationZh || fromName.locationZh || "",
      camera: entry.camera || fromName.camera || "",
      lens: entry.lens || fromName.lens || "",
      noteZh: draft || (issue && issue.text) || published,
      noteUrl: issue ? issue.url : "",
      publishedNote: published
    };
  }

  async function collectItems(key, folder, webFolder) {
    const listed = (window.SITE_GALLERY && window.SITE_GALLERY[key]) || [];
    const mapped = listed.map((entry) => mergeItem(entry, folder, webFolder, key)).filter((item) => item.src);
    const byFile = new Map(mapped.map((item) => [fileName(item.src).toLowerCase(), item]));
    const discovered = [...new Set([...(await listFolder(folder)), ...(await listFolder(webFolder))])];
    discovered.forEach((name) => {
      const keyName = name.toLowerCase();
      if (!byFile.has(keyName)) {
        const item = mergeItem({ file: name }, folder, webFolder, key);
        mapped.push(item);
        byFile.set(keyName, item);
      }
    });
    const defaults = {
      photography: { kickerZh: "摄影", kickerEn: "Photography" },
      sports: { kickerZh: "滑雪", kickerEn: "Skiing" },
      art: { kickerZh: "音乐", kickerEn: "Music" }
    }[key];
    if (defaults) {
      mapped.forEach((item) => {
        item.kickerZh = item.kickerZh || defaults.kickerZh;
        item.kickerEn = item.kickerEn || defaults.kickerEn;
      });
    }
    return mapped;
  }

  function journalHTML(item) {
    const hasText = !!(item.noteZh || "").trim();
    const textZh = hasText ? esc(item.noteZh).replace(/\n/g, "<br>") : "点这里写下当时的所感所悟。";
    const textEn = hasText ? esc(item.noteEn || item.noteZh).replace(/\n/g, "<br>") : "Write what this frame felt like.";
    return `
      <div class="film-journal" data-file="${esc(item.file)}" data-gallery="${esc(item.gallery)}">
        <p class="film-journal-kicker">
          <span class="lang-zh">所感所悟</span>
          <span class="lang-en">A note</span>
        </p>
        <p class="film-journal-text${hasText ? "" : " is-empty"}">
          <span class="lang-zh">${textZh}</span>
          <span class="lang-en">${textEn}</span>
        </p>
        <button type="button" class="film-journal-toggle">
          <span class="lang-zh">${hasText ? "编辑" : "写下所感"}</span>
          <span class="lang-en">${hasText ? "Edit" : "Write a note"}</span>
        </button>
        <form class="film-journal-form" hidden>
          <textarea name="note" rows="5" placeholder="当时在想什么，看见了什么。">${esc(item.noteZh || "")}</textarea>
          <div class="film-journal-actions">
            <a class="film-journal-github" href="${esc(item.noteUrl || newIssueUrl(item.gallery, item.file, item.noteZh))}" target="_blank" rel="noopener">
              <span class="lang-zh">${item.noteUrl ? "在 GitHub 上改" : "发布到 GitHub"}</span>
              <span class="lang-en">${item.noteUrl ? "Edit on GitHub" : "Publish on GitHub"}</span>
            </a>
            <button type="submit">
              <span class="lang-zh">先记在这台电脑</span>
              <span class="lang-en">Save on this device</span>
            </button>
          </div>
          <p class="film-journal-hint">
            <span class="lang-zh">发布后会变成一条 GitHub Issue，回到这一页刷新就会显示在照片旁边。</span>
            <span class="lang-en">Publishing opens a GitHub Issue. Refresh this page afterwards to see it beside the photo.</span>
          </p>
        </form>
      </div>
    `;
  }

  function metaHTML(item) {
    return `
      <aside class="film-meta">
        <p class="film-kicker">
          <span class="lang-zh">${esc(item.kickerZh || "")}</span>
          <span class="lang-en">${esc(item.kickerEn || "")}</span>
        </p>
        <p class="film-place">
          <span class="lang-zh">${esc(item.locationZh || "")}</span>
          <span class="lang-en">${esc(item.locationEn || item.locationZh || "")}</span>
        </p>
        <p class="film-title">
          <span class="lang-zh">${esc(item.titleZh || item.pieceZh || "")}</span>
          <span class="lang-en">${esc(item.titleEn || item.pieceEn || item.titleZh || item.pieceZh || "")}</span>
        </p>
        <p class="film-date">${esc(item.date || "")}</p>
        <div class="film-exif">
          ${row("机身", "Camera", item.camera)}
          ${row("镜头", "Lens", item.lens)}
        </div>
        ${journalHTML(item)}
      </aside>
    `;
  }

  function pruneEmpty(frame) {
    frame.querySelectorAll(".film-kicker, .film-place, .film-title, .film-date").forEach((node) => {
      const text = node.textContent.replace(/\s+/g, "");
      if (!text) node.remove();
    });
    const exif = frame.querySelector(".film-exif");
    if (exif && !exif.children.length) exif.remove();
  }

  function frameHTML(item, index, total) {
    const side = item.side || (index % 2 === 0 ? "left" : "right");
    const alt = item.locationZh || item.titleZh || item.file || "photo";
    const display = item.gallery === "photography" ? item.src : (item.webSrc || item.src);
    return `
      <section class="film-frame" data-side="${side}" data-index="${index + 1}" data-total="${total}">
        <img src="${esc(hrefFor(display))}" data-fallback="${esc(hrefFor(item.src))}" alt="${esc(alt)}" decoding="async" loading="${index < 6 ? "eager" : "lazy"}">
        ${metaHTML(item)}
      </section>
    `;
  }

  function bindJournal(frame, item) {
    const box = frame.querySelector(".film-journal");
    if (!box || box.dataset.bound === "1") return;
    box.dataset.bound = "1";
    const toggle = box.querySelector(".film-journal-toggle");
    const form = box.querySelector(".film-journal-form");
    const area = box.querySelector("textarea");
    const github = box.querySelector(".film-journal-github");
    const textNode = box.querySelector(".film-journal-text");
    if (!toggle || !form || !area || !github || !textNode) return;

    const syncGithub = () => {
      const next = area.value.trim();
      if (!item.noteUrl) github.href = newIssueUrl(item.gallery, item.file, next);
    };

    toggle.addEventListener("click", () => {
      form.hidden = !form.hidden;
      if (!form.hidden) {
        area.focus();
        syncGithub();
      }
    });
    textNode.addEventListener("click", () => {
      form.hidden = false;
      area.focus();
    });
    area.addEventListener("input", () => {
      saveDraft(item.gallery, item.file, area.value.trim());
      syncGithub();
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const next = area.value.trim();
      saveDraft(item.gallery, item.file, next);
      item.noteZh = next;
      textNode.classList.toggle("is-empty", !next);
      textNode.querySelector(".lang-zh").innerHTML = next ? esc(next).replace(/\n/g, "<br>") : "点这里写下当时的所感所悟。";
      textNode.querySelector(".lang-en").innerHTML = next ? esc(next).replace(/\n/g, "<br>") : "Write what this frame felt like.";
      toggle.querySelector(".lang-zh").textContent = next ? "编辑" : "写下所感";
      toggle.querySelector(".lang-en").textContent = next ? "Edit" : "Write a note";
      form.hidden = true;
      syncGithub();
    });
  }

  function applyMeta(frame, item) {
    const aside = frame.querySelector(".film-meta");
    if (!aside) return;
    const place = aside.querySelector(".film-place");
    if (place) {
      const zh = place.querySelector(".lang-zh");
      const en = place.querySelector(".lang-en");
      if (zh) zh.textContent = item.locationZh || "";
      if (en) en.textContent = item.locationEn || item.locationZh || "";
    }
    let date = aside.querySelector(".film-date");
    if (item.date) {
      if (!date) {
        date = document.createElement("p");
        date.className = "film-date";
        const exif = aside.querySelector(".film-exif");
        aside.insertBefore(date, exif || aside.querySelector(".film-journal"));
      }
      date.textContent = item.date;
    }
    let exif = aside.querySelector(".film-exif");
    const rows = `${row("机身", "Camera", item.camera)}${row("镜头", "Lens", item.lens)}`;
    if (rows) {
      if (!exif) {
        exif = document.createElement("div");
        exif.className = "film-exif";
        const journal = aside.querySelector(".film-journal");
        aside.insertBefore(exif, journal);
      }
      exif.innerHTML = rows;
    }
    pruneEmpty(frame);
  }

  function refreshJournal(frame, item) {
    const box = frame.querySelector(".film-journal");
    if (!box) return;
    const issue = issueNotes.get(draftKey(item.gallery, item.file));
    const draft = loadDrafts()[draftKey(item.gallery, item.file)] || "";
    if (issue && issue.text && !draft) item.noteZh = issue.text;
    if (issue) {
      item.noteUrl = issue.url;
      const github = box.querySelector(".film-journal-github");
      if (github) {
        github.href = issue.url;
        github.querySelector(".lang-zh").textContent = "在 GitHub 上改";
        github.querySelector(".lang-en").textContent = "Edit on GitHub";
      }
    }
    if (!draft && item.noteZh) {
      const textNode = box.querySelector(".film-journal-text");
      const area = box.querySelector("textarea");
      const toggle = box.querySelector(".film-journal-toggle");
      textNode.classList.remove("is-empty");
      textNode.querySelector(".lang-zh").innerHTML = esc(item.noteZh).replace(/\n/g, "<br>");
      textNode.querySelector(".lang-en").innerHTML = esc(item.noteEn || item.noteZh).replace(/\n/g, "<br>");
      if (area && !area.value) area.value = item.noteZh;
      if (toggle) {
        toggle.querySelector(".lang-zh").textContent = "编辑";
        toggle.querySelector(".lang-en").textContent = "Edit";
      }
    }
  }

  async function enrich(item) {
    const exif = await readExif(item.src);
    ["camera", "lens", "date"].forEach((key) => {
      if (!item[key] && exif[key]) item[key] = exif[key];
      if ((key === "camera" || key === "lens") && exif[key] && (!item[key] || item[key].length < exif[key].length)) {
        item[key] = exif[key];
      }
      if (key === "date" && exif.date) item.date = exif.date;
    });
    return item;
  }

  function indexHTML(items) {
    return `
      <nav class="film-index" aria-label="photo index">
        <p class="film-index-count">
          <b>${items.length}</b>
          <span class="lang-zh"> 张</span>
          <span class="lang-en"> photos</span>
        </p>
        ${items.map((item, index) => `
          <button type="button" class="film-index-item${index === 0 ? " is-current" : ""}" data-jump="${index}" title="${esc(item.locationZh || item.file)}">
            <img src="${esc(hrefFor(item.webSrc || item.src))}" alt="" loading="lazy">
          </button>
        `).join("")}
      </nav>
    `;
  }

  function mountCount(total, indexRoot) {
    let node = document.querySelector(".film-count");
    if (!node) {
      node = document.createElement("p");
      node.className = "film-count";
      document.body.appendChild(node);
    }
    node.hidden = total < 2;
    const buttons = indexRoot ? [...indexRoot.querySelectorAll("[data-jump]")] : [];
    const paint = (index) => {
      node.textContent = `${index} / ${total}`;
      buttons.forEach((btn, i) => btn.classList.toggle("is-current", i === index - 1));
    };
    paint(1);
    return paint;
  }

  async function render(mount) {
    const key = mount.dataset.gallery;
    const folder = mount.dataset.folder || "";
    const webFolder = mount.dataset.webFolder || "";
    fetchIssueNotes();
    const items = await collectItems(key, folder, webFolder);
    if (!items.length) return;

    mount.innerHTML = items.map((item, index) => frameHTML(item, index, items.length)).join("");
    const frames = [...mount.querySelectorAll(".film-frame")];
    document.querySelectorAll(".film-index").forEach((node) => node.remove());
    document.body.insertAdjacentHTML("beforeend", indexHTML(items));
    const indexRoot = document.querySelector(".film-index");
    if (indexRoot) {
      indexRoot.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-jump]");
        if (!btn) return;
        const target = frames[Number(btn.dataset.jump)];
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    frames.forEach((frame, index) => {
      pruneEmpty(frame);
      bindJournal(frame, items[index]);
      const img = frame.querySelector("img");
      if (img && img.dataset.fallback && img.dataset.fallback !== img.getAttribute("src")) {
        img.addEventListener("error", () => {
          if (img.dataset.failed) return;
          img.dataset.failed = "1";
          img.src = img.dataset.fallback;
        });
      }
    });

    const paint = mountCount(items.length, indexRoot);
    const enrichFrame = async (index) => {
      if (!items[index] || items[index]._enriched) return;
      items[index]._enriched = true;
      try {
        await enrich(items[index]);
        applyMeta(frames[index], items[index]);
      } catch (_) {
        /* keep filename meta */
      }
    };

    enrichFrame(0);
    if (typeof IntersectionObserver === "undefined") {
      for (let i = 1; i < items.length; i += 1) enrichFrame(i);
    } else {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = frames.indexOf(entry.target);
          io.unobserve(entry.target);
          enrichFrame(index);
        });
      }, { rootMargin: "320px", threshold: 0.08 });
      const countIo = new IntersectionObserver((entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        paint(frames.indexOf(visible.target) + 1);
      }, { threshold: [0.2, 0.45, 0.7] });
      frames.forEach((frame) => {
        io.observe(frame);
        countIo.observe(frame);
      });
    }

    fetchIssueNotes().then(() => {
      frames.forEach((frame, index) => refreshJournal(frame, items[index]));
    });
  }

  document.querySelectorAll("[data-gallery]").forEach((mount) => {
    render(mount);
  });
})();
