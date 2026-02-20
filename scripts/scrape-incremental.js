/**
 * 闲鱼黑胶唱片增量抓取脚本
 * 只抓取前20页，快速检测新上架商品
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// 卖家配置
const SELLERS = {
  yinyuedatong: {
    name: '音乐大同',
    url: process.env.YINYUEDATONG_URL || 'https://www.goofish.com/search?q=音乐大同&category=黑胶唱片'
  },
  mengde: {
    name: '梦的采摘员',
    url: process.env.MENGDE_URL || 'https://www.goofish.com/search?q=梦的采摘员&category=黑胶唱片'
  }
};

/**
 * 加载历史数据
 */
function loadHistoricalData(sellerId) {
  const outputDir = path.join(__dirname, '../output');
  const files = fs.readdirSync(outputDir)
    .filter(f => f.startsWith(sellerId) && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length > 0) {
    const latestFile = path.join(outputDir, files[0]);
    const data = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
    return new Set(data.albums || []);
  }

  return new Set();
}

/**
 * 增量抓取单个卖家
 */
async function scrapeIncremental(sellerId, browser) {
  const seller = SELLERS[sellerId];
  if (!seller) {
    throw new Error(`未知卖家: ${sellerId}`);
  }

  console.log(`\n🔄 增量抓取: ${seller.name}`);

  // 加载历史数据
  const historicalAlbums = loadHistoricalData(sellerId);
  console.log(`历史数据: ${historicalAlbums.size} 张`);

  const page = await browser.newPage();

  try {
    await page.goto(seller.url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    const albums = [];
    const newAlbums = [];

    // 只滚动20轮
    for (let round = 0; round < 20; round++) {
      for (let j = 0; j < 20; j++) {
        await page.evaluate(() => window.scrollBy(0, 300));
        await page.waitForTimeout(150);
      }
      await page.waitForTimeout(1000);

      const items = await page.evaluate(() => {
        // 尝试多种选择器策略
        const selectors = [
          '[class*="SearchItem"]',
          '[class*="search-item"]',
          '[class*="CardItem"]',
          '[class*="card-item"]',
          '[class*="ItemCard"]',
          '[class*="item-card"]',
          '[class*="goods"]',
          '[class*="product"]',
          '[class*="Item"]',
          '.sell-item',
          '[data-testid*="item"]',
          '[class*="Gm"]',
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

        const uniqueElements = Array.from(new Set(allElements));

        return uniqueElements.map(el => {
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

          const linkEl = el.querySelector('a') || el.closest('a');

          const title = titleEl?.textContent?.trim() || '';
          const price = priceEl?.textContent?.trim() || '';
          const link = linkEl?.href || '';

          if (!title || title.length < 3) return null;
          if (title.includes('首页') || title.includes('返回') || title.includes('登录')) return null;

          return { title, price, link };
        }).filter(item => item !== null && item.title.length > 3);
      });

      // 去重并检测新商品
      const currentTitles = new Set(albums.map(a => a.title));
      for (const item of items) {
        if (!currentTitles.has(item.title)) {
          const isNew = !historicalAlbums.has(item.title);
          albums.push({ ...item, isNew });
          currentTitles.add(item.title);

          if (isNew) {
            newAlbums.push(item);
          }
        }
      }

      console.log(`轮次 ${round + 1}: 已抓取 ${albums.length} 张, 新发现 ${newAlbums.length} 张`);

      // 提前停止条件
      if (albums.length >= 100) {
        break;
      }
    }

    // 如果有新商品，保存完整数据
    if (newAlbums.length > 0 || albums.length > 0) {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = path.join(__dirname, `../output/${sellerId}_${today}.json`);

      const data = {
        seller: seller.name,
        scraped_at: new Date().toISOString().slice(0, 10),
        total: albums.length,
        new_items: newAlbums.length,
        albums: albums.map(a => a.title)
      };

      fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf8');
    }

    console.log(`\n✅ ${seller.name}: ${albums.length} 张 (新增: ${newAlbums.length} 张)`);

    return {
      seller: seller.name,
      total: albums.length,
      newItems: newAlbums,
      newCount: newAlbums.length
    };

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
  console.log('🔄 闲鱼黑胶唱片增量抓取');
  console.log('='.repeat(50));
  console.log(`时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);

  const outputDir = path.join(__dirname, '../output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  try {
    const results = [];
    let totalNew = 0;

    const sellersToScrape = sellerId === 'all' ? Object.keys(SELLERS) : [sellerId];

    for (const id of sellersToScrape) {
      try {
        const result = await scrapeIncremental(id, browser);
        results.push(result);
        totalNew += result.newCount;
      } catch (error) {
        console.error(`抓取 ${id} 失败:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 增量抓取总结');
    console.log('='.repeat(50));
    results.forEach(r => {
      console.log(`${r.seller}: 新增 ${r.newCount} 张`);
    });
    console.log(`总计新增: ${totalNew} 张`);

    // 返回新增数量，供后续步骤使用
    if (totalNew > 0) {
      console.log('\n🆕 发现新商品，建议发送通知');
    }

  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(' fatal error:', error);
  process.exit(1);
});
