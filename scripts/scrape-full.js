/**
 * 闲鱼黑胶唱片全量抓取脚本
 * 支持指定卖家抓取
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// 卖家配置
const SELLERS = {
  yinyuedatong: {
    name: '音乐大同',
    url: process.env.YINYUEDATONG_URL || 'https://www.goofish.com/personal?userId=2219735146783'
  },
  mengde: {
    name: '梦的采摘员',
    url: process.env.MENGDE_URL || 'https://www.goofish.com/personal?userId=1059107164'
  }
};

/**
 * 抓取单个卖家数据
 */
async function scrapeSeller(sellerId, browser) {
  const seller = SELLERS[sellerId];
  if (!seller) {
    throw new Error(`未知卖家: ${sellerId}`);
  }

  console.log(`\n📀 开始抓取: ${seller.name}`);
  console.log('='.repeat(50));

  const page = await browser.newPage();

  try {
    // 访问卖家页面
    await page.goto(seller.url, { waitUntil: 'networkidle', timeout: 60000 });

    // 等待页面加载
    await page.waitForTimeout(3000);

    // 激进滚动策略
    const albums = [];
    let lastCount = 0;
    let stuckCount = 0;

    for (let round = 0; round < 100; round++) {
      // 滚动20次，每次300px
      for (let j = 0; j < 20; j++) {
        await page.evaluate(() => window.scrollBy(0, 300));
        await page.waitForTimeout(200);
      }
      await page.waitForTimeout(1500);

      // 提取当前页面的商品 - 使用更全面的选择器
      const items = await page.evaluate(() => {
        // 尝试多种选择器策略
        const selectors = [
          // Goofish/闲鱼 specific selectors
          '[class*="SearchItem"]',
          '[class*="search-item"]',
          '[class*="CardItem"]',
          '[class*="card-item"]',
          '[class*="ItemCard"]',
          '[class*="item-card"]',
          // 通用商品卡片
          '[class*="goods"]',
          '[class*="product"]',
          '[class*="Item"]',
          // 闲鱼特定
          '.sell-item',
          '[data-testid*="item"]',
          '[class*="Gm"]', // 闲鱼常用前缀
        ];

        let allElements = [];
        for (const selector of selectors) {
          try {
            const found = document.querySelectorAll(selector);
            if (found.length > 0) {
              allElements = allElements.concat(Array.from(found));
            }
          } catch (e) {
            // 忽略无效选择器
          }
        }

        // 去重
        const uniqueElements = Array.from(new Set(allElements));

        return uniqueElements.map(el => {
          // 尝试多种方式获取标题
          const titleSelectors = [
            '[class*="title"]',
            '[class*="Title"]',
            '[class*="name"]',
            '[class*="Name"]',
            'h1', 'h2', 'h3', 'h4',
            '.text',
            'a',
          ];

          let titleEl = null;
          for (const selector of titleSelectors) {
            titleEl = el.querySelector(selector);
            if (titleEl && titleEl.textContent && titleEl.textContent.trim().length > 5) {
              break;
            }
          }

          // 尝试多种方式获取价格
          const priceSelectors = [
            '[class*="price"]',
            '[class*="Price"]',
            '[class*="amount"]',
            '[class*="Amount"]',
            '[class*="money"]',
            '[class*="cost"]',
          ];

          let priceEl = null;
          for (const selector of priceSelectors) {
            priceEl = el.querySelector(selector);
            if (priceEl) break;
          }

          // 获取链接
          const linkEl = el.querySelector('a') || el.closest('a');

          const title = titleEl?.textContent?.trim() || '';
          const price = priceEl?.textContent?.trim() || '';
          const link = linkEl?.href || '';

          // 过滤掉无效结果
          if (!title || title.length < 3) return null;
          // 过滤掉导航菜单等非商品项
          if (title.includes('首页') || title.includes('返回') || title.includes('登录')) return null;

          return { title, price, link };
        }).filter(item => item !== null && item.title.length > 3);
      });

      // 去重并添加
      const currentTitles = new Set(albums.map(a => a.title));
      for (const item of items) {
        if (!currentTitles.has(item.title)) {
          albums.push(item);
          currentTitles.add(item.title);
        }
      }

      console.log(`轮次 ${round + 1}: 已抓取 ${albums.length} 张`);

      // 检查是否没有新数据
      if (albums.length === lastCount) {
        stuckCount++;
        if (stuckCount >= 3) {
          console.log('连续3轮无新数据，停止抓取');
          break;
        }
      } else {
        stuckCount = 0;
        lastCount = albums.length;
      }

      // 如果达到预期数量，可以提前停止
      if (albums.length >= 200) {
        console.log('已抓取足够数据，停止');
        break;
      }
    }

    console.log(`\n✅ ${seller.name} 抓取完成: ${albums.length} 张`);

    // 保存数据
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = path.join(__dirname, `../output/${sellerId}_${today}.json`);

    const data = {
      seller: seller.name,
      scraped_at: new Date().toISOString().slice(0, 10),
      total: albums.length,
      albums: albums.map(a => a.title)
    };

    fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf8');
    console.log(`💾 已保存: ${filename}`);

    return data;

  } catch (error) {
    console.error(`❌ 抓取失败: ${error.message}`);
    throw error;
  } finally {
    await page.close();
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const sellerId = args[0] || 'all';

  console.log('='.repeat(50));
  console.log('🎵 闲鱼黑胶唱片全量抓取');
  console.log('='.repeat(50));
  console.log(`模式: ${sellerId === 'all' ? '全部卖家' : SELLERS[sellerId]?.name || sellerId}`);
  console.log(`时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);

  // 创建输出目录
  const outputDir = path.join(__dirname, '../output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 启动浏览器
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  try {
    const results = [];

    if (sellerId === 'all') {
      // 抓取所有卖家
      for (const id of Object.keys(SELLERS)) {
        try {
          const data = await scrapeSeller(id, browser);
          results.push(data);
        } catch (error) {
          console.error(`抓取 ${id} 失败:`, error.message);
        }
      }
    } else {
      // 抓取指定卖家
      const data = await scrapeSeller(sellerId, browser);
      results.push(data);
    }

    // 输出总结
    console.log('\n' + '='.repeat(50));
    console.log('📊 抓取总结');
    console.log('='.repeat(50));
    results.forEach(r => {
      console.log(`${r.seller}: ${r.total} 张`);
    });

  } finally {
    await browser.close();
  }
}

// 运行
main().catch(error => {
  console.error(' fatal error:', error);
  process.exit(1);
});
