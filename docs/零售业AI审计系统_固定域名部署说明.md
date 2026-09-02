# 零售业AI审计系统固定域名部署说明

## 目标

把当前临时的 `https://xxxx.trycloudflare.com` 改成你自己的固定域名，例如：

- `https://audit.yourdomain.com`

这个项目已经支持固定域名模式，只要启动系统时把 `APP_URL` 设成你的正式域名即可。

## 适用方案

推荐使用 **Cloudflare Named Tunnel**，而不是 `trycloudflare` 临时隧道。

原因：

- 域名固定，不会每次重启都变
- 更适合给别人长期访问
- 登录、上传、审批、项目创建等写操作会更稳定

## 你需要先准备

### 1. 你的域名已经接入 Cloudflare

例如：

- `yourdomain.com`

### 2. 本机已经有 `cloudflared.exe`

你当前电脑已经有：

- `C:\Users\朱润燊\Desktop\cloudflared.exe`

### 3. 系统本地可以正常启动

本项目生产模式默认走：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-system.ps1 -Production
```

## 第一步：登录 Cloudflare

在 PowerShell 执行：

```powershell
cd "C:\Users\朱润燊\Desktop\零售业AI审计系统"
C:\Users\朱润燊\Desktop\cloudflared.exe tunnel login
```

浏览器会自动打开。登录 Cloudflare 后：

- 选择你的站点
- 授权 `cloudflared`

完成后，Cloudflare 会在本机生成凭据文件。

## 第二步：创建 Named Tunnel

下面以隧道名 `retail-audit-system` 为例：

```powershell
C:\Users\朱润燊\Desktop\cloudflared.exe tunnel create retail-audit-system
```

执行后会得到：

- 一个 Tunnel UUID
- 一个 JSON 凭据文件路径

请把这两个信息记住。

## 第三步：把固定域名绑定到 Tunnel

例如你要把系统固定到：

- `audit.yourdomain.com`

执行：

```powershell
C:\Users\朱润燊\Desktop\cloudflared.exe tunnel route dns retail-audit-system audit.yourdomain.com
```

这一步会自动在 Cloudflare DNS 里创建对应记录。

## 第四步：创建 cloudflared 配置文件

在你自己的用户目录创建：

- `%USERPROFILE%\.cloudflared\config.yml`

内容如下，把里面的占位内容换成你自己的真实值：

```yaml
tunnel: <你的 Tunnel UUID>
credentials-file: C:\Users\朱润燊\.cloudflared\<你的 Tunnel UUID>.json

ingress:
  - hostname: audit.yourdomain.com
    service: http://127.0.0.1:3000
  - service: http_status:404
```

注意：

- `hostname` 要换成你的正式域名
- `credentials-file` 要换成创建隧道时生成的真实 JSON 路径
- `service` 保持 `http://127.0.0.1:3000`

## 第五步：用正式域名启动系统

这个项目已经新增了一个固定域名启动脚本：

- `scripts\start-system-cloudflare-domain.ps1`

启动命令如下：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-system-cloudflare-domain.ps1 `
  -AppUrl "https://audit.yourdomain.com" `
  -TunnelName "retail-audit-system" `
  -CloudflaredConfig "$env:USERPROFILE\.cloudflared\config.yml"
```

这个脚本会做两件事：

- 先以固定 `APP_URL` 启动你的系统
- 再启动 Cloudflare Named Tunnel

这样登录校验会和正式域名保持一致。

## 第六步：验证是否成功

浏览器打开：

- `https://audit.yourdomain.com/auth`

然后验证：

- 登录页能打开
- 管理员能登录
- 企业用户能登录
- 项目创建、上传、审批、聊天、报告查看都正常

## 常用账号

- 管理员：`admin@retail-audit.local` / `AdminDemo_2026`
- 企业用户：`company@retail-audit.local` / `CompanyDemo_2026`

## 如果你想让 Tunnel 开机自启

可以在确认一切正常后，再考虑：

```powershell
C:\Users\朱润燊\Desktop\cloudflared.exe service install
```

但建议先把手动启动跑通，再做开机自启。

## 常见问题

### 1. 域名能打开，但登录失败

通常是因为系统启动时的 `APP_URL` 不是正式域名。

请务必使用：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-system-cloudflare-domain.ps1 `
  -AppUrl "https://你的正式域名" `
  -TunnelName "你的 Tunnel 名称" `
  -CloudflaredConfig "$env:USERPROFILE\.cloudflared\config.yml"
```

### 2. `cloudflared tunnel run` 启动失败

优先查看日志：

- `logs\cloudflared.named.stdout.log`
- `logs\cloudflared.named.stderr.log`

### 3. 为什么不能继续用 `trycloudflare`

因为 `trycloudflare` 是临时地址，每次重启都可能变，不适合长期对外提供登录入口。

## 推荐执行顺序

1. `cloudflared.exe tunnel login`
2. `cloudflared.exe tunnel create retail-audit-system`
3. `cloudflared.exe tunnel route dns retail-audit-system audit.yourdomain.com`
4. 写 `%USERPROFILE%\.cloudflared\config.yml`
5. 运行固定域名启动脚本
