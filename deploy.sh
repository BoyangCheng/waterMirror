#!/bin/bash
set -euo pipefail

# ============================================================
#  WaterMirror 完整部署脚本（Ubuntu 优化版）
#  开发机: 构建 + 推送镜像 → 服务器: 拉取 + 运行容器
#
#  依赖: push.sh（推送镜像），setup-ubuntu.sh（Ubuntu 初始化）
# ============================================================

# -------------------- 配置区（按需修改）--------------------

# 阿里云 ACR 镜像仓库配置
ACR_REGISTRY="registry.cn-hangzhou.aliyuncs.com"
ACR_NAMESPACE="${ACR_NAMESPACE:-your-namespace}"          # ← 替换为你的 ACR 命名空间
ACR_REPO="watermirror"
ACR_IMAGE="${ACR_REGISTRY}/${ACR_NAMESPACE}/${ACR_REPO}"

# Ubuntu 服务器 SSH 连接信息
SSH_USER="${SSH_USER:-root}"                          # ← 替换为你的用户名（通常 root）
SSH_HOST="${SSH_HOST:-1.2.3.4}"                       # ← 替换为你的服务器公网 IP
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-~/.ssh/id_rsa}"                   # ← SSH 私钥路径

# 服务器上的部署目录（Ubuntu）
REMOTE_DIR="/opt/watermirror"

# 应用端口
APP_PORT="3000"

# 镜像 tag（使用 git commit hash 或 latest）
GIT_TAG=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")
IMAGE_TAG="${ACR_IMAGE}:${GIT_TAG}"
IMAGE_LATEST="${ACR_IMAGE}:latest"

# -------------------- 辅助函数 --------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[DEPLOY]${NC} $*"; }
info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
step()  { echo ""; log "========== $* =========="; }

SSH_CMD="ssh -o StrictHostKeyChecking=no -p ${SSH_PORT} -i ${SSH_KEY} ${SSH_USER}@${SSH_HOST}"

# -------------------- 前置检查 --------------------

check_prerequisites() {
  step "检查本地环境"

  command -v docker >/dev/null 2>&1 || error "Docker 未安装，请执行 setup-ubuntu.sh"
  command -v git >/dev/null 2>&1 || error "Git 未安装"
  command -v ssh >/dev/null 2>&1 || error "SSH 未安装"

  [ -f "$SSH_KEY" ] || error "SSH 密钥不存在: $SSH_KEY"

  if [ "$ACR_NAMESPACE" = "your-namespace" ]; then
    error "请修改 deploy.sh 中的 ACR_NAMESPACE 或设置环境变量："
    echo "  export ACR_NAMESPACE=my-namespace"
  fi

  if [ "$SSH_HOST" = "1.2.3.4" ]; then
    error "请修改 deploy.sh 中的 SSH_HOST 或设置环境变量："
    echo "  export SSH_HOST=your.server.ip"
  fi

  log "✓ 前置检查通过"
}

# -------------------- 步骤 1: 推送镜像到 ACR --------------------

push_image() {
  step "推送镜像到阿里云 ACR"

  if [ ! -f "push.sh" ]; then
    error "push.sh 不存在，请确保在项目根目录运行"
  fi

  chmod +x push.sh
  ./push.sh "$ACR_NAMESPACE" push || error "镜像推送失败"

  log "✓ 镜像推送完成"
}

# -------------------- 步骤 2: 服务器拉取并运行 --------------------

deploy_to_server() {
  step "连接 Ubuntu 服务器并部署"

  # 测试 SSH 连接
  log "测试 SSH 连接..."
  $SSH_CMD "echo 'SSH 连接成功'" || error "无法连接服务器，请检查 SSH 配置"

  log "在服务器上执行部署..."

  $SSH_CMD << REMOTE_SCRIPT
set -euo pipefail

echo "[REMOTE] 当前用户: \$(whoami)"
echo "[REMOTE] 当前目录: \$(pwd)"

# 登录 ACR
echo "[REMOTE] 登录阿里云 ACR..."
docker login ${ACR_REGISTRY} 2>/dev/null || {
  echo "[REMOTE] ⚠️ ACR 登录失败，请先手动执行："
  echo "  docker login ${ACR_REGISTRY}"
  exit 1
}

# 创建部署目录
echo "[REMOTE] 创建部署目录..."
mkdir -p ${REMOTE_DIR}
cd ${REMOTE_DIR}

# 拉取最新镜像
echo "[REMOTE] 拉取镜像: ${IMAGE_LATEST}..."
docker pull ${IMAGE_LATEST} || error "[REMOTE] 镜像拉取失败"

# 停止旧容器（如果存在）
echo "[REMOTE] 停止旧容器..."
docker stop watermirror 2>/dev/null || true
docker rm watermirror 2>/dev/null || true

# 启动新容器
echo "[REMOTE] 启动新容器..."
docker run -d \\
  --name watermirror \\
  --restart unless-stopped \\
  -p ${APP_PORT}:3000 \\
  --env-file ${REMOTE_DIR}/.env \\
  ${IMAGE_LATEST}

# 等待容器启动
echo "[REMOTE] 等待容器启动..."
sleep 3

# 检查容器状态
echo "[REMOTE] 检查容器状态..."
docker ps --filter name=watermirror --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}" || true

