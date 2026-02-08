/**
 * 闲鱼黑胶卖家对比技能 - JavaScript版本
 * 配合 Playwright MCP 使用
 */

// ============ 配置 ============
const CONFIG = {
  seller1: {
    id: '2219735146783',
    name: '音乐大同'
  },
  seller2: {
    id: '1059107164',
    name: '梦的采摘员'
  },
  baseUrl: 'https://www.goofish.com'
};

// ============ 标题标准化 ============
function normalizeTitle(title) {
  return title.toLowerCase()
    .replace(/[·•:：,，、""''「」『』【】《（）\(\)]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/黑胶|唱片|专辑|新专辑|限量|带独立编号|带编|日版|台版|cd|lp|1lp|2lp|双|三/g, '')
    .replace(/彩胶|紫胶|红胶|黄胶|绿胶|金胶|灰胶|蓝胶|白胶|透明胶|动画胶/g, '')
    .replace(/电影原声|买家评价|预定|现货|粉丝更优惠|2人小刀价/g, '')
    .replace(/人气第|热销第|\d+名/g, '')
    .replace(/24小时内发布|48小时内发布|72小时内发布|一周内发布/g, '')
    .trim();
}

// ============ 判断是否相同专辑 ============
function isSameAlbum(title1, title2) {
  const n1 = normalizeTitle(title1);
  const n2 = normalizeTitle(title2);

  if (n1 === n2) return true;
  if (n1.length > 10 && n2.includes(n1)) return true;
  if (n2.length > 10 && n1.includes(n2)) return true;
  return false;
}

// ============ 提取专辑标题（清理版） ============
function cleanAlbumTitle(rawTitle) {
  return rawTitle
    .replace(/¥\s*\d+/g, '')
    .replace(/\d+人想要/g, '')
    .replace(/24小时内发布|48小时内发布|72小时内发布|一周内发布/g, '')
    .replace(/热销第\d+名|人气第\d+名/g, '')
    .replace(/买家评价["'][^"']*["']/g, '')
    .replace(/预定|现货|粉丝更优惠/g, '')
    .replace(/2人小刀价/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============ 抓取卖家数据 ============
async function scrapeSeller(page, sellerId) {
  // 导航到卖家页面
  await page.goto(`${CONFIG.baseUrl}/personal?userId=${sellerId}`);

  // 等待页面加载
  await page.waitForTimeout(2000);

  // 点击"在售"标签
  await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent === '在售') {
        let parent = node.parentElement;
        while (parent && parent !== document.body) {
          if (parent.classList.contains('tab') || parent.getAttribute('role') === 'tab') {
            parent.click();
            return;
          }
          parent = parent.parentElement;
        }
        if (node.parentElement) node.parentElement.click();
        break;
      }
    }
  });

  await page.waitForTimeout(2000);

  // 滚动加载所有商品
  await page.evaluate(async () => {
    for (let round = 0; round < 15; round++) {
      for (let i = 0; i < 10; i++) {
        window.scrollBy(0, 500);
        await new Promise(r => setTimeout(r, 100));
      }
      await new Promise(r => setTimeout(r, 500));
    }
  });

  // 提取商品数据
  return await page.evaluate(() => {
    const seen = new Set();
    const products = [];

    document.querySelectorAll('a[href*="item?id="]').forEach(link => {
      const id = link.href.match(/id=(\d+)/)?.[1];
      if (!id || seen.has(id)) return;
      seen.add(id);

      let text = (link.innerText || '').trim();
      if (text.length < 5) return;

      let title = text
        .replace(/¥\s*\d+/g, '')
        .replace(/\d+人想要/g, '')
        .replace(/24小时内发布|48小时内发布|72小时内发布|一周内发布/g, '')
        .replace(/热销第\d+名|人气第\d+名/g, '')
        .replace(/买家评价["'][^"']*["']/g, '')
        .replace(/预定|现货|粉丝更优惠/g, '')
        .replace(/2人小刀价/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (title.length > 5) {
        products.push({ id, title });
      }
    });

    return products;
  });
}

// ============ 对比数据 ============
function compareSellers(seller1Data, seller2Data) {
  const processedS1 = new Set();
  const processedS2 = new Set();

  const overlapping = [];
  const s1Only = [];
  const s2Only = [];

  // 找出重叠和seller1独有
  for (const p1 of seller1Data) {
    if (processedS1.has(p1.title)) continue;
    processedS1.add(p1.title);

    let found = false;
    for (const p2 of seller2Data) {
      if (processedS2.has(p2.title)) continue;
      if (isSameAlbum(p1.title, p2.title)) {
        overlapping.push(p1.title);
        processedS2.add(p2.title);
        found = true;
        break;
      }
    }
    if (!found) {
      s1Only.push(p1.title);
    }
  }

  // 找出seller2独有
  for (const p2 of seller2Data) {
    if (!processedS2.has(p2.title)) {
      s2Only.push(p2.title);
    }
  }

  return { overlapping, seller1Only: s1Only, seller2Only: s2Only };
}

// ============ 打印报告 ============
function printReport(result, seller1Name, seller2Name) {
  console.log('\n' + '='.repeat(40));
  console.log('   闲鱼卖家黑胶唱片对比');
  console.log('='.repeat(40) + '\n');

  console.log('【统计】');
  console.log(`  ${seller1Name}: ${result.seller1Only.length + result.overlapping.length} 张`);
  console.log(`  ${seller2Name}: ${result.seller2Only.length + result.overlapping.length} 张`);
  console.log(`  重叠: ${result.overlapping.length} 张`);
  console.log(`  ${seller1Name}独有: ${result.seller1Only.length} 张`);
  console.log(`  ${seller2Name}独有: ${result.seller2Only.length} 张`);

  console.log(`\n【重叠专辑】(${result.overlapping.length}张)`);
  result.overlapping.forEach((album, i) => {
    console.log(`  ${i+1}. ${album.substring(0, 55)}`);
  });

  console.log(`\n【${seller1Name}独有专辑】(${result.seller1Only.length}张)`);
  result.seller1Only.forEach((album, i) => {
    console.log(`  ${i+1}. ${album.substring(0, 55)}`);
  });

  console.log(`\n【${seller2Name}独有专辑】(${result.seller2Only.length}张)`);
  result.seller2Only.forEach((album, i) => {
    console.log(`  ${i+1}. ${album.substring(0, 55)}`);
  });

  console.log('\n' + '='.repeat(40) + '\n');
}

// ============ 导出接口 ============
module.exports = {
  CONFIG,
  normalizeTitle,
  isSameAlbum,
  cleanAlbumTitle,
  scrapeSeller,
  compareSellers,
  printReport
};
