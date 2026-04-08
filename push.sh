#!/bin/bash
set -euo pipefail

# ============================================================
#  WaterMirror 镜像推送脚本
#  本地构建 Docker 镜像 → 推送到阿里云 ACR
# ============================================================

# -------------------- 配置区（按需修改）--------------------

# 阿里云 ACR 镜像仓库配置
ACR_REGISTRY="registry.cn-hangzhou.aliyuncs.com"
ACR_NAMESPACE="${1:-your-namespace}"          # ← 从命令行参数获取，或改为你的命名空间
ACR_REPO="watermirror"
ACR_IMAGE="${ACR_REGISTRY}/${ACR_NAMESPACE}/${ACR_REPO}"

# 镜像 tag（默认使用 git commit hash）
GIT_TAG=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")
IMAGE_TAG="${ACR_IMAGE}:${GIT_TAG}"
IMAGE_LATEST="${ACR_IMAGE}:latest"

# -------------------- 颜色输出 --------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[PUSH]${NC} $*"; }
info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# -------------------- 前置检查 --------------------

check_prerequisites() {
  log "检查环境..."

  command -v docker >/dev/null 2>&1 || error "Docker 未安装，请先执行 setup-ubuntu.sh"
  command -v git >/dev/null 2>&1 || error "Git 未安装"

  if [ "$ACR_NAMESPACE" = "your-namespace" ]; then
    error "请指定 ACR 命名空间："
    echo "  用法: ./push.sh <your-namespace>"
    echo "  例如: ./push.sh my-namespace"
  fi

  log "前置检查通过 ✓"
}

# -------------------- 步骤 1: 本地构建镜像 --------------------

build_image() {
  log "构建 Docker 镜像..."
  info "Tag: ${IMAGE_TAG}"
  info "Latest: ${IMAGE_LATEST}"

  docker build \
    --platform linux/amd64 \
    -t "${IMAGE_TAG}" \
    -t "${IMAGE_LATEST}" \
    -f Dockerfile \
    .

  log "镜像构建完成 ✓"
  docker images | grep "${ACR_REPO}" | head -2
}

# -------------------- 步骤 2: 登录 ACR --------------------

login_acr() {
  log "检查 ACR 登录状态..."

  if docker pull registry-cn-hangzhou.aliyuncs.com/library/alpine 2>/dev/null; then
    log "已登录 ACR ✓"
  else
    warn "未登录 ACR，请按以下步骤操作："
    echo ""
    echo "  1. 在阿里云控制台获取登录命令："
    echo "     容器镜像服务 → 访问凭证 → 复制 docker login 命令"
    echo ""
    echo "  2. 在本终端执行："
    echo "     docker login ${ACR_REGISTRY}"
    echo ""
    echo "  输入用户名（邮箱）和密码"
    echo ""

    read -p "按 Enter 继续（假设已登录）..." -t 5 || true
  fi
}

# -------------------- 步骤 3: 推送镜像到 ACR --------------------

push_to_acr() {
  log "推送镜像到 ACR..."

  log "推送 ${IMAGE_TAG}..."
  docker push "${IMAGE_TAG}" || error "推送 ${IMAGE_TAG} 失败"

  log "推送 ${IMAGE_LATEST}..."
  docker push "${IMAGE_LATEST}" || error "推送 ${IMAGE_LATEST} 失败"

  log "镜像推送完成 ✓"
}

# -------------------- 验证 --------------------

verify_push() {
  log "验证推送结果..."

  # 尝试拉取刚推上去的镜像
  if docker pull "${IMAGE_LATEST}" | grep -q "Status: Downloaded"; then
    log "镜像验证成功 ✓"
  else
    warn "镜像已存在或验证异常，这是正常的"
  fi
}

# -------------------- 清理 --------------------

cleanup() {
  warn "清理本地镜像中的中间层..."
  docker image prune -f --filter "label!=keep" >/dev/null 2>&1 || true
  log "清理完成"
}

# -------------------- 主流程 --------------------

show_help() {
  cat << EOF
WaterMirror 镜像推送脚本

用法: ./push.sh <namespace> [命令]

参数:
  <namespace>   阿里云 ACR 命名空间（必需）
  [命令]        可选命令（默认为 push）

命令:
  push          完整推送流程：构建 → 登录 → 推送 → 验证（默认）
  build-only    仅本地构建，不推送
  help          显示此帮助信息

例子:
  ./push.sh my-namespace                    # 完整推送
  ./push.sh my-namespace build-only         # 仅构建

设置阿里云凭证:
  1. 阿里云控制台 → 容器镜像服务
  2. 右上角 "访问凭证" → 复制 docker login 命令
  3. 在终端执行该命令

EOF
}

main() {
  if [ $# -lt 1 ]; then
    show_help
    exit 1
  fi

  local cmd="${2:-push}"

  case "$cmd" in
    push)
      check_prerequisites
      build_image
      login_acr
      push_to_acr
      verify_push
      cleanup
      echo ""
      log "🎉 推送完成！"
      info "镜像地址: ${IMAGE_LATEST}"
      info "commit tag: ${IMAGE_TAG}"
      echo ""
      echo "下一步: 在服务器上执行"
      echo "  docker pull ${IMAGE_LATEST}"
      echo "  docker run -d --name watermirror -p 3000:3000 --env-file .env ${IMAGE_LATEST}"
      ;;
    build-only)
      build_image
      log "✓ 仅构建完成，未推送"
      ;;
    help|-h|--help)
      show_help
      ;;
    *)
      error "未知命令: $cmd"
      show_help
      ;;
  esac
}

main "$@"