# 查看最近日志
echo "[REMOTE] 最近日志（最后 20 行）..."
docker logs --tail 20 watermirror || true

# 清理镜像
echo "[REMOTE] 清理旧镜像..."
docker image prune -f --filter "dangling=true" >/dev/null 2>&1 || true

echo "[REMOTE] ✅ 部署完成"

REMOTE_SCRIPT

  log "✓ 服务器部署完成"
}

# -------------------- 健康检查 --------------------

health_check() {
  step "应用健康检查"

  log "等待应用启动（10 秒）..."
  sleep 10

  log "检查应用状态..."
  if $SSH_CMD "curl -sf http://localhost:${APP_PORT} > /dev/null 2>&1"; then
    log "✅ 应用运行正常"
  else
    warn "⚠️ 应用可能还在启动中"
    warn "建议手动检查："
    echo "  $SSH_CMD 'docker logs -f watermirror'"
  fi
}

# -------------------- 辅助命令 --------------------

show_help() {
  cat << EOF
WaterMirror 部署脚本（Ubuntu 版）

用法: ./deploy.sh [命令]

命令:
  deploy        完整部署流程（默认）：推送 → 部署 → 检查
  push-only     仅推送镜像到 ACR（不部署）
  run-only      仅在服务器运行（不推送镜像）
  health        运行健康检查
  logs          查看容器日志
  status        查看容器状态
  stop          停止容器
  restart       重启容器
  ssh           SSH 连接到服务器
  help          显示此帮助

环境变量配置:
  ACR_NAMESPACE      阿里云 ACR 命名空间（默认: your-namespace）
  SSH_USER           服务器用户名（默认: root）
  SSH_HOST           服务器 IP 地址（默认: 1.2.3.4）
  SSH_PORT           SSH 端口（默认: 22）
  SSH_KEY            SSH 私钥路径（默认: ~/.ssh/id_rsa）

例子:
  ./deploy.sh deploy                          # 完整部署
  ACR_NAMESPACE=my-ns SSH_HOST=1.2.3.4 ./deploy.sh deploy  # 指定配置
  ./deploy.sh logs                            # 查看日志

首次部署步骤:
  1. 修改本脚本中的配置变量或设置环境变量
  2. 在开发机上执行: ./deploy.sh push-only
  3. 准备 .env 文件，上传到服务器: scp .env root@1.2.3.4:/opt/watermirror/
  4. 执行: ./deploy.sh run-only
  5. 检查: ./deploy.sh health

EOF
}

show_logs() {
  $SSH_CMD "docker logs --tail 50 -f watermirror"
}

show_status() {
  $SSH_CMD "docker ps --filter name=watermirror --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}\\t{{.Image}}'"
}

stop_container() {
  step "停止容器"
  $SSH_CMD "docker stop watermirror && docker rm watermirror" || true
  log "✓ 容器已停止"
}

restart_container() {
  step "重启容器"
  $SSH_CMD "docker restart watermirror"
  log "✓ 容器已重启"
  sleep 3
  health_check
}

ssh_connect() {
  log "连接到服务器: $SSH_USER@$SSH_HOST:$SSH_PORT"
  $SSH_CMD
}

# -------------------- 主流程 --------------------

main() {
  local cmd="${1:-deploy}"

  case "$cmd" in
    deploy)
      check_prerequisites
      push_image
      deploy_to_server
      health_check
      echo ""
      log "🎉 部署完成！"
      info "应用地址: http://${SSH_HOST}:${APP_PORT}"
      info "查看日志: ./deploy.sh logs"
      info "SSH 连接: ./deploy.sh ssh"
      ;;
    push-only)
      check_prerequisites
      push_image
      ;;
    run-only)
      check_prerequisites
      deploy_to_server
      health_check
      ;;
    health)
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
    ssh)
      ssh_connect
      ;;
    help|--help|-h)
      show_help
      ;;
    *)
      error "未知命令: $cmd"
      echo ""
      show_help
      ;;
  esac
}

main "$@"
