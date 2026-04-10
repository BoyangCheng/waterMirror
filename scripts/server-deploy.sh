#!/bin/bash
# ============================================================
#  WaterMirror 服务器侧部署脚本
#  在 ECS 上直接 build 镜像并上线。
#
#  用法：
#    cd /opt/watermirror
#    ./scripts/server-deploy.sh              # 正常部署（复用 build 缓存）
#    ./scripts/server-deploy.sh --no-cache   # 强制重建（不复用缓存）
#    ./scripts/server-deploy.sh --skip-build # 跳过 build，只 down + up
#
#  前提：
#    - 当前目录必须是项目根（有 docker-compose.yml、Dockerfile、src/）
#    - /opt/watermirror/.env 必须是生产配置（对应 .env.production 的内容）
#    - Docker 已安装并在运行
# ============================================================

set -euo pipefail

# -------------------- 配置 --------------------
PROJECT_DIR="/opt/watermirror"
SERVICE="watermirror"
DOMAIN="watermirror.droplets.com.cn"
HEALTH_URL="http://127.0.0.1:3000"
PUBLIC_URL="https://${DOMAIN}"

# -------------------- 颜色输出 --------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[DEPLOY]${NC} $*"; }
info()  { echo -e "${BLUE}[INFO]${NC}   $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}   $*"; }
error() { echo -e "${RED}[ERROR]${NC}  $*" >&2; exit 1; }
step()  { echo ""; echo -e "${GREEN}==========${NC} $* ${GREEN}==========${NC}"; }

# -------------------- 参数解析 --------------------
NO_CACHE=""
SKIP_BUILD=0

for arg in "$@"; do
  case "$arg" in
    --no-cache)   NO_CACHE="--no-cache" ;;
    --skip-build) SKIP_BUILD=1 ;;
    -h|--help)
      head -20 "$0" | grep -E '^#' | sed 's/^# \?//'
      exit 0
      ;;
    *) error "未知参数: $arg  （--no-cache / --skip-build / --help）" ;;
  esac
done

# -------------------- 步骤 1: 前置检查 --------------------
step "1. 前置检查"

cd "$PROJECT_DIR" || error "无法进入 $PROJECT_DIR"
log "工作目录: $(pwd)"

[[ -f docker-compose.yml ]] || error "当前目录没有 docker-compose.yml"
[[ -f Dockerfile ]]         || error "当前目录没有 Dockerfile"
[[ -d src ]]                || error "当前目录没有 src/"
[[ -f .env ]]               || error ".env 不存在，请先 cp .env.production .env"

command -v docker >/dev/null  || error "Docker 未安装"
docker info >/dev/null 2>&1   || error "Docker 没在运行（systemctl status docker）"

log "✓ 目录结构 OK"

# -------------------- 步骤 2: 校验 .env --------------------
step "2. 校验 .env 关键变量"

check_env() {
  local key="$1"
  local expected_pattern="$2"
  local value
  value=$(grep -E "^${key}=" .env | head -1 | cut -d= -f2- | tr -d "'\"" || true)

  if [[ -z "$value" ]]; then
    error ".env 缺少 $key"
  fi

  if [[ -n "$expected_pattern" ]] && ! echo "$value" | grep -qE "$expected_pattern"; then
    error ".env 的 $key 不符合预期: $value （应匹配 $expected_pattern）"
  fi

  info "$key = ${value:0:60}$([ ${#value} -gt 60 ] && echo '...')"
}

check_env "NEXT_PUBLIC_SITE_URL"  "^https://${DOMAIN}"
check_env "NEXT_PUBLIC_LIVE_URL"  "^https://${DOMAIN}"
check_env "AUTHING_REDIRECT_URI"  "^https://${DOMAIN}/api/auth/callback"
check_env "DATABASE_URL"          "^postgresql://"
check_env "DOCKER_PORT"           "^127\.0\.0\.1:"
check_env "DASHSCOPE_API_KEY"     "^sk-"
check_env "AUTH_SECRET"           ""

log "✓ .env 校验通过"

# -------------------- 步骤 3: Git 同步（如果是 git 仓库）--------------------
step "3. 同步代码"

