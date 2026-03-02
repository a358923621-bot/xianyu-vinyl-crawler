# 闲鱼黑胶唱片监控爬虫

> 自动监控闲鱼黑胶唱片卖家，对比分析商品差异

[![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-Enabled-blue)](.github/workflows/xianyu-monitor.yml)

## 功能特点

- **卖家对比**: 对比两个卖家的在售商品，找出差异
- **商品去重**: 使用商品ID进行去重，避免重复数据
- **反爬虫策略**: Playwright stealth 插件、请求频率控制
- **数据导出**: JSON格式导出，支持卖家对比分析
- **WhatsApp 通知**: 支持定时推送对比结果到 WhatsApp

## 项目结构

```
xianyu-vinyl-crawler/
├── scripts/                  # 脚本目录
│   ├── scrape-full.js        # 全量抓取脚本
│   ├── compare-sellers.js    # 卖家对比脚本
│   └── notify-whatsapp.js    # WhatsApp 通知脚本
├── .github/workflows/        # GitHub Actions 工作流
│   └── xianyu-monitor.yml    # 自动化监控配置
├── output/                   # 输出目录
│   ├── seller_a_*.json       # 卖家A数据
│   ├── seller_b_*.json       # 卖家B数据
│   └── comparison_*.json     # 对比结果
└── package.json              # 项目依赖
```

## 安装

### 1. 安装依赖

```bash
npm install
```

### 2. 安装 Playwright 浏览器

```bash
npx playwright install chromium
```

## 使用方法

### 抓取卖家数据

```bash
# 抓取所有卖家
node scripts/scrape-full.js all

# 只抓取卖家A
node scripts/scrape-full.js seller_a

# 只抓取卖家B
node scripts/scrape-full.js seller_b
```

### 对比卖家数据

```bash
node scripts/compare-sellers.js
```

输出示例：
```
============================================================
📊 卖家商品对比分析
============================================================

卖家A数据: 卖家A (2026-02-21) - 180 张在售
卖家B数据: 卖家B (2026-02-21) - 175 张在售

=== 对比结果 ===

共同商品: 47 张
卖家B独有: 126 张
卖家A独有: 130 张
```

### WhatsApp 通知

```bash
node scripts/notify-whatsapp.js full
```

## 配置卖家信息

编辑 `scripts/scrape-full.js` 中的卖家配置：

```javascript
const SELLERS = {
  seller_a: {
    name: '卖家A',
    url: process.env.SELLER_A_URL || 'https://www.goofish.com/personal?userId=1234567890'
  },
  seller_b: {
    name: '卖家B',
    url: process.env.SELLER_B_URL || 'https://www.goofish.com/personal?userId=0987654321'
  }
};
```

## 数据字段

| 字段 | 说明 |
|------|------|
| seller | 卖家名称 |
| scraped_at | 抓取日期 |
| total | 商品总数 |
| albums | 商品标题列表 |

## GitHub Actions 自动化

### 配置 Secrets

在 GitHub 仓库设置中添加以下 Secrets：

**WhatsApp 通知:**
- `TWILIO_ACCOUNT_SID`: Twilio 账号 SID
- `TWILIO_AUTH_TOKEN`: Twilio 认证令牌
- `TWILIO_WHATSAPP_FROM`: WhatsApp 发送号码
- `TWILIO_WHATSAPP_TO`: 接收手机号

**卖家 URL (可选):**
- `SELLER_A_URL`: 卖家A页面URL
- `SELLER_B_URL`: 卖家B页面URL

### 手动触发

在 GitHub Actions 页面选择 "Run workflow" 可手动执行抓取。

## 注意事项

1. **本工具仅供学习研究使用**，请遵守闲鱼平台服务条款
2. 控制抓取频率，避免对服务器造成压力
3. 不得将数据用于商业用途

## 许可证

MIT License
