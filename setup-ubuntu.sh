#!/bin/bash
set -euo pipefail

# ============================================================
#  Ubuntu 首次运行初始化脚本
#  安装 Docker、Docker Compose、配置镜像加速等
# ============================================================

# -------------------- 颜色输出 --------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[SETUP]${NC} $*"; }
info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
step()  { echo ""; log "========== $* =========="; }

# -------------------- 检查权限 --------------------

check_root() {
  if [ "$EUID" -ne 0 ]; then
    error "本脚本需要 root 权限，请使用 sudo 运行："
    echo "  sudo bash $0"
  fi
}

# -------------------- 检查系统 --------------------

check_system() {
  step "检查系统信息"

  if ! command -v lsb_release &> /dev/null; then
    error "无法识别系统，确保运行在 Ubuntu 系统上"
  fi

  UBUNTU_VERSION=$(lsb_release -sr)
  UBUNTU_CODENAME=$(lsb_release -cs)

  log "Ubuntu 版本: ${UBUNTU_VERSION} (${UBUNTU_CODENAME})"

  if [[ ! "$UBUNTU_VERSION" =~ ^(20|22|24)\.04$ ]]; then
    warn "建议使用 Ubuntu 20.04 / 22.04 / 24.04 LTS，当前版本 ${UBUNTU_VERSION}"
    read -p "继续? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      error "用户取消"
    fi
  fi
}

# -------------------- 系统更新 --------------------

update_system() {
  step "更新系统包"

  apt update
  apt upgrade -y -qq

  log "系统更新完成"
}

# -------------------- 安装必要工具 --------------------

install_basic_tools() {
  step "安装基础工具"

  apt install -y -qq \
    curl \
    wget \
    git \
    ca-certificates \
    gnupg \
    lsb-release \
    apt-transport-https

  log "基础工具安装完成"
}

# -------------------- 安装 Docker --------------------

install_docker() {
  step "安装 Docker"

  # 检查是否已安装
  if command -v docker &> /dev/null; then
    log "Docker 已安装（版本: $(docker --version)）"
    return 0
  fi

  # 添加 Docker 官方 GPG 密钥
  info "添加 Docker GPG 密钥..."
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null || \
    error "下载 Docker GPG 密钥失败（检查网络连接）"

  # 添加 Docker 官方仓库
  info "添加 Docker 仓库..."
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME} stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt update -qq

  # 安装 Docker
  info "安装 Docker..."
  apt install -y -qq \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin

  # 启用 Docker 服务
  systemctl enable docker
  systemctl start docker

  log "Docker 安装完成（版本: $(docker --version)）"
}

# -------------------- 配置 Docker 镜像加速 --------------------

configure_docker_mirror() {
  step "配置 Docker 镜像加速"

  info "可选的镜像加速器："
  echo "  1. 阿里云镜像加速（推荐，需要个人账户）"
  echo "  2. 官方镜像（不加速）"
  echo ""
  read -p "选择 (1-2，默认 2): " mirror_choice
  mirror_choice=${mirror_choice:-2}

  case "$mirror_choice" in
    1)
      echo ""
      warn "请获取你的阿里云镜像加速器地址："
      echo "  1. 登录 https://cr.console.aliyun.com/"
      echo "  2. 左侧菜单 → 镜像加速器"
      echo "  3. 复制你的加速器地址（形如 https://xxx.mirror.aliyuncs.com）"
      echo ""
      read -p "输入加速器地址: " MIRROR_URL
      if [ -z "$MIRROR_URL" ]; then
        warn "未输入加速器地址，跳过配置"
        return 0
      fi
      ;;
    *)
      log "使用官方镜像源"
      MIRROR_URL=""
      ;;
  esac

  # 创建 Docker 配置目录
  mkdir -p /etc/docker

  # 生成 daemon.json
  if [ -n "$MIRROR_URL" ]; then
    cat > /etc/docker/daemon.json <<EOF
{
  "registry-mirrors": ["${MIRROR_URL}"],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
    log "已配置镜像加速器: ${MIRROR_URL}"
  else
    cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
    log "已配置 Docker 守护进程选项"
  fi

  systemctl daemon-reload
  systemctl restart docker

  log "Docker 配置完成"
}

# -------------------- 用户组配置 --------------------

setup_user_group() {
  step "配置 Docker 用户组"

  # 创建 docker 用户组（如果不存在）
  if ! getent group docker > /dev/null; then
    groupadd docker
    log "创建 docker 用户组"
  fi

  # 添加当前用户到 docker 用户组
  if [ -n "$SUDO_USER" ]; then
    usermod -aG docker "$SUDO_USER"
    log "已将用户 $SUDO_USER 添加到 docker 用户组"
    warn "请运行以下命令重新加载用户组："
    echo "  newgrp docker"
    echo "或重新登录 SSH"
  else
    warn "无法识别当前用户"
  fi
}

# -------------------- 安装 Docker Compose（独立版本） --------------------

