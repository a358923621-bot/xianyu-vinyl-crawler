/**
 * 闲鱼黑胶唱片全量抓取脚本
 * 支持指定卖家抓取
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// 使用 stealth 插件隐藏自动化特征
chromium.use(StealthPlugin());

// 卖家配置 - 使用个人主页 URL
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

  // 存储 API 响应数据
  const apiData = [];

  // 监听 API 响应
  page.on('response', async (response) => {
    const url = response.url();
    // 捕获包含商品数据的 API 响应
    if (url.includes('search') || url.includes('item') || url.includes('list') || url.includes('product')) {
      try {
        const contentType = response.headers()['content-type'];
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          apiData.push({ url, data });
          console.log(`✓ 捕获 API 响应: ${url.substring(0, 80)}...`);
        }
      } catch (e) {
        // 忽略非 JSON 响应
      }
    }
  });

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

  // 设置 viewport
  await page.setViewportSize({ width: 1920, height: 1080 });

  try {
    // 访问卖家页面 - 等待加载完成
    await page.goto(seller.url, { waitUntil: 'load', timeout: 60000 });

    // 等待 React 渲染完成
    await page.waitForTimeout(5000);

    // 尝试等待搜索结果容器
    try {
      await page.waitForFunction(() => {
        // 等待页面中有实际内容
        const body = document.body;
        return body && body.innerText && body.innerText.length > 1000;
      }, { timeout: 20000 });
      console.log('✓ 页面内容已加载');
    } catch (e) {
      console.log('⚠ 页面内容加载超时，继续尝试...');
    }

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

    // 调试：输出页面 URL 和标题
    try {
      const currentUrl = page.url();
      const pageTitle = await page.title();
      console.log(`当前页面: ${currentUrl}`);
      console.log(`页面标题: ${pageTitle}`);
    } catch (e) {
      console.log('⚠ 无法获取页面信息:', e.message);
    }

    // 调试：保存捕获的 API 数据（优先保存以防崩溃）
    const fs = require('fs');
    if (apiData.length > 0) {
      const apiDebugPath = __dirname + '/../output/debug-api.json';
      fs.writeFileSync(apiDebugPath, JSON.stringify(apiData, null, 2), 'utf8');
      console.log(`✓ 捕获 ${apiData.length} 个 API 响应，已保存到: ${apiDebugPath}`);

      // 尝试从 API 数据提取商品信息
      for (const api of apiData) {
        if (api.data && api.data.data) {
          const items = api.data.data.items || api.data.data.list || api.data.data;
          if (Array.isArray(items)) {
            console.log(`✓ 从 API 提取到 ${items.length} 个商品`);
          }
        }
      }
    } else {
      console.log('⚠ 未捕获到 API 响应，尝试 DOM 解析...');
    }

    // 调试：保存页面 HTML 到文件用于分析
    try {
      const pageHtml = await page.content();
      const debugPath = __dirname + '/../output/debug-page.html';
      fs.writeFileSync(debugPath, pageHtml, 'utf8');
      console.log(`页面 HTML 已保存到: ${debugPath}`);
    } catch (e) {
      console.log('⚠ 无法保存页面 HTML:', e.message);
    }

    // 激进滚动策略 - 滚动到页面底部触发无限加载
    const albums = [];
    let lastCount = 0;
    let stuckCount = 0;

    for (let round = 0; round < 200; round++) {
      // 滚动到页面底部，然后回滚一点
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(3000);

      // 向上滚动一点，再向下滚动，触发加载
      await page.evaluate(() => {
        window.scrollBy(0, -500);
      });
      await page.waitForTimeout(1000);

      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(3000);

      // 提取当前页面的商品 - 只使用商品链接选择器
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

      // 再与已有 albums 去重
      const currentIds = new Set(albums.map(a => a.id));
      for (const item of uniqueItems) {
        if (!currentIds.has(item.id)) {
          albums.push(item);
          currentIds.add(item.id);
        }
      }

      console.log(`轮次 ${round + 1}: 已抓取 ${albums.length} 张`);

      // 检查是否没有新数据
      if (albums.length === lastCount) {
        stuckCount++;
        if (stuckCount >= 10) {
          console.log('连续10轮无新数据，停止抓取');
          break;
        }
      } else {
        stuckCount = 0;
        lastCount = albums.length;
      }

      // 如果达到预期数量，可以提前停止
      if (albums.length >= 250) {
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
