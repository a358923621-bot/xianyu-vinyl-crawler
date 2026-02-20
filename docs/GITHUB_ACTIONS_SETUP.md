# GitHub Actions 配置指南

本指南将帮助你配置 GitHub Actions 自动化工作流，实现闲鱼黑胶唱片的自动监控。

## 📋 前置要求

1. **GitHub 账号**
   - 访问 [github.com](https://github.com) 注册账号

2. **GitHub 仓库**
   - 创建新仓库或使用现有仓库
   - 将本项目的代码推送到仓库

## 🚀 快速开始

### 步骤 1: 推送代码到 GitHub

```bash
# 初始化 git 仓库（如果还没有）
cd C:/Users/chq04/xianyu-vinyl-crawler
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: xianyu vinyl crawler"

# 添加远程仓库
git remote add origin https://github.com/你的用户名/你的仓库名.git

# 推送
git push -u origin main
```

### 步骤 2: 启用 GitHub Actions

1. 进入你的 GitHub 仓库
2. 点击 **Settings** 标签
3. 在左侧菜单找到 **Actions**
4. 点击 **General**
5. 滚动到 "Actions permissions"
6. 选择 **Allow all actions and reusable workflows**
7. 点击 **Save**

### 步骤 3: 配置 Secrets（可选）

如果你想要 WhatsApp 通知功能，需要配置 Twilio Secrets：

1. 在仓库页面，点击 **Settings**
2. 在左侧菜单点击 **Secrets and variables** → **Actions**
3. 点击 **New repository secret**
4. 添加以下 Secrets：

| Secret 名称 | 说明 | 示例值 |
|------------|------|--------|
| `TWILIO_ACCOUNT_SID` | Twilio 账号 SID | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio 认证令牌 | `your_auth_token_here` |
| `TWILIO_WHATSAPP_FROM` | WhatsApp 发送号码 | `whatsapp:+14155238886` |
| `TWILIO_WHATSAPP_TO` | 你的手机号 | `whatsapp:+8613800138000` |

📖 **获取 Twilio 配置**: 查看 [WhatsApp 配置指南](WHATSAPP_SETUP.md)

### 步骤 4: 启用工作流

1. 在仓库页面点击 **Actions** 标签
2. 在左侧选择 **闲鱼黑胶唱片监控** 工作流
3. 点击右侧的 **Enable workflow** 按钮（如果显示）

## ⏰ 定时任务说明

工作流配置了以下定时任务：

| 任务 | Cron 表达式 | 北京时间 | 说明 |
|------|------------|----------|------|
| 全量抓取 | `0 0 * * *` | 每天 08:00 | 抓取所有卖家数据，生成分析报告 |
| 增量抓取 | `0 */4 * * *` | 每4小时 | 快速检测新上架商品 |

**注意**: GitHub Actions 使用的是 UTC 时间，cron 表达式需要转换时区。

## 🎯 手动触发工作流

你可以随时手动触发工作流：

1. 进入 **Actions** 标签
2. 选择 **闲鱼黑胶唱片监控**
3. 点击 **Run workflow**
4. 选择运行模式：
   - `full` - 全量抓取
   - `incremental` - 增量抓取
   - `analyze_only` - 仅分析现有数据
5. （可选）选择目标卖家
6. 点击 **Run workflow** 按钮

## 📊 查看运行结果

### 查看日志

1. 进入 **Actions** 标签
2. 点击具体的工作流运行记录
3. 点击每个 Job 查看详细日志

### 下载抓取结果

工作流运行成功后，抓取的数据会作为 Artifacts 保存：

1. 进入工作流运行记录
2. 滚动页面到底部的 **Artifacts** 区域
3. 下载以下文件：
   - `scrape-results-xxx` - 原始抓取数据
   - `analysis-report-xxx` - 智能分析报告

Artifacts 保留时间：
- 抓取结果：30 天
- 分析报告：90 天

## 🔧 故障排查

### 工作流失败

**问题**: 工作流运行失败

**解决方案**:
1. 查看失败 Job 的日志
2. 常见原因：
   - 依赖安装失败 → 检查 package.json
   - 抓取超时 → 闲鱼网站可能限制，等待后重试
   - Node.js 版本问题 → 工作流使用 Node.js 20

### 没有收到 WhatsApp 通知

**问题**: 工作流成功但没有收到通知

**解决方案**:
1. 检查 Secrets 是否正确配置
2. 检查 Twilio 账户余额
3. 查看工作流日志中的错误信息
4. 确认手机号格式正确（需包含国家代码）

### 定时任务不运行

**问题**: 到了时间但工作流没有触发

**解决方案**:
1. GitHub Actions 有延迟，可能晚几分钟
2. 确认仓库有最近的活动（GitHub 会暂停不活跃仓库的定时任务）
3. 手动触发一次工作流来激活定时任务

## 📈 优化建议

### 减少运行次数

如果不需要频繁抓取，可以修改 `.github/workflows/xianyu-monitor.yml` 中的 cron 表达式：

```yaml
# 每天一次（北京时间 08:00）
schedule:
  - cron: '0 0 * * *'
```

### 增加超时时间

如果抓取时间较长，可以增加 timeout-minutes：

```yaml
jobs:
  scrape-full:
    timeout-minutes: 60  # 改为 60 分钟
```

### 添加更多卖家

在工作流文件中添加新的卖家抓取步骤，或在 `scripts/scrape-full.js` 的 `SELLERS` 配置中添加。

## 📚 相关文档

- [WhatsApp 配置指南](WHATSAPP_SETUP.md)
- [项目 README](../README.md)
- [GitHub Actions 官方文档](https://docs.github.com/en/actions)

## 💡 提示

- **免费额度**: GitHub Actions 公开仓库免费，私有仓库每月有 2000 分钟免费额度
- **运行时长**: 全量抓取约需 10-20 分钟，增量抓取约需 5-10 分钟
- **数据存储**: Artifacts 会自动过期，建议定期下载重要数据

---

如有问题，请在仓库中提 Issue。
