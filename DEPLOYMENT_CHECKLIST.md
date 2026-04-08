# 🚀 WaterMirror Ubuntu 部署清单

> 按此清单逐步完成阿里云 ECS Ubuntu 部署

---

## 📋 部署前准备清单

### ✅ 账户和资源

- [ ] 注册阿里云账户
- [ ] 购买 ECS Ubuntu 实例（推荐 20.04 / 22.04 LTS）
- [ ] 获取服务器公网 IP 地址
- [ ] 生成或导入 SSH 密钥对
- [ ] 记录服务器 IP：**_________________**
- [ ] 记录 SSH 用户名：**_________________**

### ✅ 阿里云 ACR 准备

- [ ] 登录 [阿里云控制台](https://www.aliyun.com)
- [ ] 创建容器镜像服务 → 个人实例
- [ ] 创建命名空间（如 `my-namespace`）
- [ ] 创建仓库（名称：`watermirror`）
- [ ] 获取访问凭证（用户名 + 密码）
- [ ] 记录 ACR 命名空间：**_________________**

### ✅ 本地开发环境

- [ ] 克隆 WaterMirror 仓库
- [ ] 安装 Node.js（v18+）
- [ ] 安装 Docker Desktop
- [ ] 获取并填入 `.env` 文件（Clerk、Supabase、Volcengine、OpenAI）
- [ ] 本地测试通过：`yarn dev`

---

## 🚀 部署步骤

### **第 1 阶段：本地机 - 推送镜像**

#### 步骤 1.1 - 配置推送脚本

```bash
# 进入项目目录
cd /path/to/waterMirror

# 查看 push.sh 脚本
cat push.sh

# 确保脚本可执行
chmod +x push.sh
```

**检查清单：**
- [ ] push.sh 文件存在
- [ ] 脚本权限正确 (`-rwxr-xr-x`)

#### 步骤 1.2 - 登录本地 Docker

```bash
docker login
# 输入 Docker Hub 凭证（可选，加快镜像拉取）
```

**检查清单：**
- [ ] Docker 登录成功

#### 步骤 1.3 - 推送镜像到 ACR

```bash
# 方式 A：使用脚本（推荐）
./push.sh my-namespace

# 方式 B：手动推送
docker build -t registry.cn-hangzhou.aliyuncs.com/my-namespace/watermirror:latest .
docker login registry.cn-hangzhou.aliyuncs.com
docker push registry.cn-hangzhou.aliyuncs.com/my-namespace/watermirror:latest
```

**预期输出：**
```
[PUSH] 镜像推送完成 ✓
镜像地址: registry.cn-hangzhou.aliyuncs.com/my-namespace/watermirror:latest
```

**检查清单：**
- [ ] 镜像构建成功
- [ ] 镜像推送成功
- [ ] 在 ACR 控制台看到镜像

---

### **第 2 阶段：Ubuntu 服务器 - 初始化环境**

#### 步骤 2.1 - 连接到服务器

```bash
# SSH 连接
ssh -i ~/.ssh/id_rsa root@your-server-ip

# 或直接使用脚本（如配置了 SSH Key）
./deploy.sh ssh
```

**检查清单：**
- [ ] 成功连接到服务器

#### 步骤 2.2 - 上传初始化脚本

```bash
# 在本地执行
scp setup-ubuntu.sh root@your-server-ip:~/setup-ubuntu.sh
```

**或在服务器上直接下载（需要 wget 或 curl）：**
```bash
# 在服务器上执行
curl -O https://raw.githubusercontent.com/BoyangCheng/waterMirror/main/setup-ubuntu.sh
```

**检查清单：**
- [ ] setup-ubuntu.sh 文件存在于服务器
- [ ] 文件可执行

#### 步骤 2.3 - 运行初始化脚本

```bash
# 在服务器上执行
sudo bash ~/setup-ubuntu.sh

# 脚本会提示以下步骤：
# 1. 更新系统
# 2. 安装 Docker
# 3. 配置镜像加速（可选，选择你的加速器或官方源）
# 4. 创建部署目录
# 5. 配置 ACR 登录
```

**脚本执行时的交互：**
- [ ] 选择镜像加速器（推荐阿里云个人加速器）
- [ ] 输入 ACR 加速器地址（从 https://cr.console.aliyun.com 获取）
- [ ] 确认 Docker 组配置

**检查清单：**
- [ ] 脚本运行完成，显示 `✅ 初始化完成！`
- [ ] Docker 安装成功：`docker --version`
- [ ] 部署目录已创建：`ls -la /opt/watermirror`

#### 步骤 2.4 - 登录阿里云 ACR

```bash
# 在服务器上执行
docker login registry.cn-hangzhou.aliyuncs.com

# 输入用户名（邮箱）和密码（从 ACR 访问凭证获取）
```

**检查清单：**
- [ ] ACR 登录成功，显示 `Login Succeeded`

#### 步骤 2.5 - 上传 .env 文件

```bash
# 在本地执行
scp .env root@your-server-ip:/opt/watermirror/.env

# 验证文件已上传
ssh root@your-server-ip "ls -la /opt/watermirror/.env"
```

**检查清单：**
- [ ] .env 文件存在于 `/opt/watermirror/`
- [ ] 文件权限合理（至少 600，仅所有者可读）

---

### **第 3 阶段：服务器 - 拉取并运行镜像**

#### 步骤 3.1 - 拉取镜像

```bash
# 在服务器上执行
docker pull registry.cn-hangzhou.aliyuncs.com/my-namespace/watermirror:latest
```

**预期输出：**
```
latest: Pulling from my-namespace/watermirror
...
Digest: sha256:...
Status: Downloaded newer image for registry.cn-hangzhou.aliyuncs.com/my-namespace/watermirror:latest
```

**检查清单：**
- [ ] 镜像拉取成功
- [ ] 镜像大小约 400-500MB

#### 步骤 3.2 - 启动容器

```bash
# 在服务器上执行
docker run -d \
  --name watermirror \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file /opt/watermirror/.env \
  registry.cn-hangzhou.aliyuncs.com/my-namespace/watermirror:latest
```

**预期输出：**
```
<container-id>
```

**检查清单：**
- [ ] 容器启动成功，返回 container ID

#### 步骤 3.3 - 验证容器运行

```bash
# 检查容器状态
docker ps --filter name=watermirror

# 查看容器日志（等待 5-10 秒后）
docker logs watermirror

# 测试本地访问
docker exec watermirror curl http://localhost:3000
```

**预期输出：**
```
CONTAINER ID   IMAGE                                                      STATUS              PORTS
abc123...      registry.cn-hangzhou.aliyuncs.com/my-namespace/watermirror  Up X seconds        0.0.0.0:3000->3000/tcp
```

**检查清单：**
- [ ] 容器状态为 `Up`
- [ ] 端口映射正确：`0.0.0.0:3000->3000/tcp`
- [ ] 容器日志无错误

---

### **第 4 阶段：安全和网络配置**

#### 步骤 4.1 - 安全组配置（阿里云 ECS）

在阿里云控制台操作：

1. 登录 [ECS 控制台](https://ecs.console.aliyun.com)
2. 找到你的实例
3. 右侧菜单 → 安全组 → 配置规则
4. 添加入站规则：

| 优先级 | 协议类型 | 端口范围 | 授权对象 | 描述 |
|--------|---------|---------|---------|------|
| 100 | TCP | 22 | 0.0.0.0/0 | SSH |
| 101 | TCP | 3000 | 0.0.0.0/0 | HTTP (WaterMirror) |
| 102 | TCP | 443 | 0.0.0.0/0 | HTTPS (可选) |

**检查清单：**
- [ ] 安全组规则已添加
- [ ] SSH (22) 端口开放
- [ ] HTTP (3000) 端口开放

#### 步骤 4.2 - 防火墙配置（如启用）

```bash
# 检查 UFW 状态
sudo ufw status

# 如已启用，放行端口
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp

# 启用防火墙（如未启用）
sudo ufw enable
```

**检查清单：**
- [ ] 防火墙规则配置正确（如有）

---

### **第 5 阶段：验证和测试**

#### 步骤 5.1 - 网络可达性测试

```bash
# 从本地测试访问
curl http://your-server-ip:3000

# 或在浏览器中打开
# http://your-server-ip:3000
```

**预期结果：** 获得 HTML 响应或重定向（登录页面）

**检查清单：**
- [ ] 应用可以通过公网 IP 访问
- [ ] 加载时间合理（< 5 秒）

#### 步骤 5.2 - 应用功能测试

在浏览器中访问 http://your-server-ip:3000：

- [ ] 页面正常加载
- [ ] 能看到登录界面（Clerk）
- [ ] 能注册/登录用户
- [ ] 能创建新面试
- [ ] 能分享面试链接
- [ ] 能进入面试页面

#### 步骤 5.3 - 日志检查

```bash
# 查看最近的日志
docker logs --tail 50 watermirror

# 实时查看日志
docker logs -f watermirror
```

**检查清单：**
- [ ] 日志中无错误（ERROR 级别）
- [ ] 应用启动信息正常

---

## 📊 常见问题快速排查

| 问题 | 现象 | 解决方案 |
|------|------|---------|
| **容器无法启动** | `docker ps` 中未见容器 | `docker logs watermirror` 查看错误，检查 .env 文件 |
| **镜像拉取失败** | `pull timeout` / `authentication required` | 重新登录 ACR：`docker login` |
| **应用无法访问** | `Connection refused` | 检查安全组规则、防火墙设置、容器日志 |
| **环境变量未加载** | 应用启动失败，提示缺少环境变量 | 检查 .env 文件格式、重启容器 |
| **内存不足** | 容器频繁退出、OOM 错误 | 增加 ECS 内存，或优化应用配置 |

---

## 🔄 后续维护

### 日常监控

```bash
# 每日检查容器状态
docker ps

# 查看资源使用
docker stats watermirror

# 定期查看日志
docker logs --since 1h watermirror
```

### 更新应用

```bash
# 有新版本时，在本地执行
./push.sh my-namespace

# 在服务器上更新
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

### 定期备份

```bash
# 导出容器日志
docker logs watermirror > watermirror.log

# 备份 .env 文件
cp /opt/watermirror/.env ~/watermirror.env.backup
```

---

## 📞 获取帮助

- **部署文档**: 查看 `DEPLOY_UBUNTU.md`
- **项目文档**: 查看 `README.md`
- **GitHub Issues**: [提交问题](https://github.com/BoyangCheng/waterMirror/issues)
- **脚本帮助**:
  ```bash
  ./push.sh help
  ./deploy.sh help
  sudo bash setup-ubuntu.sh --help
  ```

---

## ✅ 部署完成标志

当完成以下所有项目，表示部署成功：

- [ ] 应用可通过浏览器访问
- [ ] 容器状态为 `Up`
- [ ] 可以登录应用
- [ ] 可以创建面试
- [ ] 日志无错误信息
- [ ] 能分享面试链接给候选人
- [ ] 候选人可以进入面试流程

---

**🎉 恭喜！你已成功部署 WaterMirror！**

现在可以开始使用 WaterMirror 进行 AI 面试了。

祝你面试顺利！📋✨
