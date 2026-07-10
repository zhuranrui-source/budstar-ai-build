# Budstar AI Build

星芽AI官网、学生端和机构后台的静态原型。

## 页面

- `prototype.html`：MVP 硬闭环 demo，用于确认后再正式开发
- `index.html`：官网首页
- `student.html`：学生端
- `admin.html`：机构后台

## 目录结构

```text
.
├── admin.html
├── index.html
├── prototype.html
├── prototype.js
├── student.html
├── styles.css
├── script.js
├── assets/
│   └── budstar-logo.jpeg
└── docs/
    └── screenshots/
```

## 本地预览

可以直接在浏览器打开 `index.html`，或启动一个本地静态服务器：

```bash
python3 -m http.server 8000
```

然后访问 `http://localhost:8000`。

Demo 原型入口：

- `http://localhost:8000/prototype.html?variant=A`
- `http://localhost:8000/prototype.html?variant=B`
- `http://localhost:8000/prototype.html?variant=C`
