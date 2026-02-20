# WhatsApp 通知配置指南

本项目支持通过 WhatsApp 接收闲鱼黑胶监控通知。

## 🎯 推荐方案

### 方案 1: Twilio（推荐 ⭐⭐⭐⭐⭐）

Twilio 是最稳定可靠的方案，支持 WhatsApp Business API。

#### 优点
- ✅ 稳定可靠，企业级服务
- ✅ 每日消息量大
- ✅ 支持收发消息
- ✅ 详细的发送日志

#### 缺点
- ❌ 需要付费（约 $0.005 - $0.05 / 条消息）
- ❌ 需要注册账号

---

## 📱 Twilio 配置步骤

### 1. 注册 Twilio 账号

1. 访问 [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. 使用邮箱注册
3. 验证手机号（可以使用中国号码）

### 2. 创建 WhatsApp Sender

1. 登录 Twilio Console
2. 进入 **Messaging** → **Try it out** → **Send a WhatsApp message**
3. **或者** 进入 **Messaging** → **Settings** → **WhatsApp sandbox settings**

### 3. 获取配置信息

在 Twilio Console 中找到：

| 配置项 | 说明 | 示例值 |
|--------|------|--------|
| `TWILIO_ACCOUNT_SID` | 账号 SID | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | 认证令牌 | `your_auth_token_here` |
| `TWILIO_WHATSAPP_FROM` | 发送号码 | `whatsapp:+14155238886` |

从以下位置获取：
- **Account SID** 和 **Auth Token**: Console 主页
- **From Number**: WhatsApp Sandbox 页面

### 4. 配置接收号码

1. 在 WhatsApp Sandbox 页面，输入你的手机号（带国家代码）
2. 格式：`+8613800138000`（中国号码示例）
3. 点击发送验证码
4. 在手机上收到验证码后，发送 `join <keyword>` 到提供的号码
5. 验证完成！

### 5. 添加到 GitHub Secrets

```
Settings → Secrets and variables → Actions → New repository secret
```

添加以下 4 个 Secrets：

```bash
# 从 Twilio Console 复制
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here

# WhatsApp Sandbox 号码（固定值）
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# 你的手机号（国际格式）
TWILIO_WHATSAPP_TO=whatsapp:+8613800138000
```

---

## 💰 方案 2: Callmebot（免费方案）

Callmebot 是一个免费的 WhatsApp 通知服务，有每日限制。

### 优点
- ✅ 完全免费
- ✅ 配置简单

### 缺点
- ❌ 每日限制约 10-20 条
- ❌ 消息中有广告
- ❌ 不适合高频通知

### 配置步骤

#### 1. 获取 API Key

1. 在 WhatsApp 中添加 [@callmebot_api](https://wa.me/46706298310)
2. 发送消息 `/start`
3. 按照提示获取 API Key

#### 2. 验证手机号

发送 `/register` 给 bot，按提示验证你的手机号。

#### 3. 添加到 GitHub Secrets

```bash
CALLMEBOT_PHONE=+8613800138000
CALLMEBOT_API_KEY=your_api_key_here
```

---

## 🔧 方案 3: Telegram → WhatsApp 桥接

如果你已经配置了 Telegram，可以使用转发功能。

### 步骤

1. **在 Telegram 中**:
   - 将 Telegram Bot 添加到你的 WhatsApp（需要第三方工具）
   - 或使用 Telegram 的 "Saved Messages" 功能

2. **使用第三方桥接服务**:
   - [Telegram to WhatsApp bridge](https://github.com/phpdave/telegram-to-whatsapp)
   - 需要自己部署服务器

---

## 📊 Twilio 费用估算

### 免费额度
- 注册后赠送 $15 试用额度
- 足够测试和初期使用

### 定价（参考）
| 消息类型 | 单条价格 |
|----------|----------|
| 发送到中国 | ~¥0.30 - ¥0.50 / 条 |
| 发送到美国 | ~¥0.20 - ¥0.35 / 条 |

### 使用量估算
- 每天 2-4 条通知
- 每月约 60-120 条
- 预计每月 ¥20 - ¥60

---

## 🧪 测试通知

### 本地测试

```bash
# 安装依赖
npm install twilio

# 设置环境变量
export TWILIO_ACCOUNT_SID=your_sid
export TWILIO_AUTH_TOKEN=your_token
export TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
export TWILIO_WHATSAPP_TO=whatsapp:+8613800138000

# 测试发送
node scripts/notify-whatsapp.js full
```

### GitHub Actions 测试

1. 进入 **Actions** 标签
2. 选择 **闲鱼黑胶监控** 工作流
3. 点击 **Run workflow** → 选择 `full` 模式
4. 查看运行日志和手机是否收到消息

---

## 🔍 故障排查

### 问题 1: 没有收到消息

**检查清单**:
- [ ] Twilio 账号是否验证
- [ ] 是否加入 WhatsApp Sandbox
- [ ] Secrets 配置是否正确（注意 `whatsapp:` 前缀）
- [ ] 手机号格式是否正确（`+8613800138000`）

### 问题 2: 收到验证码后发送失败

**解决方案**:
```
发送: join <your-sandbox-key>

注意: <your-sandbox-key> 在 Twilio Console WhatsApp Sandbox 页面显示
```

### 问题 3: Callmebot 每日限额用尽

**解决方案**:
- 升级到付费版
- 或切换到 Twilio
- 或减少通知频率

---

## 📝 通知内容示例

### 全量报告（每天8点）

```
📊 闲鱼黑胶监控 - 全量报告

🕐 时间: 2026-02-16 08:00:00

📦 音乐大同: 195 张在售
📦 梦的采摘员: 192 张在售

📈 总计: 387 张
```

### 增量报告（每4小时）

```
🔄 闲鱼黑胶监控 - 增量更新

🕐 时间: 2026-02-16 12:00:00

📦 *音乐大同*
🆕 新上架: *3* 张

最新商品:
1. 米津玄师 - Iris Out/Jane Doe...
2. Laufey - A Matter of Time...
3. Sabrina Carpenter - Evolution...
```

---

## 🎉 完成配置后

1. 手动触发一次测试
2. 确认收到 WhatsApp 消息
3. 自动化任务将按计划运行

享受自动监控的便利！🎊
