/**
 * 闲鱼黑胶唱片抓取脚本 - 包含已售出商品
 * 同时抓取"在售"和"已售出"两个 tab 的数据
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// 使用 stealth 插件隐藏自动化特征
chromium.use(StealthPlugin());

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
 * 点击指定的 tab
 */
async function clickTab(page, tabName) {
  try {
    const tab = await page.locator(`text=${tabName}`).first();
    if (await tab.isVisible({ timeout: 5000 })) {
      await tab.evaluate(el => el.click());
      console.log(`✓ 已点击"${tabName}" tab`);
      await page.waitForTimeout(3000);
      return true;
    }
    return false;
  } catch (e) {
    console.log(`⚠ 点击"${tabName}" tab 失败:`, e.message);
    return false;
  }
}

/**
 * 滚动抓取商品
 */
async function scrapeItems(page, maxRounds = 50) {
  const albums = [];
  let lastCount = 0;
  let stuckCount = 0;

  for (let round = 0; round < maxRounds; round++) {
    // 滚动加载
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2000);

    // 向上滚动一点再向下
    await page.evaluate(() => {
      window.scrollBy(0, -300);
    });
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2000);

    // 提取商品
    const items = await page.evaluate(() => {
      const selectors = ['a[href*="/item?id="]', 'a[href*="itemId="]'];
      let allElements = [];

      for (const selector of selectors) {
        try {
          const found = document.querySelectorAll(selector);
          if (found.length > 0) {
            allElements = allElements.concat(Array.from(found));
          }
        } catch (e) {}
      }

      const uniqueElements = Array.from(new Set(allElements));

      return uniqueElements.map(el => {
        const titleSelectors = [
          '[class*="title"]', '[class*="Title"]', '[class*="name"]', '[class*="Name"]',
          'h1', 'h2', 'h3', 'h4', '.text', 'a'
        ];

        let titleEl = null;
        for (const selector of titleSelectors) {
          titleEl = el.querySelector(selector);
          if (titleEl && titleEl.textContent && titleEl.textContent.trim().length > 5) break;
        }

        const priceSelectors = [
          '[class*="price"]', '[class*="Price"]', '[class*="amount"]', '[class*="Amount"]',
          '[class*="money"]', '[class*="cost"]'
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

        const itemId = link.match(/id=([^&]+)/)?.[1] || link;
        return { title, price, link, id: itemId };
      }).filter(item => item !== null && item.title.length > 3);
    });

    // 去重
    const uniqueItems = [];
    const seenInThisRound = new Set();
    for (const item of items) {
      if (!seenInThisRound.has(item.id)) {
        uniqueItems.push(item);
        seenInThisRound.add(item.id);
      }
    }

    const currentIds = new Set(albums.map(a => a.id));
    for (const item of uniqueItems) {
      if (!currentIds.has(item.id)) {
        albums.push(item);
        currentIds.add(item.id);
      }
    }

    console.log(`  轮次 ${round + 1}: 已抓取 ${albums.length} 张`);

    if (albums.length === lastCount) {
      stuckCount++;
      if (stuckCount >= 5) {
        console.log(`  连续5轮无新数据，停止`);
        break;
      }
    } else {
      stuckCount = 0;
      lastCount = albums.length;
    }

    if (albums.length >= 500) break;
  }

  return albums;
}

/**
 * 抓取单个卖家
 */
async function scrapeSeller(sellerId, browser) {
  const seller = SELLERS[sellerId];
  if (!seller) {
    throw new Error(`未知卖家: ${sellerId}`);
  }

  console.log(`\n📀 开始抓取: ${seller.name}`);
  console.log('='.repeat(50));

  const page = await browser.newPage();

  // 添加反检测脚本
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
    window.chrome = { runtime: {} };
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  });

  await page.setViewportSize({ width: 1920, height: 1080 });

  try {
    await page.goto(seller.url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(5000);

    try {
      await page.waitForFunction(() => {
        const body = document.body;
        return body && body.innerText && body.innerText.length > 1000;
      }, { timeout: 20000 });
    } catch (e) {
      console.log('⚠ 页面内容加载超时');
    }

    try {
      await page.waitForSelector('a[href*="/item?id="]', { timeout: 15000 });
    } catch (e) {
      console.log('⚠ 未检测到商品链接');
    }

    // 关闭弹窗
    try {
      const modalClose = page.locator('.ant-modal-close, .close-modal, [class*="close"]').first();
      if (await modalClose.isVisible({ timeout: 2000 })) {
        await modalClose.click();
        await page.waitForTimeout(500);
      }
    } catch (e) {}

    const result = {
      seller: seller.name,
      scraped_at: new Date().toISOString().slice(0, 10),
      for_sale: { total: 0, albums: [] },
      sold: { total: 0, albums: [] }
    };

    // 抓取"在售"商品
    console.log('\n📦 抓取"在售"商品...');
    if (await clickTab(page, '在售')) {
      result.for_sale.albums = await scrapeItems(page, 30);
      result.for_sale.total = result.for_sale.albums.length;
      console.log(`✓ "在售"商品: ${result.for_sale.total} 张`);
    }

    // 抓取"已售出"商品
    console.log('\n💰 抓取"已售出"商品...');
    if (await clickTab(page, '已售出')) {
      result.sold.albums = await scrapeItems(page, 50);
      result.sold.total = result.sold.albums.length;
      console.log(`✓ "已售出"商品: ${result.sold.total} 张`);
    }

    // 保存数据
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = path.join(__dirname, `../output/${sellerId}_with_sold_${today}.json`);

    fs.writeFileSync(filename, JSON.stringify(result, null, 2), 'utf8');
    console.log(`\n💾 已保存: ${filename}`);

    console.log(`\n✅ ${seller.name} 抓取完成:`);
    console.log(`   在售: ${result.for_sale.total} 张`);
    console.log(`   已售出: ${result.sold.total} 张`);
    console.log(`   总计: ${result.for_sale.total + result.sold.total} 张`);

    return result;

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
  console.log('🎵 闲鱼黑胶唱片抓取 (含已售出)');
  console.log('='.repeat(50));
  console.log(`模式: ${sellerId === 'all' ? '全部卖家' : SELLERS[sellerId]?.name || sellerId}`);
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

    if (sellerId === 'all') {
      for (const id of Object.keys(SELLERS)) {
        try {
          const data = await scrapeSeller(id, browser);
          results.push(data);
        } catch (error) {
          console.error(`抓取 ${id} 失败:`, error.message);
        }
      }
    } else {
      const data = await scrapeSeller(sellerId, browser);
      results.push(data);
    }

    // 输出总结
    console.log('\n' + '='.repeat(50));
    console.log('📊 抓取总结');
    console.log('='.repeat(50));
    results.forEach(r => {
      console.log(`${r.seller}:`);
      console.log(`  在售: ${r.for_sale.total} 张`);
      console.log(`  已售出: ${r.sold.total} 张`);
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
