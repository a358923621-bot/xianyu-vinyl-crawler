/**
 * 卖家商品对比分析
 * 统计卖家B从卖家A采购的商品（卖家B在售 + 卖家A已下架/售罄）
 */

const fs = require('fs');
const path = require('path');

// 标题标准化（用于对比）
function normalize(title) {
  let t = title;
  // 移除所有括号内容
  t = t.replace(/【[^【】]*】/g, '');
  t = t.replace(/\[[^\[\]]*\]/g, '');
  t = t.replace(/（[^（））)]*）/g, '');
  t = t.replace(/\([^()]*\)/g, '');

  // 移除前缀
  t = t.replace(/^[【\[（(]?\s*(预定|现货|特价|RSD|在途|包顺丰|含|带)[^\】\]）)]*[】\]）)]?\s*/gi, '');

  // 移除格式后缀
  t = t.replace(/\s+(七吋|十吋|十二吋|双黑胶|三黑胶|三彩胶|黑胶|2LP|3LP|LP|1LP|2L|3L|彩胶|透明胶|红胶|黄胶|蓝胶|紫胶|金胶|绿胶|白胶|粉红胶|橙胶|米色|珍珠白|黑冰|喷溅|画胶|动画胶|签名版|限量版|限量|编号版|带编号|带独立编号|国际版|日版|台版|港版|中文版|全新未拆|官配|加曲版|追加版|豪华版|十周年|二十周年)(\s*$|[^a-zA-Z0-9\u4e00-\u9fff])/gi, ' ');

  // 移除年份
  t = t.replace(/\s+RSD\s*\d+\s*/gi, ' ');
  t = t.replace(/\s+\(?\d{4}\)?\s*$/g, ' ');

  // 移除原声后缀
  t = t.replace(/\s+(电影原声|游戏原声|动画原声|原声|原声带|OST|歌曲原声|音乐精选|配乐)(\s+[^a-zA-Z0-9\u4e00-\u9fff])?/gi, ' ');

  // 标准化
  t = t.replace(/\s+/g, ' ').trim();
  t = t.replace(/\s*-\s*/g, ' - ');
  t = t.replace(/[\/\-:：,，、。!\s]+$/, '').trim();

  if (t.length < 5) return title;
  return t;
}

// 提取关键词（用于模糊匹配）
function extractKeywords(title) {
  let t = normalize(title);
  t = t.toLowerCase();
  return t.substring(0, 45);
}

/**
 * 查找匹配的商品
 */
function findMatch(title, sellerTitles, matched) {
  const norm = normalize(title);
  const kw = extractKeywords(title);

  // 1. 完全匹配
  for (const other of sellerTitles) {
    if (matched.has(other)) continue;
    if (norm === normalize(other)) {
      return { title: other, method: 'exact' };
    }
  }

  // 2. 关键词匹配
  for (const other of sellerTitles) {
    if (matched.has(other)) continue;
    if (kw === extractKeywords(other)) {
      return { title: other, method: 'keyword' };
    }
  }

  // 3. 包含匹配
  for (const other of sellerTitles) {
    if (matched.has(other)) continue;
    const otherNorm = normalize(other);
    const lenDiff = Math.abs(norm.length - otherNorm.length) / Math.max(norm.length, otherNorm.length);
    if ((norm.includes(otherNorm) || otherNorm.includes(norm)) && lenDiff < 0.2 && norm.length > 15) {
      return { title: other, method: 'contains' };
    }
  }

  return null;
}

/**
 * 主分析函数
 */
