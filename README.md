# Xianyu Vinyl Record Crawler

闲鱼黑胶唱片爬虫 - 持续监控服务，支持扫码登录，输出JSON格式数据。

## 功能特点

- **扫码登录**: 支持使用淘宝/支付宝扫码登录闲鱼
- **定时监控**: 支持增量爬取（每4小时）和全量爬取（每天凌晨）
- **详细数据**: 采集商品标题、价格、卖家信息、成色、交易方式等
- **反爬虫策略**: UA轮换、请求频率控制、Cookie管理
- **数据导出**: JSON格式导出，支持按条件筛选
- **去重功能**: 自动去重，避免重复数据

## 项目结构

```
xianyu-vinyl-crawler/
├── xianyu_crawler/           # 核心代码
│   ├── spiders/              # 爬虫模块
│   ├── auth/                 # 认证模块（扫码登录、Cookie管理）
│   ├── storage/              # 存储模块（JSON导出、去重）
│   ├── scheduler/            # 定时任务调度
│   └── utils/                # 工具函数
├── scripts/                  # 脚本
│   ├── start.py              # 启动脚本
│   └── export.py             # 导出脚本
├── output/json/              # JSON输出目录
└── data/                     # 数据目录（Cookie、缓存）
```

## 安装

### 1. 克隆或创建项目

```bash
cd C:\Users\chq04\xianyu-vinyl-crawler
```

### 2. 安装依赖

```bash
# 使用 uv 安装依赖
uv sync

# 或使用 pip
pip install -e .
```

### 3. 安装 Playwright 浏览器

```bash
# 安装 Chromium 浏览器
python -m playwright install chromium
```

## 使用方法

### 首次使用 - 扫码登录

```bash
# 运行登录命令
python scripts/start.py --login
```

按照提示操作：
1. 程序会显示二维码图片路径
2. 使用淘宝或支付宝 APP 扫码
3. 确认登录
4. Cookie 将自动保存

### 运行爬虫

```bash
# 运行单次增量爬取（前20页）
python scripts/start.py --crawl incremental

# 运行单次全量爬取（前100页）
python scripts/start.py --crawl full

# 启动定时调度器（持续运行）
python scripts/start.py --scheduler
```

### 导出数据

```bash
# 查看最新导出
python scripts/export.py --latest

# 按价格筛选导出
python scripts/export.py --filter --min-price 100 --max-price 500

# 按想要人数筛选导出
python scripts/export.py --filter --min-want-count 10

# 查看统计信息
python scripts/export.py --stats
```

## 数据字段

| 字段 | 说明 |
|------|------|
| product_id | 商品唯一ID |
| title | 商品标题 |
| price | 价格 |
| link | 商品链接 |
| seller_name | 卖家昵称 |
| seller_credit | 卖家信用分 |
| description | 商品描述 |
| condition | 成色（如"99新"） |
| trade_type | 交易方式（同城/快递） |
| location | 地区 |
| publish_time | 发布时间 |
| view_count | 浏览次数 |
| want_count | 想要人数 |
| images | 图片URL列表 |

## 定时任务

| 任务 | 频率 | 说明 |
|------|------|------|
| 增量爬取 | 每4小时 | 爬取前20页 |
| 全量爬取 | 每天凌晨2点 | 爬取前100页 |
| 数据导出 | 每天早上8点 | 导出JSON数据 |

## 配置

编辑 `xianyu_crawler/settings.py` 可修改：

- 搜索关键词 (`SEARCH_KEYWORDS`)
- 爬取页数 (`MAX_PAGES_INCREMENTAL`, `MAX_PAGES_FULL`)
- 请求延迟 (`DOWNLOAD_DELAY`)
- 定时任务时间 (`SCHEDULER_*`)

## 注意事项

1. **本工具仅供学习研究使用**，请遵守闲鱼平台服务条款
2. 控制爬取频率，避免对服务器造成压力
3. 不得将数据用于商业用途
4. Cookie 有效期约7天，过期后需重新登录

## 故障排查

### 登录失败
- 检查网络连接
- 尝试删除 `data/cookies/cookies.json` 后重新登录

### 爬取失败
- 检查 Cookie 是否有效
- 降低爬取频率（增加 `DOWNLOAD_DELAY`）
- 查看日志输出

### Playwright 错误
```bash
# 重新安装浏览器
python -m playwright install chromium --force
```

## 许可证

MIT License
