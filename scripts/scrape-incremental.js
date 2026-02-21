/**
 * 闲鱼黑胶唱片增量抓取脚本
 * 只抓取前20页，快速检测新上架商品
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// 使用 stealth 插件隐藏自动化特征
chromium.use(StealthPlugin());

// 卖家配置 - 使用个人主页 URL
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

  // 添加反检测脚本
  await page.addInitScript(() => {
    // 隐藏 webdriver 属性
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // 伪造 plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // 伪造 languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['zh-CN', 'zh', 'en'],
    });

    // 伪装 Chrome 对象
    window.chrome = {
      runtime: {},
    };

    // 伪造 permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  });

  // 设置 User-Agent 和 viewport
  const context = page.context();
  await context.route('**/*', (route) => {
    const headers = route.request().headers() || {};
    headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    headers['Accept-Language'] = 'zh-CN,zh;q=0.9,en;q=0.8';
    route.continue({ headers });
  });

  await page.setViewportSize({ width: 1920, height: 1080 });

  try {
    await page.goto(seller.url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    // 等待商品链接出现（显式等待）
    try {
      await page.waitForSelector('a[href*="/item?id="]', { timeout: 15000 });
      console.log('✓ 检测到商品链接');
    } catch (e) {
      console.log('⚠ 未检测到标准商品链接，尝试其他选择器');
    }

    // 点击"在售" tab 以过滤掉已售出商品
    try {
      console.log('尝试点击"在售" tab...');

      // 先尝试关闭可能出现的登录弹窗
      try {
        const modalClose = page.locator('.ant-modal-close, .close-modal, [class*="close"]').first();
        if (await modalClose.isVisible({ timeout: 2000 })) {
          await modalClose.click();
          console.log('✓ 已关闭弹窗');
          await page.waitForTimeout(500);
        }
      } catch (e) {
        // 没有弹窗或关闭失败，继续
      }

      // 查找包含"在售"文本的 tab 元素并点击
      const forSaleTab = await page.locator('text=在售').first();
      if (await forSaleTab.isVisible({ timeout: 5000 })) {
        // 使用 JavaScript 点击以避免被拦截
        await forSaleTab.evaluate(el => el.click());
        console.log('✓ 已点击"在售" tab');
        await page.waitForTimeout(3000); // 等待内容更新
      } else {
        console.log('⚠ "在售" tab 不可见，可能已经在该页面');
      }
    } catch (e) {
      console.log('⚠ 点击"在售" tab 失败:', e.message);
    }

    const albums = [];
    const newAlbums = [];

    // 滚动50轮 - 使用底部滚动策略
    for (let round = 0; round < 50; round++) {
      // 滚动到页面底部，然后回滚一点
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(2000);

      // 向上滚动一点，再向下滚动，触发加载
      await page.evaluate(() => {
        window.scrollBy(0, -500);
      });
      await page.waitForTimeout(500);

      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(2000);

      const items = await page.evaluate(() => {
        // 只使用商品链接选择器，避免重复
        const selectors = [
          'a[href*="/item?id="]',  // 主要选择器
          'a[href*="itemId="]',    // 备用
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
          // 过滤掉已售出/已下架商品 - 检查元素文本
          const elementText = el.textContent || '';
          if (elementText.includes('已售') || elementText.includes('已下架') || elementText.includes('售罄')) return null;

          // 提取商品 ID 用于去重
          const itemId = link.match(/id=([^&]+)/)?.[1] || link;
          return { title, price, link, id: itemId };
        }).filter(item => item !== null && item.title.length > 3);
      });

      // 先对 items 数组内部去重（同一商品可能有多个链接元素）
      const uniqueItems = [];
      const seenInThisRound = new Set();
      for (const item of items) {
        if (!seenInThisRound.has(item.id)) {
          uniqueItems.push(item);
          seenInThisRound.add(item.id);
        }
      }

      // 再去重并检测新商品 - 使用商品 ID
      const currentIds = new Set(albums.map(a => a.id));
      for (const item of uniqueItems) {
        if (!currentIds.has(item.id)) {
          const isNew = !historicalAlbums.has(item.title);
          albums.push({ ...item, isNew });
          currentIds.add(item.id);

          if (isNew) {
            newAlbums.push(item);
          }
        }
      }

      console.log(`轮次 ${round + 1}: 已抓取 ${albums.length} 张, 新发现 ${newAlbums.length} 张`);

      // 提前停止条件 - 提高到250条
      if (albums.length >= 250) {
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
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
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
