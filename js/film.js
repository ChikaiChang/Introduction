(function () {
  const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
  const CAMERA_RE = /(Fujifilm[\w\-]*|Fuji[\w\-]*|Sony[\w\-]*|Canon[\w\-]*|Nikon[\w\-]*|Leica[\w\-]*|Hasselblad[\w\-]*|iPhone[\w\-]*|Apple)/i;

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

  function mergeItem(entry, folder) {
    const file = entry.file || fileName(entry.src);
    const src = entry.src || (file ? joinFolder(folder, file) : "");
    const fromName = parseFilenameMeta(file);
    return {
      ...fromName,
      ...entry,
      file,
      src,
      locationZh: entry.locationZh || fromName.locationZh || "",
      camera: entry.camera || fromName.camera || "",
      lens: entry.lens || fromName.lens || ""
    };
  }

  async function collectItems(key, folder) {
    const listed = (window.SITE_GALLERY && window.SITE_GALLERY[key]) || [];
    const mapped = listed.map((entry) => mergeItem(entry, folder)).filter((item) => item.src);
    const byFile = new Map(mapped.map((item) => [fileName(item.src).toLowerCase(), item]));
    const hasManifest = !!(window.SITE_GALLERY && Object.prototype.hasOwnProperty.call(window.SITE_GALLERY, key));
    if (!hasManifest) {
      const discovered = await listFolder(folder);
      discovered.forEach((name) => {
        const keyName = name.toLowerCase();
        if (!byFile.has(keyName)) {
          const item = mergeItem({ file: name }, folder);
          mapped.push(item);
          byFile.set(keyName, item);
        }
      });
    }
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
        <p class="film-note">
          <span class="lang-zh">${esc(item.noteZh || "")}</span>
          <span class="lang-en">${esc(item.noteEn || item.noteZh || "")}</span>
        </p>
      </aside>
    `;
  }

  function pruneEmpty(frame) {
    frame.querySelectorAll(".film-kicker, .film-place, .film-title, .film-date, .film-note").forEach((node) => {
      const text = node.textContent.replace(/\s+/g, "");
      if (!text) node.remove();
    });
    const exif = frame.querySelector(".film-exif");
    if (exif && !exif.children.length) exif.remove();
  }

  function frameHTML(item, index) {
    const side = item.side || (index % 2 === 0 ? "left" : "right");
    const alt = item.locationZh || item.titleZh || item.file || "photo";
    return `
      <section class="film-frame" data-side="${side}">
        <img src="${esc(hrefFor(item.src))}" alt="${esc(alt)}" decoding="async" loading="${index === 0 ? "eager" : "lazy"}">
        ${metaHTML(item)}
      </section>
    `;
  }

  function applyMeta(frame, item) {
    const next = document.createElement("div");
    next.innerHTML = metaHTML(item);
    const aside = next.querySelector(".film-meta");
    const old = frame.querySelector(".film-meta");
    if (old && aside) old.replaceWith(aside);
    pruneEmpty(frame);
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

  async function render(mount) {
    const key = mount.dataset.gallery;
    const folder = mount.dataset.folder || "";
    const items = await collectItems(key, folder);
    if (!items.length) return;

    mount.innerHTML = items.map(frameHTML).join("");
    mount.querySelectorAll(".film-frame").forEach(pruneEmpty);

    const frames = [...mount.querySelectorAll(".film-frame")];
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
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const index = frames.indexOf(entry.target);
        io.unobserve(entry.target);
        enrichFrame(index);
      });
    }, { rootMargin: "240px" });
    frames.forEach((frame) => io.observe(frame));
  }

  document.querySelectorAll("[data-gallery]").forEach((mount) => {
    render(mount);
  });
})();