function analyzeSellers() {
  const outputDir = path.join(__dirname, '../output');

  // 读取最新的两个卖家数据 - 优先使用日期格式文件
  const allFiles = fs.readdirSync(outputDir)
    .filter(f => f.endsWith('.json'));

  // 优先选择日期格式的文件 (yinyuedatong_YYYYMMDD.json)，并按日期降序排序
  const getDateFiles = (prefix) => {
    // 匹配日期格式文件 - 直接用字符串匹配
    const dateFiles = allFiles
      .filter(f => f.startsWith(prefix) && f.match(/_\d{8}\.json$/))
      .map(f => {
        const match = f.match(/_(\d{8})\.json$/);
        return { file: f, date: parseInt(match[1]) };
      })
      .sort((a, b) => b.date - a.date)  // 日期降序
      .map(obj => obj.file);

    if (dateFiles.length > 0) return dateFiles;

    // 如果没有日期格式文件，返回所有该前缀的文件
    return allFiles.filter(f => f.startsWith(prefix)).sort().reverse();
  };

  const sellerAFiles = getDateFiles('seller_a_');
  const sellerBFiles = getDateFiles('seller_b_');

  if (sellerAFiles.length === 0 || sellerBFiles.length === 0) {
    console.log('❌ 缺少卖家数据文件');
    console.log('请先运行: node scripts/scrape-full.js all');
    return;
  }

  const sellerAData = JSON.parse(fs.readFileSync(path.join(outputDir, sellerAFiles[0]), 'utf8'));
  const sellerBData = JSON.parse(fs.readFileSync(path.join(outputDir, sellerBFiles[0]), 'utf8'));

  console.log('='.repeat(60));
  console.log('📊 卖家商品对比分析');
  console.log('='.repeat(60));
  console.log(`卖家A数据: ${sellerAData.seller} (${sellerAData.scraped_at}) - ${sellerAData.total} 张在售`);
  console.log(`卖家B数据: ${sellerBData.seller} (${sellerBData.scraped_at}) - ${sellerBData.total} 张在售`);
  console.log('');

  // 统计：卖家B在售但卖家A没有的商品
  const sellerATitles = new Set(sellerAData.albums);
  const matchedSellerB = new Set();

  const sellerBOnly = [];
  const sellerBFromA = []; // 可能从卖家A采购的

  for (const sellerBTitle of sellerBData.albums) {
    const match = findMatch(sellerBTitle, sellerAData.albums, matchedSellerB);

    if (match) {
      matchedSellerB.add(match.title);
      // 记录匹配关系
      sellerBFromA.push({
        sellerB: sellerBTitle,
        sellerA: match.title,
        method: match.method
      });
    } else {
      sellerBOnly.push(sellerBTitle);
    }
  }

  const matchedSellerA = new Set(sellerBFromA.map(m => m.sellerA));
  const sellerAOnly = sellerAData.albums.filter(t => !matchedSellerA.has(t));

  console.log('=== 对比结果 ===\n');
  console.log(`共同商品: ${sellerBFromA.length} 张`);
  console.log(`卖家B独有: ${sellerBOnly.length} 张`);
  console.log(`卖家A独有: ${sellerAOnly.length} 张`);
  console.log('');

  // 输出共同商品列表
  console.log('=== 共同商品列表 ===\n');
  sellerBFromA.forEach((item, i) => {
    console.log(`${i + 1}. ${normalize(item.sellerA)}`);
    if (item.sellerB !== item.sellerA) {
      console.log(`   卖家A: ${item.sellerA}`);
      console.log(`   卖家B: ${item.sellerB} [${item.method}]`);
    }
  });

  // 保存对比结果
  const result = {
    analyzed_at: new Date().toISOString(),
    seller_a: {
      seller: sellerAData.seller,
      scraped_at: sellerAData.scraped_at,
      total: sellerAData.total,
      exclusive: sellerAOnly.length
    },
    seller_b: {
      seller: sellerBData.seller,
      scraped_at: sellerBData.scraped_at,
      total: sellerBData.total,
      exclusive: sellerBOnly.length,
      exclusive_items: sellerBOnly.slice(0, 20)  // 保存前20个独有商品
    },
    overlap: {
      count: sellerBFromA.length,
      items: sellerBFromA.map(m => ({
        seller_a: m.sellerA,
        seller_b: m.sellerB,
        match_method: m.method
      }))
    }
  };

  const reportPath = path.join(outputDir, `comparison_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\n💾 对比报告已保存: ${reportPath}`);

  return result;
}

// 运行分析
if (require.main === module) {
  analyzeSellers();
}

module.exports = { analyzeSellers, normalize, extractKeywords };
