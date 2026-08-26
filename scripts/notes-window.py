#!/usr/bin/env python3
"""Local-only window for writing photo notes. Binds to 127.0.0.1."""

from __future__ import annotations

import json
import re
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent.parent
GALLERIES = ("photography", "sports", "art")
LABELS = {"photography": "摄影", "sports": "滑雪", "art": "艺术"}
IMAGE_EXT = re.compile(r"\.(jpe?g|png|webp|gif)$", re.I)
HOST = "127.0.0.1"
PORT = 8777


def stem(name: str) -> str:
    base = name
    while IMAGE_EXT.search(base):
        base = IMAGE_EXT.sub("", base)
    return base.strip()


def note_path(gallery: str, file: str) -> Path:
    return ROOT / "notes" / gallery / f"{stem(file)}.md"


def read_gallery_js() -> str:
    path = ROOT / "js" / "gallery.js"
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        import urllib.request
        url = "https://raw.githubusercontent.com/ChikaiChang/Introduction/main/js/gallery.js"
        with urllib.request.urlopen(url, timeout=20) as res:
            return res.read().decode("utf-8")


def parse_gallery() -> dict[str, list[str]]:
    text = read_gallery_js()
    bags = {key: [] for key in GALLERIES}
    section = None
    for line in text.splitlines():
        head = re.match(r"\s*(photography|sports|art)\s*:", line)
        if head:
            section = head.group(1)
            continue
        match = re.search(r'file:\s*"([^"]+)"', line)
        if match and section:
            bags[section].append(match.group(1))
    return bags


def read_note(gallery: str, file: str) -> str:
    path = note_path(gallery, file)
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8").replace("\ufeff", "").strip()


PAGE = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>所感所悟 · 仅本机</title>
  <style>
    :root { --bg:#fff1e4; --ink:#2a1548; --muted:#7a5348; --line:#f3d2b8; --purple:#3b0764; --orange:#e85d04; }
    * { box-sizing: border-box; }
    body { margin:0; color:var(--ink); background:var(--bg); font:16px/1.55 "PingFang SC","Noto Sans SC",sans-serif; }
    header { background:var(--purple); color:#fffaf4; padding:18px 22px; }
    header p { margin:6px 0 0; color:#ffd7b0; font-size:0.9rem; }
    main { display:grid; grid-template-columns:280px 1fr; min-height:calc(100svh - 88px); }
    nav { border-right:1px solid var(--line); padding:14px 0; overflow:auto; }
    button.item { display:block; width:100%; text-align:left; border:0; background:transparent; color:inherit; font:inherit; padding:10px 16px; cursor:pointer; }
    button.item:hover, button.item.active { background:#ffe8d2; }
    button.item small { display:block; color:var(--muted); font-size:0.78rem; }
    .editor { padding:22px 24px 40px; }
    textarea { width:100%; min-height:280px; padding:14px; border:1px solid var(--line); border-radius:12px; font:inherit; background:#fffaf4; }
    .bar { display:flex; gap:10px; align-items:center; margin-top:12px; }
    .bar button { border:0; background:var(--orange); color:#fffaf4; padding:8px 16px; border-radius:999px; font:inherit; cursor:pointer; }
    .status { color:var(--muted); font-size:0.9rem; }
    h2 { margin:0 0 8px; font-size:1.15rem; }
    @media (max-width: 720px) { main { grid-template-columns:1fr; } nav { max-height:28svh; border-right:0; border-bottom:1px solid var(--line); } }
  </style>
</head>
<body>
  <header>
    <strong>所感所悟</strong>
    <p>只在这台电脑上写。保存后变成 notes 文件夹里的文档，网站只负责展示。</p>
  </header>
  <main>
    <nav id="list"></nav>
    <section class="editor">
      <h2 id="title">选一张照片</h2>
      <p id="path" class="status"></p>
      <textarea id="text" placeholder="当时在想什么，看见了什么。"></textarea>
      <div class="bar">
        <button type="button" id="save">保存到本地文档</button>
        <span class="status" id="status"></span>
      </div>
    </section>
  </main>
  <script>
    const data = DATA;
    let current = null;
    const list = document.getElementById("list");
    const title = document.getElementById("title");
    const path = document.getElementById("path");
    const area = document.getElementById("text");
    const status = document.getElementById("status");
    const labels = { photography: "摄影", sports: "滑雪", art: "艺术" };

    Object.keys(data).forEach((gallery) => {
      data[gallery].forEach((row) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "item";
        btn.innerHTML = `<b>${row.label}</b><small>${labels[gallery]} · ${row.file}</small>`;
        btn.addEventListener("click", () => select(gallery, row, btn));
        list.appendChild(btn);
      });
    });

    function select(gallery, row, btn) {
      current = { gallery, file: row.file };
      list.querySelectorAll(".item").forEach((node) => node.classList.remove("active"));
      btn.classList.add("active");
      title.textContent = row.label;
      path.textContent = row.note;
      status.textContent = "";
      fetch(`/note?gallery=${encodeURIComponent(gallery)}&file=${encodeURIComponent(row.file)}`)
        .then((res) => res.json())
        .then((body) => { area.value = body.text || ""; });
    }

    document.getElementById("save").addEventListener("click", () => {
      if (!current) { status.textContent = "先选一张照片。"; return; }
      fetch("/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gallery: current.gallery, file: current.file, text: area.value })
      }).then((res) => res.json()).then((body) => {
        status.textContent = body.ok ? "已写入本地文档。" : (body.error || "没有保存。");
      });
    });
  </script>
</body>
</html>
"""


def page_html() -> bytes:
    bags = parse_gallery()
    payload = {}
    for gallery, files in bags.items():
        payload[gallery] = []
        for file in files:
            payload[gallery].append({
                "file": file,
                "label": stem(file) or file,
                "note": str(note_path(gallery, file).relative_to(ROOT)),
            })
    html = PAGE.replace("DATA", json.dumps(payload, ensure_ascii=False))
    return html.encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def _ok(self, body: bytes, content_type: str = "text/html; charset=utf-8"):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _json(self, payload: dict, status: int = 200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self._ok(page_html())
            return
        if parsed.path == "/note":
            query = parse_qs(parsed.query)
            gallery = (query.get("gallery") or [""])[0]
            file = (query.get("file") or [""])[0]
            if not allowed(gallery, file):
                self._json({"error": "unknown photo"}, 400)
                return
            self._json({"text": read_note(gallery, file)})
            return
        self.send_error(404)

    def do_POST(self):
        if self.path != "/save":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self._json({"error": "bad json"}, 400)
            return
        gallery = str(payload.get("gallery") or "")
        file = str(payload.get("file") or "")
        text = str(payload.get("text") or "").strip()
        if not allowed(gallery, file):
            self._json({"error": "unknown photo"}, 400)
            return
        path = note_path(gallery, file)
        path.parent.mkdir(parents=True, exist_ok=True)
        if text:
            path.write_text(text + "\n", encoding="utf-8")
        elif path.exists():
            path.unlink()
        self._json({"ok": True, "path": str(path.relative_to(ROOT))})


def allowed(gallery: str, file: str) -> bool:
    if gallery not in GALLERIES:
        return False
    return file in parse_gallery().get(gallery, [])


def main() -> None:
    for gallery in GALLERIES:
        (ROOT / "notes" / gallery).mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    url = f"http://{HOST}:{PORT}/"
    print(f"所感窗口只在本机：{url}")
    print("写完后文档在 notes/ 里。网页刷新即可看到。按 Ctrl+C 关闭。")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已关闭。")


if __name__ == "__main__":
    main()
