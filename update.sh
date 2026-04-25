#!/usr/bin/env bash
# ============================================================
#  WaterMirror — ECS 一键更新脚本
#  在 ECS 上跑：拉最新代码 → 拉最新镜像 → 重启容器 → 健康检查
#
#  用法（在 /opt/waterMirror 下）：
#    ./update.sh                # 默认更新到最新 :latest
#    ./update.sh aca8fc9        # 更新到指定 commit hash 标签
#
#  注意：build 不在 ECS 上做，前提是开发机已 ./push.sh 推送过新镜像。
# ============================================================
set -euo pipefail

# 颜色
G='\033[0;32m'; B='\033[0;34m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'
log()  { echo -e "${G}[UPDATE]${N} $*"; }
info() { echo -e "${B}[INFO]${N}   $*"; }
warn() { echo -e "${Y}[WARN]${N}   $*"; }
err()  { echo -e "${R}[ERROR]${N}  $*"; exit 1; }

# ---- 配置 ----
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ACR_IMAGE="crpi-ynsvk82qr21rkkzo.cn-hangzhou.personal.cr.aliyuncs.com/watermirror/watermirror"
TAG="${1:-latest}"

cd "$(dirname "$0")"

# ---- 0. 前置检查 ----
[ -f "$COMPOSE_FILE" ] || err "找不到 $COMPOSE_FILE（当前目录: $(pwd)）"
[ -f .env ] || warn ".env 文件不存在 — 你确定要继续？(Ctrl+C 取消，回车继续)" && [ -f .env ] || read -r _

# ---- 1. 拉最新代码 ----
log "拉最新代码 (git pull)"
if [ -d .git ]; then
    git fetch --all --quiet
    OLD=$(git rev-parse --short HEAD)
    git pull --ff-only || warn "git pull 失败（有本地修改？），跳过代码更新"
    NEW=$(git rev-parse --short HEAD)
    if [ "$OLD" != "$NEW" ]; then
        info "代码已更新: $OLD → $NEW"
    else
        info "代码已是最新: $NEW"
    fi
else
    warn "当前目录非 git 仓库，跳过 git pull"
fi

# ---- 2. 检查 docker login 状态 ----
if ! grep -q "crpi-ynsvk82qr21rkkzo" "$HOME/.docker/config.json" 2>/dev/null && \
   ! grep -q "crpi-ynsvk82qr21rkkzo" /root/.docker/config.json 2>/dev/null; then
    warn "未检测到 ACR 登录凭证，docker pull 可能会 401"
    warn "如果失败，跑：docker login --username=bchg4 crpi-ynsvk82qr21rkkzo.cn-hangzhou.personal.cr.aliyuncs.com"
fi

# ---- 3. 拉最新镜像 ----
log "拉最新镜像: ${ACR_IMAGE}:${TAG}"
if ! docker pull "${ACR_IMAGE}:${TAG}"; then
    err "docker pull 失败 — 检查 ACR 登录、网络、镜像 tag 是否正确"
fi

# ---- 4. 重启服务 ----
log "重启容器 (docker compose up -d)"
if [ "$TAG" = "latest" ]; then
    docker compose -f "$COMPOSE_FILE" up -d
else
    # 指定了具体 tag，临时覆盖 image
    IMAGE_OVERRIDE="${ACR_IMAGE}:${TAG}" docker compose -f "$COMPOSE_FILE" up -d
fi

# ---- 5. 等待健康检查 ----
log "等待服务就绪 ..."
sleep 5
for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS -m 3 http://127.0.0.1:3000/ -o /dev/null 2>&1; then
        log "✓ 服务响应正常 (HTTP 200)"
        break
    fi
    if [ "$i" -eq 10 ]; then
        warn "10 次重试后仍未响应 — 看日志排查："
        docker compose -f "$COMPOSE_FILE" logs --tail=30 watermirror
        exit 1
    fi
    info "  第 $i/10 次重试 (3s 后)..."
    sleep 3
done

# ---- 6. 清理悬空镜像 ----
log "清理无标签的旧镜像 ..."
docker image prune -f >/dev/null

# ---- 7. 总结 ----
echo
echo "=========================================="
log "🎉 更新完成"
echo "=========================================="
docker compose -f "$COMPOSE_FILE" ps
echo
info "实时日志：docker compose -f $COMPOSE_FILE logs -f"
info "停止服务：docker compose -f $COMPOSE_FILE down"
