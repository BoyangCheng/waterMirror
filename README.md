[![GitHub stars](https://img.shields.io/github/stars/BoyangCheng/waterMirror?style=social)](https://github.com/BoyangCheng/waterMirror)
![License](https://img.shields.io/github/license/BoyangCheng/waterMirror)

# WaterMirror · AI 语音面试平台 💼

> 开源的 AI 面试平台，帮助企业通过自动化语音面试流程高效筛选候选人。

WaterMirror 集成 **豆包实时语音（Volcengine RTC）**、**大模型问答分析** 与 **多租户组织管理**，为招聘团队提供从创建面试、分享链接到候选人评估的一体化解决方案。

---

## ✨ 核心特性

- **🎯 智能面试生成** — 基于职位描述自动生成定制化面试问题
- **🎙️ AI 实时对话** — 中英双语自然语言交互，AI 智能追问与点评
- **🎥 本地视频预览** — 候选人摄像头本地渲染，不上传服务器保护隐私
- **📊 自动评分分析** — 多维度回答分析，生成候选人评估报告
- **🔗 一键分享** — 生成唯一面试链接，支持自定义分享文案（含组织名、时长、有效期）
- **📈 完整仪表盘** — 面试进度、候选人反馈、团队统计一目了然
- **🌍 国际化** — 完整中英文双语界面与面试体验
- **🎨 品牌自定义** — 主题色、Logo、面试官形象可配置

---

## 🏗️ 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Next.js 14 (App Router) · TypeScript · Tailwind CSS · React Query · next-themes |
| **实时通信** | Volcengine RTC（豆包实时音视频 / ASR / TTS） |
| **认证** | Clerk（用户认证 + 组织管理） |
| **数据库** | Supabase / PostgreSQL |
| **AI 模型** | OpenAI GPT（可替换为其他兼容 API） |
| **部署** | Docker · 阿里云 ACR · 阿里云 ECS（Ubuntu） |

---

## 🚀 快速开始（本地开发）

### 环境要求
- **Node.js** >= 18
- **Yarn** 或 npm
- **Docker**（可选，用于容器化测试）

### 1. 克隆并安装依赖

```bash
git clone https://github.com/BoyangCheng/waterMirror.git
cd waterMirror
yarn install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

填入各项 Key（见下方 [环境变量](#-环境变量) 章节）。

### 3. 启动开发服务

```bash
yarn dev
```

访问 http://localhost:3000

---

## 📝 环境变量

所有变量写入项目根目录 `.env` 文件。

### 认证（Clerk）
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```
👉 [Clerk Dashboard](https://dashboard.clerk.com) 创建应用获取

### 数据库（Supabase）
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
```
👉 在 [Supabase](https://supabase.com) 创建项目后，执行 `supabase_schema.sql` 初始化表结构

### 豆包实时语音（Volcengine RTC）
```env
VOLCENGINE_APP_ID=your_app_id
VOLCENGINE_APP_KEY=your_app_key
VOLCENGINE_ACCOUNT_ID=your_account_id
```
👉 在豆包控制台创建 RTC 应用，开通 ASR/TTS 能力

### AI 模型
```env
OPENAI_API_KEY=sk-xxx
```
用于面试问题生成和回答分析。

### 应用配置
```env
NEXT_PUBLIC_LIVE_URL=http://localhost:3000   # 生产环境改为你的域名
NODE_ENV=development
```

> ⚠️ **注意**：`NEXT_PUBLIC_*` 开头的变量会被打包进前端 bundle，**必须在 Docker build 阶段注入**，见部署章节。

---

## 📚 项目结构

```
waterMirror/
├── src/
│   ├── app/
│   │   ├── (client)/               # 面试官后台
│   │   │   ├── dashboard/          # 仪表盘
│   │   │   ├── interviews/         # 面试详情
│   │   │   └── interviewers/       # 面试官管理
│   │   ├── (user)/call/            # 候选人面试页
│   │   └── api/                    # 后端 API
│   │       ├── register-call/      # 注册面试会话
│   │       ├── start-call/         # 启动 RTC
│   │       ├── stop-call/          # 停止面试
│   │       └── get-call/           # 获取面试数据
│   ├── components/
│   │   ├── call/                   # 面试通话组件
│   │   ├── dashboard/              # 仪表盘组件
│   │   ├── providers.tsx           # 全局 Context Provider
│   │   └── ui/                     # 通用 UI 组件
│   ├── contexts/                   # React Context 定义
│   ├── hooks/                      # 自定义 Hooks
│   ├── lib/
│   │   ├── volcengine-rtc.ts       # 豆包 RTC 封装
│   │   └── prompts/                # AI 系统提示词
│   ├── services/                   # 服务层
│   └── i18n/locales/               # 中英文翻译
├── public/                         # 静态资源
├── Dockerfile                      # 多阶段构建镜像
├── docker-compose.yml              # Compose 配置
├── setup-ubuntu.sh                 # Ubuntu 服务器初始化
├── push.sh                         # 构建并推送镜像到 ACR
├── deploy.sh                       # 一键部署到服务器
└── supabase_schema.sql             # 数据库初始化 SQL
```

---

## 🐳 Docker 部署到阿里云（Ubuntu）

完整部署工具链包含 **3 个脚本**：

| 脚本 | 运行位置 | 作用 |
|------|---------|------|
| `setup-ubuntu.sh` | 服务器 | 首次初始化，安装 Docker、配置镜像加速等 |
| `push.sh` | 开发机 | 本地构建镜像，推送到阿里云 ACR |
| `deploy.sh` | 开发机 | 一键完整部署：推送 → SSH 拉取 → 运行 |

### 准备工作

1. **开通阿里云 ACR 个人版**（免费）
   - https://cr.console.aliyun.com/
   - 创建命名空间（如 `my-watermirror`）
   - 创建镜像仓库 `watermirror`（建议华东1杭州）
   - 访问凭证 → 设置 Docker 登录密码

2. **准备 Ubuntu ECS**
   - 系统：Ubuntu 20.04 / 22.04 / 24.04 LTS
   - 配置：**至少 2 核 4G**
   - 安全组放行端口：`22`、`3000`、`443`（可选）

3. **准备好本地 `.env` 文件**，包含所有必要环境变量

---

### 步骤 1️⃣：服务器初始化（仅首次）

将 `setup-ubuntu.sh` 上传到服务器并执行：

```bash
scp setup-ubuntu.sh root@<服务器IP>:/root/
ssh root@<服务器IP>
sudo bash /root/setup-ubuntu.sh
```

脚本会自动完成：
- ✅ 安装 Docker CE + Docker Compose Plugin
- ✅ 配置 Docker 镜像加速器（可选阿里云加速）
- ✅ 添加当前用户到 docker 用户组
- ✅ 创建 `/opt/watermirror` 部署目录
- ✅ 引导登录阿里云 ACR

完成后执行 `newgrp docker` 或重新登录 SSH。

---

### 步骤 2️⃣：上传 `.env` 到服务器

```bash
scp .env root@<服务器IP>:/opt/watermirror/.env
```

---

### 步骤 3️⃣：本地构建并推送镜像

先在本地登录 ACR：

```bash
docker login registry.cn-hangzhou.aliyuncs.com
```

然后构建推送（自动用 `linux/amd64` 平台以适配 ECS）：

```bash
./push.sh <your-namespace>
```

脚本流程：
1. 校验 Docker / Git / ACR 登录状态
2. 用 git commit hash 作为 tag 构建镜像
3. 同时打 `:latest` tag
4. 推送两个 tag 到 ACR
5. 通过 `docker manifest` 验证远端存在

其他命令：
```bash
./push.sh <namespace> build-only   # 仅本地构建
./push.sh help                     # 查看帮助
```

---

### 步骤 4️⃣：一键部署

配置环境变量（或编辑 `deploy.sh`）：

```bash
export ACR_NAMESPACE=my-watermirror
export SSH_USER=root
export SSH_HOST=<服务器IP>
export SSH_PORT=22
export SSH_KEY=~/.ssh/id_rsa
```

执行部署：

```bash
./deploy.sh deploy
```

全流程：**本地推送镜像 → SSH 到服务器 → 拉取镜像 → 停止旧容器 → 启动新容器 → 健康检查**

---

### 常用运维命令

```bash
./deploy.sh deploy        # 完整部署（默认）
./deploy.sh push-only     # 仅推送镜像，不部署
./deploy.sh run-only      # 仅服务器部署，不推送
./deploy.sh logs          # 实时查看容器日志
./deploy.sh status        # 查看容器状态
./deploy.sh restart       # 重启容器
./deploy.sh stop          # 停止并移除容器
./deploy.sh health        # 运行健康检查
./deploy.sh ssh           # SSH 连接到服务器
./deploy.sh help          # 显示帮助
```

---

### 日常更新流程

改完代码后只需：

```bash
git commit -am "update: xxx"
./deploy.sh deploy
```

即可完成「构建 → 推送 → 部署」全流程。

---

## 🧪 本地 Docker 测试

```bash
docker compose up --build
```

访问 http://localhost:3000

> 💡 `docker-compose.yml` 已配置 healthcheck、日志轮转与资源限制，可直接用于单机生产部署。

---

## 🎯 功能说明

### 面试官侧
- **创建面试**：AI 从职位描述生成问题 / 选择面试官 / 配置时长（1–30 分钟）/ 双语选项
- **分享面试**：一键生成链接，自定义分享文案（含组织名、时长、有效期）
- **查看结果**：实时字幕、评分维度、AI 生成的候选人评价
- **团队协作**：组织管理、权限控制、批量导入职位

### 候选人侧
- 点击链接 → 输入姓名/邮箱 → 允许摄像头/麦克风 → 开始对话
- 实时摄像头本地预览（不上传）
- AI 实时对话（流式 ASR + TTS）
- 自动计时，到时自动结束

---

## 🔧 常见问题

### ❓ 构建时 `NEXT_PUBLIC_*` 环境变量为空
需要通过 `--build-arg` 注入到 Docker build 过程，例如：
```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
  --build-arg NEXT_PUBLIC_LIVE_URL=$NEXT_PUBLIC_LIVE_URL \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
  -t watermirror .
```
Dockerfile 已将这些 `ARG` 暴露为 `ENV`，确保 build 时被 Next.js 内联到客户端 bundle。

### ❓ ACR 登录密码忘记
不是阿里云账户密码。登录 ACR 控制台 → 访问凭证 → 重置固定密码。

### ❓ Mac M 系列芯片推送的镜像在 ECS 上无法运行
`push.sh` 已默认使用 `--platform linux/amd64`，不要移除该参数。

### ❓ 容器启动后 502 或无法访问
1. 检查 `.env` 是否已上传到 `/opt/watermirror/.env`
2. 检查安全组是否放行 3000 端口
3. `./deploy.sh logs` 查看具体错误
4. 确认 `NEXT_PUBLIC_LIVE_URL` 指向公网可访问地址

### ❓ Docker 构建 OOM
ECS 内存 < 2G 时 Next.js 构建容易 OOM。**推荐在本地构建并推送**，服务器只做 `pull + run`（这也是 `deploy.sh` 的默认工作流）。

### ❓ 摄像头预览不显示 / 点击开始面试后 UI 闪烁
已修复。根本原因是 `providers.tsx` 中 `compose()` 在组件内调用，每次渲染都会生成新的组件类型，导致子组件被卸载重建。已将 `ComposedProviders` 提升到模块作用域。

### ❓ 面试官头像加载失败
已修复。从 `next/image` 改为原生 `<img>` 标签。

---

## 📖 开发指南

### 代码规范
- **TypeScript** 严格模式
- **Biome** 自动格式化 / linting
- 优先函数组件 + Hooks

### 国际化

新增文本时在 `src/i18n/locales/` 同步添加中英文：

```json
// zh.json
{ "myFeature": { "title": "我的功能" } }

// en.json
{ "myFeature": { "title": "My Feature" } }
```

使用：

```tsx
const { t } = useI18n();
<h1>{t("myFeature.title")}</h1>
```

支持参数插值（双花括号）：

```json
{ "greeting": "你好 {{name}}，欢迎！" }
```

```tsx
t("greeting", { name: "Alice" })
```

### 分支与 PR

```bash
git checkout -b feature/your-feature
# ... 开发 ...
git commit -m "feat: describe your change"
git push origin feature/your-feature
# 在 GitHub 上开 PR
```

---

## 📊 性能优化

- **服务端组件** — 充分利用 Next.js App Router 减少客户端 JS
- **多阶段 Docker 构建** — 运行镜像仅包含必要产物
- **React Query 缓存** — 减少重复 API 请求
- **流式 ASR/TTS** — 豆包实时音频无需等待完整音频
- **日志轮转** — Docker 日志 10MB × 3，防止磁盘占满

---

## 🤝 贡献

欢迎 Issue 和 PR！

1. Fork 本仓库
2. 创建特性分支 `git checkout -b feature/AmazingFeature`
3. 提交改动 `git commit -m 'feat: add AmazingFeature'`
4. 推送 `git push origin feature/AmazingFeature`
5. 开启 Pull Request

---

## 📄 许可证

MIT License，详见 [LICENSE](LICENSE)。

---

## 💬 联系

- **GitHub Issues**：https://github.com/BoyangCheng/waterMirror/issues
- **Email**：suveen.te1@gmail.com

---

## 🙏 致谢

- 豆包（Volcengine）实时音视频服务
- OpenAI GPT 模型
- Supabase 数据库
- Clerk 认证服务
- Next.js / React 社区

---

**如果项目对你有帮助，请点一个 ⭐ 支持一下！**