if [[ -d .git ]]; then
  local_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  info "Git 分支: $local_branch"
  if git diff --quiet && git diff --cached --quiet; then
    info "工作区干净，可以 git pull"
    git pull --ff-only || warn "git pull 失败，继续使用当前代码"
  else
    warn "工作区有未提交的改动，跳过 git pull"
  fi
else
  info "非 git 仓库，假定代码已通过 scp 同步到最新"
fi

# -------------------- 步骤 4: 备份当前镜像 ID（用于回滚参考）--------------------
step "4. 备份当前镜像信息"

OLD_IMAGE_ID=$(docker images -q ${SERVICE}-${SERVICE}:latest 2>/dev/null || echo "")
if [[ -n "$OLD_IMAGE_ID" ]]; then
  info "当前镜像 ID: $OLD_IMAGE_ID"
  info "如需回滚: docker tag $OLD_IMAGE_ID ${SERVICE}-${SERVICE}:latest && docker compose up -d --no-build"
else
  info "首次部署，无旧镜像"
fi

# -------------------- 步骤 5: 停旧容器 --------------------
step "5. 停止旧容器"
docker compose down || warn "down 失败（可能容器不存在）"

# -------------------- 步骤 6: Build 新镜像 --------------------
if [[ $SKIP_BUILD -eq 0 ]]; then
  step "6. Build 新镜像 ${NO_CACHE:+(no-cache)}"
  docker compose build $NO_CACHE || error "镜像 build 失败"
  log "✓ 镜像 build 完成"
else
  step "6. 跳过 build（--skip-build）"
fi

# -------------------- 步骤 7: 启动容器 --------------------
step "7. 启动新容器"
docker compose up -d --no-build || error "容器启动失败"
log "✓ 容器已启动"

# -------------------- 步骤 8: 等待健康 --------------------
step "8. 等待应用就绪"

max_wait=60
waited=0
while [[ $waited -lt $max_wait ]]; do
  if curl -sf -o /dev/null "$HEALTH_URL" 2>/dev/null; then
    log "✓ 应用响应 HTTP 就绪（${waited}s）"
    break
  fi
  code=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")
  if [[ "$code" =~ ^(200|301|302|307|308)$ ]]; then
    log "✓ 应用响应 $code（${waited}s）"
    break
  fi
  sleep 2
  waited=$((waited + 2))
  printf "."
done

if [[ $waited -ge $max_wait ]]; then
  warn "等待超时，查看日志排查："
  docker compose logs --tail 30 "$SERVICE"
  error "应用未在 ${max_wait}s 内就绪"
fi

# -------------------- 步骤 9: 验证数据库连接 --------------------
step "9. 验证数据库连接"

DB_CHECK_OUTPUT=$(docker compose exec -T "$SERVICE" sh -c 'node -e "
const postgres = require(\"postgres\");
const sql = postgres(process.env.DATABASE_URL, { ssl: false, connect_timeout: 15, max: 1 });
sql\`SELECT 1 as ok, current_database() as db\`.then(r => {
  console.log(\"DB_OK:\", JSON.stringify(r[0]));
  process.exit(0);
}).catch(e => {
  console.error(\"DB_ERR:\", e.code || \"unknown\", e.message);
  process.exit(1);
});
"' 2>&1) && DB_CHECK_RC=0 || DB_CHECK_RC=$?

if [[ $DB_CHECK_RC -eq 0 ]]; then
  log "✓ 数据库连接正常"
  echo "$DB_CHECK_OUTPUT" | grep DB_OK
else
  warn "数据库连接失败："
  echo "$DB_CHECK_OUTPUT"
  warn "应用可能无法正常工作，请检查 DATABASE_URL 和 PolarDB 白名单"
fi

# -------------------- 步骤 10: 展示状态 --------------------
step "10. 部署完成"

docker compose ps
echo ""

log "🎉 部署成功"
info "公网地址: $PUBLIC_URL"
info "本地地址: $HEALTH_URL"
info ""
info "常用命令:"
info "  查看日志:  docker compose logs -f $SERVICE"
info "  重启容器:  docker compose restart $SERVICE"
info "  停止容器:  docker compose down"
info "  进入容器:  docker compose exec $SERVICE sh"
info ""
info "最近 10 行日志:"
docker compose logs --tail 10 "$SERVICE" | sed 's/^/  /'
