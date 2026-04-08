[![GitHub stars](https://img.shields.io/github/stars/BoyangCheng/waterMirror?style=social)](https://github.com/BoyangCheng/waterMirror)
![License](https://img.shields.io/github/license/BoyangCheng/waterMirror)

# WaterMirror - AI-Powered Voice Interview Platform 💼

> 一个开源的 AI 面试平台，帮助企业通过自动化面试流程高效地筛选候选人。

WaterMirror 是一款智能面试管理系统，集成了豆包语音识别、自然语言处理和实时视频预览，为招聘团队提供完整的面试解决方案。

---

## ✨ 核心特性

- **🎯 智能面试生成** - 从职位描述自动生成定制化面试问题
- **🎙️ AI 实时对话** - 支持中英文自然语言交互，AI 智能追问和点评
- **🎥 视频预览** - 候选人本地摄像头预览（仅本地渲染，不上传服务器）
- **📊 智能分析评分** - 自动分析回答内容，生成详细的候选人评估报告
- **🔗 一键分享** - 生成唯一的面试链接，支持自定义分享文案
- **📈 完整仪表盘** - 追踪所有面试进度、候选人反馈和团队统计
- **🌍 国际化支持** - 中英文双语界面和面试体验
- **🎨 自定义品牌** - 支持自定义主题色、logo、面试官

---

## 🏗️ 技术栈

### 前端
- **Next.js 14** - React 服务端框架，支持服务端组件和 API 路由
- **TypeScript** - 类型安全的开发体验
- **Tailwind CSS** - 现代响应式 UI 设计
- **React Query** - 数据获取和缓存管理
- **next-themes** - 深色模式支持

### 后端 & 实时通信
- **Volcengine RTC** - 豆包实时音视频通信，支持流式 ASR/TTS
- **Node.js** - 服务端运行时
- **API Routes** - Next.js 内置 API 路由

### 数据 & 认证
- **Supabase/PostgreSQL** - 数据存储和管理
- **Clerk** - 用户认证和组织管理
- **@tanstack/react-query** - 异步状态管理

### 部署
- **Docker** - 容器化部署
- **Aliyun ACR** - 阿里云容器镜像服务
- **Aliyun ECS** - 云服务器托管

---

## 🚀 快速开始

### 环境要求
- Node.js >= 18
- Docker & Docker Compose（用于部署）
- Git

### 1. 克隆项目

```bash
git clone https://github.com/BoyangCheng/waterMirror.git
cd waterMirror
```

### 2. 安装依赖

```bash
yarn install
# 或
npm install
```

### 3. 配置环境变量

复制环境模板并填入配置：

```bash
cp .env.example .env
```

参考 **[环境变量配置](#-环境变量配置)** 部分填入各项 API Key。

### 4. 本地开发

```bash
yarn dev
```

访问 [http://localhost:3000](http://localhost:3000)

---

## 📝 环境变量配置

### 必需变量

#### 认证服务（Clerk）
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

[获取 Clerk 密钥](https://dashboard.clerk.com) → 创建应用 → 复制环境变量

#### 数据库（Supabase）
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

1. 在 [Supabase](https://supabase.com) 创建项目
2. 执行 `supabase_schema.sql` 初始化数据库
3. 从项目设置中复制 URL 和 anon key

#### 豆包语音服务（Volcengine RTC）
```env
VOLCENGINE_APP_ID=your_volcengine_app_id
VOLCENGINE_APP_KEY=your_volcengine_app_key
VOLCENGINE_ACCOUNT_ID=your_volcengine_account_id
```

在豆包控制台创建应用，获取上述三个密钥。

#### AI 模型服务
```env
OPENAI_API_KEY=your_openai_api_key
```

用于生成面试问题和分析回答。在 [OpenAI](https://platform.openai.com/api-keys) 创建 API Key。

#### 应用配置
```env
NEXT_PUBLIC_LIVE_URL=http://localhost:3000  # 前端地址（生产环境改为域名）
NODE_ENV=development
```

---

## 📚 项目结构

```
waterMirror/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (client)/                 # 面试官后台管理
│   │   │   ├── dashboard/            # 仪表盘
│   │   │   ├── interviews/           # 面试详情
│   │   │   └── interviewers/         # 面试官管理
│   │   ├── (user)/                   # 候选人侧
│   │   │   └── call/                 # 面试进行中
│   │   ├── api/                      # 后端 API 路由
│   │   │   ├── register-call/        # 注册面试会话
│   │   │   ├── start-call/           # 启动 RTC 会话
│   │   │   ├── stop-call/            # 停止面试
│   │   │   └── get-call/             # 获取面试数据
│   │   └── layout.tsx                # 全局布局
│   ├── components/                   # React 组件
│   │   ├── call/                     # 面试通话相关
│   │   ├── dashboard/                # 仪表盘组件
│   │   └── ui/                       # 通用 UI 组件
│   ├── contexts/                     # React Context
│   ├── hooks/                        # 自定义 Hooks
│   ├── lib/                          # 工具函数
│   │   ├── volcengine-rtc.ts         # 豆包 RTC 配置
│   │   ├── prompts/                  # AI 系统提示词
│   │   └── utils.ts                  # 辅助函数
│   ├── services/                     # 服务层（API 调用）
│   ├── types/                        # TypeScript 类型定义
│   └── i18n/                         # 国际化（中英文）
├── public/                           # 静态资源
│   ├── interviewers/                 # 面试官头像
│   └── watermirrorlogo.png           # Logo
├── Dockerfile                        # Docker 镜像配置
├── docker-compose.yml                # Docker Compose 配置
├── deploy.sh                         # 自动化部署脚本
└── next.config.js                    # Next.js 配置

```

---

## 🎯 功能说明

### 1. 面试创建
- 支持从职位描述自动生成面试问题（AI 驱动）
- 自定义面试官（预设的 Lisa / Bob 或自定义）
- 设置面试时长（1～30 分钟）
- 选择面试语言（中文/英文）
- 自定义主题色和公司 Logo

### 2. 候选人面试
- 点击分享链接进入面试
- 输入邮箱和姓名（支持匿名）
- 实时摄像头预览（本地渲染）
- 与 AI 进行自然语言对话
- 实时字幕显示（ASR 结果）
- 面试时间自动计时

### 3. 智能分析
- 自动评估回答的综合得分
- 多维度分析（沟通能力、技术深度等）
- 生成候选人评价和建议
- 支持导出面试报告

### 4. 团队协作
- 组织管理（邀请团队成员）
- 权限控制（查看/编辑面试）
- 批量导入职位和候选人（通过 CSV）
- 简历筛选（AI 驱动的初步筛选）

---

## 🐳 Docker 部署

### 本地测试

```bash
docker compose up
```

访问 http://localhost:3000

### 阿里云部署

#### 前置准备

1. **创建阿里云 ACR**（个人实例，免费）
   - 登录 [阿里云控制台](https://www.aliyun.com)
   - 搜索 **容器镜像服务** → 开通个人实例
   - 创建命名空间（如 `my-namespace`）
   - 创建仓库（如 `watermirror`）

2. **获取 ACR 登录凭证**
   - 容器镜像服务 → 访问凭证 → 复制用户名和密码

3. **准备 Ubuntu 服务器**

   ```bash
   # 系统更新
   sudo apt update && sudo apt upgrade -y

   # 安装 Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh

   # 启用 Docker 服务
   sudo systemctl enable --now docker

   # 配置镜像加速（可选）
   sudo mkdir -p /etc/docker
   sudo tee /etc/docker/daemon.json <<'EOF'
   {
     "registry-mirrors": ["https://<你的加速器ID>.mirror.aliyuncs.com"]
   }
   EOF
   sudo systemctl daemon-reload
   sudo systemctl restart docker
   ```

#### 部署步骤

1. **配置部署脚本**

   编辑 `deploy.sh`，修改：
   ```bash
   ACR_NAMESPACE="my-namespace"       # ← 你的命名空间
   SSH_USER="root"                    # ← 服务器用户名
   SSH_HOST="123.45.67.89"            # ← 服务器 IP
   SSH_KEY="~/.ssh/id_rsa"            # ← SSH 密钥路径
   ```

2. **执行部署**

   ```bash
   # 首次部署（完整流程：上传 .env → 构建 → 推送 → 部署）
   ./deploy.sh setup

   # 或分步部署
   ./deploy.sh build    # 仅本地构建
   ./deploy.sh push     # 推送到 ACR
   ./deploy.sh run      # 在服务器上运行
   ```

3. **查看状态**

   ```bash
   ./deploy.sh status   # 查看容器状态
   ./deploy.sh logs     # 查看容器日志
   ```

#### 手动部署（快速版）

如果不想用脚本，可以手动执行：

```bash
# 本地构建
docker build -t registry.cn-hangzhou.aliyuncs.com/my-namespace/watermirror:latest .

# 推送到 ACR
docker login registry.cn-hangzhou.aliyuncs.com  # 输入用户名和密码
docker push registry.cn-hangzhou.aliyuncs.com/my-namespace/watermirror:latest

# 在服务器上拉取并运行
ssh root@服务器IP
docker login registry.cn-hangzhou.aliyuncs.com
docker pull registry.cn-hangzhou.aliyuncs.com/my-namespace/watermirror:latest
docker run -d \
  --name watermirror \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file /opt/watermirror/.env \
  registry.cn-hangzhou.aliyuncs.com/my-namespace/watermirror:latest
```

---

## 🔧 常见问题排查

### 摄像头预览不显示
- ✅ **原因**：组件卸载导致 state 丢失
- **修复**：已在 `providers.tsx` 中将 `compose()` 提升到模块作用域，防止子组件意外卸载

### 面试官头像加载失败
- ✅ **原因**：next/image 的域名/格式限制
- **修复**：已改用原生 `<img>` 标签，移除格式限制

### 点击"开始面试"后 UI 闪烁
- ✅ **原因**：摄像头流在 video 元素挂载前就尝试赋值
- **修复**：使用 state + useEffect 延迟绑定，并添加 2 秒等待让 UI 完全渲染

### RTC 连接失败
- 检查 Volcengine 环境变量是否正确（APP_ID, APP_KEY, ACCOUNT_ID）
- 查看浏览器控制台和服务器日志：`./deploy.sh logs`
- 检查服务器安全组是否放行了相关端口

### Docker 镜像推送很慢
- 正常情况（镜像通常 300～500MB）
- 可配置阿里云镜像加速器加快速度
- 使用 `--platform linux/amd64` 构建，确保兼容

---

## 📖 开发指南

### 代码规范
- 使用 TypeScript，确保类型安全
- Biome 自动格式化和 linting
- 优先使用函数组件和 React Hooks

### 新增功能开发流程

1. 创建特性分支
   ```bash
   git checkout -b feature/your-feature
   ```

2. 本地开发和测试
   ```bash
   yarn dev
   ```

3. 提交 commit
   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

4. 推送并创建 PR
   ```bash
   git push origin feature/your-feature
   ```

### 国际化（i18n）

新增文本时，在 `src/i18n/locales/` 中同时添加中英文：

```json
// src/i18n/locales/zh.json
{
  "myFeature": {
    "title": "我的功能"
  }
}

// src/i18n/locales/en.json
{
  "myFeature": {
    "title": "My Feature"
  }
}
```

组件中使用：
```tsx
const { t } = useI18n();
<h1>{t("myFeature.title")}</h1>
```

---

## 📊 性能优化

- **服务端组件**：充分利用 Next.js 服务端组件减少客户端 JS
- **图片优化**：本地头像使用原生 `<img>` 避免 Next.js Image 优化开销
- **缓存策略**：React Query 缓存 API 数据，减少网络请求
- **流式 ASR/TTS**：豆包实时音频处理，无需等待完整音频

---

## 🤝 贡献指南

欢迎提交 Issue 和 PR！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交改动 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

本项目采用 MIT License，详见 [LICENSE](LICENSE) 文件。

---

## 💬 联系我们

有问题或建议？

- **GitHub Issues**: [提交 Issue](https://github.com/BoyangCheng/waterMirror/issues)
- **Email**: suveen.te1@gmail.com

---

## 🙏 致谢

- 豆包语音识别 & 实时通信服务
- OpenAI GPT 模型
- Supabase 数据库
- Clerk 认证服务
- Next.js 和 React 社区

---

**如果项目对你有帮助，请给一个 ⭐ 支持我们！**