install_docker_compose() {
  step "安装 Docker Compose"

  # Docker Compose 已通过 docker-compose-plugin 安装（随 docker-ce 一起）
  if docker compose version &> /dev/null; then
    log "Docker Compose 已安装（版本: $(docker compose version)）"
    return 0
  fi

  warn "Docker Compose 安装异常，尝试手动安装..."

  DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | \
    grep 'tag_name' | cut -d'"' -f4)

  if [ -z "$DOCKER_COMPOSE_VERSION" ]; then
    warn "无法自动获取版本，跳过手动安装"
    return 0
  fi

  curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" \
    -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose

  log "Docker Compose 安装完成"
}

# -------------------- 验证安装 --------------------

verify_installation() {
  step "验证安装"

  local all_ok=true

  if command -v docker &> /dev/null; then
    log "✓ Docker: $(docker --version)"
  else
    error "✗ Docker 安装失败"
    all_ok=false
  fi

  if docker compose version &> /dev/null; then
    log "✓ Docker Compose: $(docker compose version | head -1)"
  else
    warn "⚠ Docker Compose 未找到，但不影响部署"
  fi

  if docker run --rm hello-world &> /dev/null; then
    log "✓ Docker 运行正常"
  else
    error "✗ Docker 无法运行（权限问题？）"
    all_ok=false
  fi

  if [ "$all_ok" = true ]; then
    return 0
  else
    return 1
  fi
}

# -------------------- 创建部署目录 --------------------

setup_deploy_directory() {
  step "创建部署目录"

  DEPLOY_DIR="/opt/watermirror"
  mkdir -p "$DEPLOY_DIR"

  log "部署目录: $DEPLOY_DIR"

  if [ -n "$SUDO_USER" ]; then
    chown "$SUDO_USER:$SUDO_USER" "$DEPLOY_DIR"
    log "已设置目录所有者为 $SUDO_USER"
  fi
}

# -------------------- 阿里云 ACR 登录配置 --------------------

setup_acr_login() {
  step "配置阿里云 ACR 登录"

  echo ""
  warn "下一步需要登录阿里云 ACR，获取凭证步骤："
  echo "  1. 登录 https://cr.console.aliyun.com/"
  echo "  2. 左侧菜单 → 访问凭证"
  echo "  3. 复制 docker login 命令（或手动记录用户名和密码）"
  echo ""
  read -p "已获取凭证？按 Enter 继续..." -t 10 || true

  info "请执行以下命令登录 ACR："
  echo "  docker login registry.cn-hangzhou.aliyuncs.com"
  echo ""
  info "输入用户名（通常是邮箱）和密码"
  echo ""

  read -p "现在登录？(y/n，默认稍后手动登录): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker login registry.cn-hangzhou.aliyuncs.com || warn "登录失败，稍后可手动执行上述命令"
  fi
}

# -------------------- 安全组配置建议 --------------------

show_security_group_tips() {
  step "阿里云安全组配置提示"

  echo "如在阿里云 ECS 上运行，需要放行端口："
  echo ""
  echo "  ├─ 3000   (HTTP - WaterMirror 应用)"
  echo "  ├─ 22     (SSH - 远程管理)"
  echo "  └─ 443    (HTTPS - 可选)"
  echo ""
  echo "操作步骤："
  echo "  1. 阿里云控制台 → ECS 实例"
  echo "  2. 点击实例 → 安全组"
  echo "  3. 添加规则，放行上述端口"
  echo ""
  echo "或使用命令（若启用 UFW）:"
  echo "  sudo ufw allow 22/tcp"
  echo "  sudo ufw allow 3000/tcp"
  echo "  sudo ufw allow 443/tcp"
  echo ""
}

# -------------------- 主流程 --------------------

main() {
  echo ""
  echo "╔════════════════════════════════════════════════════════╗"
  echo "║       WaterMirror Ubuntu 首次运行初始化脚本            ║"
  echo "╚════════════════════════════════════════════════════════╝"
  echo ""

  check_root
  check_system
  update_system
  install_basic_tools
  install_docker
  configure_docker_mirror
  install_docker_compose
  setup_user_group
  verify_installation
  setup_deploy_directory
  setup_acr_login
  show_security_group_tips

  echo ""
  echo "╔════════════════════════════════════════════════════════╗"
  echo "║              ✅ 初始化完成！                            ║"
  echo "╚════════════════════════════════════════════════════════╝"
  echo ""
  echo "下一步操作："
  echo ""
  echo "1. 获取 .env 文件（从开发环境复制）"
  echo "   scp .env user@server:/opt/watermirror/.env"
  echo ""
  echo "2. 推送镜像到阿里云 ACR（在开发机上执行）"
  echo "   ./push.sh <your-namespace>"
  echo ""
  echo "3. 在服务器上拉取并运行镜像"
  echo "   docker pull registry.cn-hangzhou.aliyuncs.com/<namespace>/watermirror:latest"
  echo "   docker run -d \\"
  echo "     --name watermirror \\"
  echo "     --restart unless-stopped \\"
  echo "     -p 3000:3000 \\"
  echo "     --env-file /opt/watermirror/.env \\"
  echo "     registry.cn-hangzhou.aliyuncs.com/<namespace>/watermirror:latest"
  echo ""
  echo "4. 验证应用运行"
  echo "   docker logs -f watermirror"
  echo "   curl http://localhost:3000"
  echo ""
  echo "帮助："
  echo "   - 查看 README.md 了解详细部署步骤"
  echo "   - 运行 ./push.sh --help 查看推送镜像帮助"
  echo ""
}

main "$@"
