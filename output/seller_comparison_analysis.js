const fs = require('fs');

// 读取两个卖家的数据
const yinyuedatong = JSON.parse(fs.readFileSync('C:/Users/chq04/xianyu-vinyl-crawler/output/xianyu_yinyuedatong_complete_172.json', 'utf8'));
const mengde = JSON.parse(fs.readFileSync('C:/Users/chq04/xianyu-vinyl-crawler/output/mengdezhihaiyuan_complete_170.json', 'utf8'));

// 商品标题标准化用于对比
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 检查两个商品是否相似
function isSimilarProduct(p1, p2) {
  // 如果ID相同，肯定是同一商品
  if (p1.id === p2.id) return true;

  const t1 = normalizeTitle(p1.title);
  const t2 = normalizeTitle(p2.title);

  // 简单的相似度检查
  if (t1 === t2) return true;
  if (t2.includes(t1) || t1.includes(t2)) return true;

  return false;
}

// 找出重叠商品
const overlapping = [];
const yinyuedatongOnly = [];
const mengdeOnly = [];

// 已处理的音乐大同商品
const processedYYDT = new Set();

for (const yydt of yinyuedatong.products) {
  let found = false;
  for (const md of mengde.products) {
    if (isSimilarProduct(yydt, md)) {
      overlapping.push({
        title: yydt.title,
        id_yydt: yydt.id,
        id_md: md.id,
        price_yydt: yydt.price,
        price_md: md.price,
        price_diff: md.price - yydt.price,
        wantCount_yydt: yydt.wantCount,
        within24Hours_yydt: yydt.within24Hours,
        within24Hours_md: md.within24Hours
      });
      found = true;
      processedYYDT.add(yydt.id);
      break;
    }
  }
  if (!found) {
    yinyuedatongOnly.push(yydt);
    processedYYDT.add(yydt.id);
  }
}

// 梦的采摘员独有商品
for (const md of mengde.products) {
  let found = false;
  for (const yydt of yinyuedatong.products) {
    if (isSimilarProduct(yydt, md)) {
      found = true;
      break;
    }
  }
  if (!found) {
    mengdeOnly.push(md);
  }
}

// 统计24小时内上架的商品
const yydt24h = yinyuedatong.products.filter(p => p.within24Hours);
const md24h = mengde.products.filter(p => p.within24Hours);

// 价格区间分析
function getPriceRange(products) {
  const prices = products.map(p => parseInt(p.price) || 0);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  };
}

const result = {
  summary: {
    yinyuedatong: {
      total: yinyuedatong.total_products_extracted,
      within24h: yydt24h.length,
      priceRange: getPriceRange(yinyuedatong.products)
    },
    mengde: {
      total: mengde.total_products_extracted,
      within24h: md24h.length,
      priceRange: getPriceRange(mengde.products)
    },
    overlapping: overlapping.length,
    yinyuedatongOnly: yinyuedatongOnly.length,
    mengdeOnly: mengdeOnly.length
  },
  overlapping_products: overlapping.sort((a, b) => b.price_diff - a.price_diff),
  yinyuedatong_only: yinyuedatongOnly.sort((a, b) => (b.wantCount || 0) - (a.wantCount || 0)).slice(0, 20),
  mengde_only: mengdeOnly.sort((a, b) => (b.within24Hours ? 1 : 0) - (a.within24Hours ? 1 : 0)).slice(0, 20)
};

console.log(JSON.stringify(result, null, 2));

// 输出报告
console.log('\n========== 两个咸鱼卖家商品对比报告 ==========\n');
console.log(`音乐大同: ${yinyuedatong.total_products_extracted}件在售商品`);
console.log(`梦的采摘员: ${mengde.total_products_extracted}件在售商品`);
console.log(`\n重叠商品: ${overlapping.length}件`);
console.log(`音乐大同独有: ${yinyuedatongOnly.length}件`);
console.log(`梦的采摘员独有: ${mengdeOnly.length}件`);
console.log(`\n24小时内上架:`);
console.log(`  音乐大同: ${yydt24h.length}件`);
console.log(`  梦的采摘员: ${md24h.length}件`);
console.log(`\n价格差异最大的重叠商品:`);
overlapping.slice(0, 5).forEach(p => {
  console.log(`  ${p.title}`);
  console.log(`    音乐大同: ¥${p.price_yydt} | 梦的采摘员: ¥${p.price_md} (差价 +¥${p.price_diff})`);
});

fs.writeFileSync('C:/Users/chq04/xianyu-vinyl-crawler/output/sellers_comparison_final.json', JSON.stringify(result, null, 2), 'utf8');
