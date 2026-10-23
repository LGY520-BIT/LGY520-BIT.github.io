# 往事.未完 · 月面来信

场景式二次元个人博客的公开展示版。Astro 静态输出，GitHub Pages 托管。

![月夜观测台主视觉](public/art/moon-observatory.webp)

## 体验

- 月夜观测台首屏、漫画分镜导航、手写信笺与文章时间线。
- 阅读字号与宽度、收起导航、F8 隐藏播放器、减少动态效果。
- 同标签页站内跳转共享音频实例；原创短曲与仅在浏览器内播放的本地选曲。
- 文章搜索、个人空间、公开网址收藏与待发布片单入口。
- 默认静态内容始终可见，动效可重复触发；尊重系统减少动态效果偏好。

## 本地运行

Node.js 24：

```sh
npm ci
npm run dev
```

```sh
npm test
npm run audit
npm run build
```

## 发布

仓库 Settings → Pages → Source 选择 **GitHub Actions**。推送 `main` 后自动检查、构建并部署。站点域名和子路径从 `GITHUB_REPOSITORY` 推导；支持个人主页仓库和普通项目仓库。自定义域名可设置 `SITE_URL`，并相应配置 DNS。

## 更新内容

公开文章位于 `src/content/blog/`，只放准备公开的 Markdown。`draft: true` 只影响展示，不会让已经推送到公开仓库的源文件变私密——私人草稿不要放入此仓库。主视觉位于 `public/art/`，音频位于 `public/audio/`。只使用有权公开的素材。

这是从本机完整版中隔离出来的新仓库，不包含本机历史提交、AI 凭据、后台接口、Live2D 模型、壁纸原件、歌曲目录或私人资料。公开站点不能扫描访问者电脑或连接站长本机的 AI 服务；不要把密钥写入浏览器脚本。

## 来源

设计组织方式参考 [Yuimi Lab](https://github.com/Yuimi-chaya/Yuimi-chaya.github.io)，界面与运行时代码独立实现，没有复制参考站的文章、角色图或音乐。

主视觉是为本站生成的 AI 插画，非官方角色立绘。原创音乐为 CC0-1.0。详见 [素材说明](ASSETS.md)。未为用户的原创文字或新代码擅自选择开源许可证；公开可读不等于自动授予再分发许可。
