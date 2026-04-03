#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#  WaterMirror 一键部署脚本
#  本地构建 Docker 镜像 → 推送到阿里云 ACR → SSH 到服务器拉取运行
# ============================================================

# -------------------- 配置区（按需修改）--------------------

# 阿里云 ACR 镜像仓库（创建后填入）
# 格式: registry.<region>.aliyuncs.com/<namespace>/<repo>
ACR_REGISTRY="registry.cn-hangzhou.aliyuncs.com"
ACR_NAMESPACE="your-namespace"          # ← 替换为你的 ACR 命名空间
ACR_REPO="watermirror"
ACR_IMAGE="${ACR_REGISTRY}/${ACR_NAMESPACE}/${ACR_REPO}"

# 服务器 SSH 连接信息
SSH_USER="root"                          # ← 替换为你的用户名
SSH_HOST="1.2.3.4"                       # ← 替换为你的服务器 IP
SSH_PORT="22"
SSH_KEY="~/.ssh/id_rsa"                  # ← 替换为你的 SSH Key 路径

# 服务器上的部署目录
REMOTE_DIR="/opt/watermirror"

# 应用端口
APP_PORT="3000"

# 镜像 tag（默认使用 git commit hash）
GIT_TAG=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")
IMAGE_TAG="${ACR_IMAGE}:${GIT_TAG}"
IMAGE_LATEST="${ACR_IMAGE}:latest"

# -------------------- 辅助函数 --------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[DEPLOY]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

SSH_CMD="ssh -o StrictHostKeyChecking=no -p ${SSH_PORT} -i ${SSH_KEY} ${SSH_USER}@${SSH_HOST}"

# -------------------- 前置检查 --------------------

check_prerequisites() {
  log "检查本地环境..."

  command -v docker >/dev/null 2>&1 || error "Docker 未安装，请先安装 Docker"
  command -v git >/dev/null 2>&1    || error "Git 未安装"
  command -v ssh >/dev/null 2>&1    || error "SSH 未安装"

  if [ "$ACR_NAMESPACE" = "your-namespace" ]; then
    error "请先修改 deploy.sh 中的 ACR_NAMESPACE 配置"
  fi
  if [ "$SSH_HOST" = "1.2.3.4" ]; then
    error "请先修改 deploy.sh 中的 SSH_HOST 配置"
  fi

  log "前置检查通过 ✓"
}

# -------------------- 步骤 1: 本地构建镜像 --------------------

build_image() {
  log "构建 Docker 镜像: ${IMAGE_TAG}"
  docker build --platform linux/amd64 -t "${IMAGE_TAG}" -t "${IMAGE_LATEST}" .
  log "镜像构建完成 ✓"
}

# -------------------- 步骤 2: 登录并推送到 ACR --------------------

push_to_acr() {
  log "登录阿里云 ACR..."
  log "如果未登录过，请先执行: docker login ${ACR_REGISTRY}"

  # 尝试推送，如果未登录会提示
  log "推送镜像到 ACR: ${IMAGE_TAG}"
  docker push "${IMAGE_TAG}"
  docker push "${IMAGE_LATEST}"
  log "镜像推送完成 ✓"
}

# -------------------- 步骤 3: 服务器拉取并运行 --------------------

deploy_to_server() {
  log "连接服务器 ${SSH_USER}@${SSH_HOST}..."

  # 确认服务器能连接
  ${SSH_CMD} "echo '服务器连接成功'" || error "无法连接服务器，请检查 SSH 配置"

  log "在服务器上拉取并启动容器..."

  ${SSH_CMD} << REMOTE_SCRIPT
set -euo pipefail

echo "[REMOTE] 登录 ACR..."
docker login ${ACR_REGISTRY} 2>/dev/null || echo "[REMOTE] 请确保已在服务器上执行过 docker login ${ACR_REGISTRY}"

echo "[REMOTE] 拉取最新镜像..."
docker pull ${IMAGE_LATEST}

echo "[REMOTE] 创建部署目录..."
mkdir -p ${REMOTE_DIR}

echo "[REMOTE] 停止旧容器..."
docker stop watermirror 2>/dev/null || true
docker rm watermirror 2>/dev/null || true

echo "[REMOTE] 启动新容器..."
docker run -d \
  --name watermirror \
  --restart unless-stopped \
  -p ${APP_PORT}:3000 \
  --env-file ${REMOTE_DIR}/.env \
  ${IMAGE_LATEST}

echo "[REMOTE] 清理旧镜像..."
docker image prune -f

echo "[REMOTE] 容器状态:"
docker ps --filter name=watermirror --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
REMOTE_SCRIPT

  log "部署完成 ✓"
}

