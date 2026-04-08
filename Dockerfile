# ============================================================
#  WaterMirror Dockerfile（Ubuntu 生产环境优化）
#  多阶段构建，减小镜像体积，提高安全性
# ============================================================

# -------------------- 基础镜像 --------------------
# 使用官方 Node.js LTS Alpine 镜像（轻量级，适合生产）
FROM node:23-alpine AS base

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=1024

# -------------------- 依赖安装阶段 --------------------
FROM base AS deps

# 复制依赖声明文件
COPY package.json yarn.lock* ./

# 安装生产依赖（--frozen-lockfile 确保版本一致性）
RUN yarn install --frozen-lockfile && \
    yarn cache clean

# -------------------- 构建阶段 --------------------
FROM base AS builder

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules

# 复制源代码
COPY . .

# 构建应用（环境变量在构建时使用）
# 如需在构建时使用环境变量，可通过 ARG 传入
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_LIVE_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

RUN yarn build

# -------------------- 运行时镜像 --------------------
FROM base AS runner

ENV NODE_ENV=production

# 创建非 root 用户（提高安全性）
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 复制构建产物
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 切换用户（非 root）
USER nextjs

# 健康检查（可选，但推荐）
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => {if(r.statusCode !== 200) throw new Error(r.statusCode)})"

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["yarn", "start"]

# -------------------- 镜像元数据 --------------------
LABEL maintainer="WaterMirror Team"
LABEL version="1.0"
LABEL description="AI-powered voice interview platform"

