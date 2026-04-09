# WaterMirror — Claude Code 协作约定

## Git 工作流

**直接在 `main` 分支上修改代码，不要新建 branch / worktree。**

- 不要执行 `git checkout -b`、`git switch -c`、`git worktree add` 之类的命令
- 不要建议「我们先开一个 feature 分支」
- 所有改动直接写到当前 `main` 工作区
- 用户会自己决定何时 commit / push
- 除非用户明确说「开个分支」，否则保持在 main

## 环境变量

仓库使用两套 env 文件：

- `.env.development` — 本地开发，URL 指向 `http://localhost:3000`
- `.env.production` — 生产部署 (`watermirror.droplets.com.cn`)，docker compose 在服务器上读取

`.env`（如果存在）保留为「当前激活」的副本，由用户手动切换：
```bash
cp .env.development .env   # 切到 dev
cp .env.production  .env   # 切到 prod
```

修改任一变量时，请同步更新 `.env.development` 和 `.env.production`，避免漂移。

## 部署目标

- 域名：`https://watermirror.droplets.com.cn`
- 服务器 IP：`47.239.112.22`
- 反代：nginx → `127.0.0.1:3000`（容器只绑 loopback）
- 证书：Let's Encrypt（certbot --nginx 自动续期）

## 项目要点

- Next.js 14 App Router，未启用 `basePath`（部署在子域名根路径）
- 数据库：阿里云 PolarDB (PostgreSQL 兼容)
- 认证：Authing OIDC（回调 URL 必须随域名同步更新）
- 语音通话：火山引擎 RTC + 豆包 ASR/TTS + DashScope (通义千问) LLM
- Docker 部署：`docker compose up -d --build`
