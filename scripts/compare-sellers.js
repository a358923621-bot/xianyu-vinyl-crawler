/**
 * 卖家商品对比分析
 * 统计梦的采摘员从音乐大同采购的商品（梦的采摘员在售 + 音乐大同已下架/售罄）
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

  const yydtFiles = getDateFiles('yinyuedatong_');
  const mengdeFiles = getDateFiles('mengde_');

  if (yydtFiles.length === 0 || mengdeFiles.length === 0) {
    console.log('❌ 缺少卖家数据文件');
    console.log('请先运行: node scripts/scrape-full.js all');
    return;
  }

  const yydtData = JSON.parse(fs.readFileSync(path.join(outputDir, yydtFiles[0]), 'utf8'));
  const mengdeData = JSON.parse(fs.readFileSync(path.join(outputDir, mengdeFiles[0]), 'utf8'));

  console.log('='.repeat(60));
  console.log('📊 卖家商品对比分析');
  console.log('='.repeat(60));
  console.log(`音乐大同数据: ${yydtData.seller} (${yydtData.scraped_at}) - ${yydtData.total} 张在售`);
  console.log(`梦的采摘员数据: ${mengdeData.seller} (${mengdeData.scraped_at}) - ${mengdeData.total} 张在售`);
  console.log('');

  // 统计：梦的采摘员在售但音乐大同没有的商品
  const yydtTitles = new Set(yydtData.albums);
  const matchedMengde = new Set();

  const mengdeOnly = [];
  const mengdeFromYydt = []; // 可能从音乐大同采购的

  for (const mengdeTitle of mengdeData.albums) {
    const match = findMatch(mengdeTitle, yydtData.albums, matchedMengde);

    if (match) {
      matchedMengde.add(match.title);
      // 记录匹配关系
      mengdeFromYydt.push({
        mengde: mengdeTitle,
        yydt: match.title,
        method: match.method
      });
    } else {
      mengdeOnly.push(mengdeTitle);
    }
  }

  const matchedYydt = new Set(mengdeFromYydt.map(m => m.yydt));
  const yydtOnly = yydtData.albums.filter(t => !matchedYydt.has(t));

  // 分析：梦的采摘员从音乐大同采购的商品
  // = 音乐大同之前有但现在没有的 + 梦的采摘员现在有的
  // 这里简化为：两者共同商品中，检查音乐大同是否真的不再销售

  console.log('=== 对比结果 ===\n');
  console.log(`共同商品: ${mengdeFromYydt.length} 张`);
  console.log(`梦的采摘员独有: ${mengdeOnly.length} 张`);
  console.log(`音乐大同独有: ${yydtOnly.length} 张`);
  console.log('');

  // 输出共同商品列表
  console.log('=== 共同商品列表 ===\n');
  mengdeFromYydt.forEach((item, i) => {
    console.log(`${i + 1}. ${normalize(item.yydt)}`);
    if (item.mengde !== item.yydt) {
      console.log(`   音乐大同: ${item.yydt}`);
      console.log(`   梦的采摘员: ${item.mengde} [${item.method}]`);
    }
  });

  // 保存对比结果
  const result = {
    analyzed_at: new Date().toISOString(),
    yinyuedatong: {
      seller: yydtData.seller,
      scraped_at: yydtData.scraped_at,
      total: yydtData.total,
      exclusive: yydtOnly.length
    },
    mengde: {
      seller: mengdeData.seller,
      scraped_at: mengdeData.scraped_at,
      total: mengdeData.total,
      exclusive: mengdeOnly.length
    },
    overlap: {
      count: mengdeFromYydt.length,
      items: mengdeFromYydt.map(m => ({
        yinyuedatong: m.yydt,
        mengde: m.mengde,
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
