# wolf

使用 MkDocs 和 Material for MkDocs 构建的简洁个人主页。

## 本地安装

```bash
pip install -r requirements.txt
```

## 本地预览

```bash
mkdocs serve
```

## 构建测试

```bash
mkdocs build --strict
```

## 发布方式

未来将本地代码推送到 `main` 分支后，GitHub Actions 会自动构建并部署网站到 GitHub Pages。

第一次正式使用时，请在 GitHub 仓库的 `Settings → Pages` 中确认部署来源为 `GitHub Actions`。
