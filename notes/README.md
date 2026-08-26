# 所感所悟

网页只负责把这里的文字显示在照片旁边，不提供线上填写。

## 怎么写

1. 打开本地写作窗口（推荐）：

```bash
python3 scripts/notes-window.py
```

浏览器会打开 `http://127.0.0.1:8777/`。这个窗口只在你自己的电脑上，写完会存成下面这些文档。

2. 或者直接改文档。文件名和照片对应，去掉图片后缀、改成 `.md`：

| 照片 | 文档 |
| --- | --- |
| `assets/life/photo/北京 CBD.JPG` | `notes/photography/北京 CBD.md` |
| `assets/life/sports/IMG_0230.jpg` | `notes/sports/IMG_0230.md` |
| `assets/life/art/1.jpg` | `notes/art/1.md` |

也可以在 GitHub 仓库里改同一批文件。提交之后，摄影 / 运动 / 艺术页刷新就会出现文字。没有对应文档的照片，侧栏不显示「所感所悟」。
