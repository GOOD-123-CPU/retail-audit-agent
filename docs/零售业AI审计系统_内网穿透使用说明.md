# 零售业AI审计系统内网穿透使用说明

## 目标

本项目已经改造成可直接配合 `cloudflared` 使用。启动脚本会自动：

- 启动或重启系统服务
- 启动 `cloudflared tunnel`
- 自动提取 `trycloudflare` 公网地址
- 将该地址写入当前启动进程的 `APP_URL`
- 自动打开公网访问地址

这样可以避免因为 `APP_URL` 和实际访问域名不一致，导致登录、上传、审批、项目创建、聊天问答等写接口功能失效。

## 使用前准备

### 1. 安装 cloudflared

确认本机已安装并能直接执行：

```powershell
cloudflared --version
```

如果命令不存在，请先安装 `cloudflared` 并重新打开 PowerShell。

### 2. 确认本地依赖正常

项目需要以下本地条件：

- 已执行 `npm install`
- 本地 MySQL 已启动
- `.env.local` 中数据库和 AI 配置可用

## 推荐启动方式

### 方式一：直接启动 Cloudflare Tunnel 版系统

在项目根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-system.ps1 -Cloudflared -Production
```

说明：

- `-Cloudflared` 会自动启动 `cloudflared tunnel --url http://127.0.0.1:3000`
- `-Production` 会用生产模式启动 Next.js，适合演示和外部访问
- 启动完成后浏览器会自动打开 `https://xxxx.trycloudflare.com`

### 方式二：使用桌面启动器

项目已新增公网启动器：

- `launch-retail-audit-system.vbs`
  说明：本地启动
- `launch-retail-audit-system-cloudflared.vbs`
  说明：自动 cloudflared 公网启动

如需创建桌面快捷方式，执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create-desktop-shortcut.ps1
```

执行后桌面会生成两个快捷方式：

- 本地启动快捷方式
- Cloudflared 公网启动快捷方式

## 启动后如何判断是否成功

满足以下条件即表示正常：

- 浏览器自动打开 `https://xxxx.trycloudflare.com`
- 可以正常进入登录页
- 登录成功后可以进入项目列表
- 创建项目、上传文件、审批、问答、报告查看都能正常使用

## 常见问题

### 1. 提示找不到 cloudflared

原因：本机没有安装，或安装后 PowerShell 没有刷新环境变量。

处理：

```powershell
cloudflared --version
```

如果仍然报错，重新安装并重开终端。

### 2. 页面能打开，但登录或上传失败

现在脚本会自动把 tunnel 地址作为 `APP_URL` 注入启动进程。只要使用：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-system.ps1 -Cloudflared -Production
```

一般不会再出现这类问题。

如果你是手工启动系统，再单独开 tunnel，就仍然可能出现域名不一致问题。

### 3. 系统启动超时

优先查看以下日志：

- `logs\system.stderr.log`
- `logs\build.stderr.log`
- `logs\db-init.stderr.log`

如果是 tunnel 启动失败，再看：

- `logs\cloudflared.stdout.log`
- `logs\cloudflared.stderr.log`

### 4. 为什么会自动重启旧系统进程

因为公网地址每次重新开 `trycloudflare` 都可能变化。

如果系统继续沿用旧进程，旧进程里的 `APP_URL` 还是上一次的地址，就会导致登录、表单提交和接口来源校验失败。现在脚本会在公网模式下自动重启应用进程，以确保配置一致。

## 手工模式

如果你已经有固定域名或自建 Tunnel，也可以继续手工指定：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-system.ps1 -PublicAccess -Production -AppUrl "https://你的公网域名"
```

这种方式适合：

- Cloudflare Named Tunnel
- 固定反向代理域名
- frp/ngrok 等其他穿透方式
