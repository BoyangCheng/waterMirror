# WaterMirror Ubuntu 部署指南

> 完整的阿里云 ECS Ubuntu 系统部署步骤

---

## 📋 快速总览

| 阶段 | 位置 | 操作 |
|------|------|------|
| **1. 本地开发机准备** | 你的电脑 | 编写代码、推送镜像 |
| **2. Ubuntu 服务器初始化** | 阿里云 ECS | 安装 Docker、配置环境 |
| **3. 拉取并运行镜像** | 阿里云 ECS | 启动容器、验证应用 |

---

## 🚀 部署流程（3 步）

### **第 1 步：本地开发机 - 推送镜像到阿里云 ACR**

在你的开发机上执行（Mac/Linux/Windows WSL）：

```bash
# 1. 修改 push.sh 中的命名空间（或直接传参）
chmod +x push.sh
./push.sh my-namespace

# 2. 按提示输入阿里云 ACR 凭证
# （从 https://cr.console.aliyun.com/ 的"访问凭证"获取）
```

**输出示例：**
```
[PUSH] 镜像推送完成 ✓
镜像地址: registry.cn-hangzhou.aliyuncs.com/my-namespace/watermirror:latest
```

---

### **第 2 步：Ubuntu 服务器 - 初始化环境**

在 Ubuntu 服务器上执行（首次部署）：

```bash
# SSH 连接到服务器
ssh root@your-server-ip

# 下载初始化脚本（或从开发机传过来）
# scp setup-ubuntu.sh root@your-server-ip:~/setup-ubuntu.sh

# 执行初始化脚本
sudo bash setup-ubuntu.sh

# 脚本会自动：
# ✓ 安装 Docker
# ✓ 配置镜像加速
# ✓ 创建部署目录
# ✓ 提示登录 ACR
```

**重要：按脚本提示登录 ACR**

```bash
docker login registry.cn-hangzhou.aliyuncs.com
# 输入用户名（邮箱）和密码
```

---

### **第 3 步：拉取并运行镜像**

在 Ubuntu 服务器上执行：

```bash
# 1. 创建 .env 文件（从开发机复制）
scp .env root@your-server-ip:/opt/watermirror/.env

# 2. 登录 ACR（如第 2 步未登录）
docker login registry.cn-hangzhou.aliyuncs.com

# 3. 拉取镜像
docker pull registry.cn-hangzhou.aliyuncs.com/my-namespace/watermirror:latest

# 4. 启动容器
docker run -d \
  --name watermirror \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file /opt/watermirror/.env \
  registry.cn-hangzhou.aliyuncs.com/my-namespace/watermirror:latest

# 5. 检查运行状态
docker ps --filter name=watermirror
docker logs watermirror
```

**访问应用：** http://your-server-ip:3000

---

## 🔧 使用部署脚本（推荐）

如果要使用完整的自动化部署脚本：

### 本地配置

```bash
# 编辑 deploy.sh，修改以下变量
export ACR_NAMESPACE="my-namespace"
export SSH_HOST="your-server-ip"
export SSH_USER="root"
export SSH_KEY="~/.ssh/id_rsa"

# 或直接在命令行指定
ACR_NAMESPACE=my-namespace SSH_HOST=1.2.3.4 ./deploy.sh deploy
```

### 执行部署

```bash
# 完整部署（推送 + 运行）
./deploy.sh deploy

# 仅推送镜像
./deploy.sh push-only

# 仅运行容器（镜像已存在）
./deploy.sh run-only

# 查看日志
./deploy.sh logs

# 查看状态
./deploy.sh status

# SSH 连接服务器
./deploy.sh ssh
```

---

## 📝 环境变量配置

### 必需变量（在 .env 中配置）

```env
# 认证（Clerk）
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key
CLERK_SECRET_KEY=your_secret

# 数据库（Supabase）
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key

# 豆包语音（Volcengine）
VOLCENGINE_APP_ID=your_app_id
VOLCENGINE_APP_KEY=your_app_key
VOLCENGINE_ACCOUNT_ID=your_account_id

# AI（OpenAI）
OPENAI_API_KEY=your_key

# 应用配置
NEXT_PUBLIC_LIVE_URL=https://your-domain.com
NODE_ENV=production
```

上传到服务器：
```bash
scp .env root@your-server-ip:/opt/watermirror/.env
```

