# Windows 运行脚本

在 Windows 上运行本项目的便捷脚本, 双击即可执行。

## 前置要求

- **Node.js 18+** — 从 https://nodejs.org/ 下载安装
- 项目根目录存在 `.env` 文件 (首次运行 `setup.bat` 会自动创建)

## 使用

| 脚本 | 作用 |
| --- | --- |
| `setup.bat` | 首次安装: 检查环境, 创建 `.env`, `npm install`, 生成 Prisma client |
| `dev.bat` | 启动开发服务器 (http://localhost:3000) |
| `build.bat` | 生产构建 |
| `start.bat` | 启动已构建的生产服务器 |
| `clean.bat` | 删除 `.next` 和 `node_modules` |

## 典型流程

```
1. 双击 scripts\setup.bat          (首次)
2. 用文本编辑器打开 .env 填写密钥
3. 双击 scripts\dev.bat            (日常开发)
```

## 必须配置的环境变量 (.env)

```
# Clerk 鉴权
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Supabase 数据库
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# OpenAI / 阿里云百炼
OPENAI_API_KEY=
DASHSCOPE_API_KEY=
AI_MODEL_SMART=qwen-plus

# Volcengine RTC (语音面试)
VOLCENGINE_RTC_APP_ID=
VOLCENGINE_RTC_APP_KEY=
VOLCENGINE_ACCESS_KEY_ID=
VOLCENGINE_SECRET_KEY=

# Volcengine 豆包语音
VOLCENGINE_ASR_APP_ID=
VOLCENGINE_ASR_ACCESS_TOKEN=
VOLCENGINE_TTS_APP_ID=
VOLCENGINE_TTS_ACCESS_TOKEN=
```