# -------------------- 步骤 4: 健康检查 --------------------

health_check() {
  log "等待应用启动（10 秒）..."
  sleep 10

  log "检查应用状态..."
  ${SSH_CMD} "curl -sf http://localhost:${APP_PORT} > /dev/null && echo '应用运行正常 ✓' || echo '应用可能还在启动中，请稍等后手动检查'"
}

# -------------------- 辅助命令 --------------------

show_help() {
  cat << EOF
WaterMirror 部署脚本

用法: ./deploy.sh [命令]

命令:
  deploy    完整部署流程（默认）: 构建 → 推送 → 部署 → 健康检查
  build     仅本地构建镜像
  push      仅推送镜像到 ACR
  run       仅在服务器上拉取并运行
  logs      查看服务器上的容器日志
  status    查看服务器上的容器状态
  stop      停止服务器上的容器
  restart   重启服务器上的容器
  env       上传本地 .env 到服务器
  setup     首次部署: 上传 .env → 完整部署

首次部署步骤:
  1. 修改脚本顶部的配置变量（ACR 地址、SSH 信息）
  2. 在阿里云创建 ACR 个人实例和命名空间
  3. 本地执行: docker login ${ACR_REGISTRY}
  4. 服务器执行: docker login ${ACR_REGISTRY}
  5. 运行: ./deploy.sh setup
EOF
}

upload_env() {
  if [ ! -f .env ]; then
    error "本地 .env 文件不存在"
  fi

  log "上传 .env 到服务器 ${REMOTE_DIR}/.env"
  ${SSH_CMD} "mkdir -p ${REMOTE_DIR}"
  scp -P "${SSH_PORT}" -i "${SSH_KEY}" .env "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/.env"
  log ".env 上传完成 ✓"
}

show_logs() {
  ${SSH_CMD} "docker logs --tail 100 -f watermirror"
}

show_status() {
  ${SSH_CMD} "docker ps --filter name=watermirror --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}'"
}

stop_container() {
  log "停止容器..."
  ${SSH_CMD} "docker stop watermirror && docker rm watermirror"
  log "容器已停止 ✓"
}

restart_container() {
  log "重启容器..."
  ${SSH_CMD} "docker restart watermirror"
  log "容器已重启 ✓"
}

# -------------------- 主流程 --------------------

main() {
  local cmd="${1:-deploy}"

  case "$cmd" in
    deploy)
      check_prerequisites
      build_image
      push_to_acr
      deploy_to_server
      health_check
      log "🎉 全部完成！访问 http://${SSH_HOST}:${APP_PORT}"
      ;;
    build)
      build_image
      ;;
    push)
      push_to_acr
      ;;
    run)
      deploy_to_server
      health_check
      ;;
    logs)
      show_logs
      ;;
    status)
      show_status
      ;;
    stop)
      stop_container
      ;;
    restart)
      restart_container
      ;;
    env)
      upload_env
      ;;
    setup)
      check_prerequisites
      upload_env
      build_image
      push_to_acr
      deploy_to_server
      health_check
      log "🎉 首次部署完成！访问 http://${SSH_HOST}:${APP_PORT}"
      ;;
    help|--help|-h)
      show_help
      ;;
    *)
      error "未知命令: $cmd\n运行 ./deploy.sh help 查看帮助"
      ;;
  esac
}

main "$@"