---

## 🔒 安全组配置（阿里云 ECS）

### 放行必要端口

在阿里云控制台：

1. ECS 实例 → 安全组 → 入站规则
2. 添加以下规则：

| 端口 | 协议 | 来源 | 用途 |
|------|------|------|------|
| 22 | TCP | 0.0.0.0/0 | SSH 远程管理 |
| 3000 | TCP | 0.0.0.0/0 | 应用访问 |
| 443 | TCP | 0.0.0.0/0 | HTTPS（可选） |

或使用 UFW 命令（需先启用）：
```bash
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 🩺 故障排查

### 1. 容器无法启动

```bash
# 查看详细错误日志
docker logs watermirror

# 查看容器详情
docker inspect watermirror

# 重新启动容器
docker restart watermirror
```

### 2. 镜像拉取失败

```bash
# 检查 ACR 登录
docker login registry.cn-hangzhou.aliyuncs.com

# 手动拉取测试
docker pull registry.cn-hangzhou.aliyuncs.com/my-namespace/watermirror:latest
```

### 3. 应用无法访问

```bash
# 检查容器是否运行
docker ps | grep watermirror

# 检查端口是否监听
docker exec watermirror netstat -tlnp | grep 3000

# 测试本地访问
docker exec watermirror curl http://localhost:3000

# 检查防火墙
sudo ufw status
```

### 4. 环境变量未加载

```bash
# 检查 .env 文件是否存在且权限正确
ls -la /opt/watermirror/.env

# 重新启动容器
docker stop watermirror
docker rm watermirror
docker run -d \
  --name watermirror \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file /opt/watermirror/.env \
  registry.cn-hangzhou.aliyuncs.com/my-namespace/watermirror:latest
```

---

## 📊 监控和维护

### 查看日志

```bash
# 实时日志
docker logs -f watermirror

# 最后 100 行
docker logs --tail 100 watermirror

# 带时间戳
docker logs -f --timestamps watermirror
```

### 查看资源使用

```bash
# CPU、内存、网络
docker stats watermirror

# 详细统计
docker inspect watermirror | grep -A 10 "Memory"
```

### 定期清理

```bash
# 删除旧镜像
docker image prune -f

# 删除未使用的容器
docker container prune -f

# 完整清理（谨慎！）
docker system prune -a --volumes
```

---

## 🔄 更新应用

当有新版本时：

```bash
# 方式 1：使用部署脚本
./deploy.sh deploy

# 方式 2：手动更新
# 1. 推送新镜像
./push.sh my-namespace

# 2. 在服务器上更新
docker pull registry.cn-hangzhou.aliyuncs.com/my-namespace/watermirror:latest
docker stop watermirror
docker rm watermirror
docker run -d \
  --name watermirror \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file /opt/watermirror/.env \
  registry.cn-hangzhou.aliyuncs.com/my-namespace/watermirror:latest
```

---

## 💡 性能优化建议

### Ubuntu 系统级优化

```bash
# 增加文件描述符限制
sudo bash -c 'echo "* soft nofile 65535" >> /etc/security/limits.conf'
sudo bash -c 'echo "* hard nofile 65535" >> /etc/security/limits.conf'

# 优化 TCP 连接
sudo sysctl -w net.core.somaxconn=65535
sudo sysctl -w net.ipv4.tcp_max_syn_backlog=65535
```

### Docker 配置优化

在 `/etc/docker/daemon.json` 中添加：

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 65535,
      "Soft": 65535
    }
  }
}
```

重启 Docker：
```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
```

---

## 📚 相关文件说明

| 文件 | 用途 |
|------|------|
| `setup-ubuntu.sh` | Ubuntu 首次初始化脚本 |
| `push.sh` | 推送镜像到 ACR 脚本 |
| `deploy.sh` | 完整自动化部署脚本 |
| `Dockerfile` | Docker 镜像构建配置 |
| `docker-compose.yml` | Docker Compose 配置 |
| `README.md` | 项目总览文档 |

---

## 🆘 联系与支持

- **GitHub Issues**: [提交问题](https://github.com/BoyangCheng/waterMirror/issues)
- **文档**: 查看项目根目录的 `README.md`
- **Email**: suveen.te1@gmail.com

---

**祝部署顺利！🎉**
