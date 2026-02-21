/**
 * 查找梦的采摘员从音乐大同采购的商品
 * 条件：梦的采摘员在售 + 音乐大同已下架/售罄
 */

const fs = require('fs');
const path = require('path');

// 从 compare-sellers.js 导入标准化函数
const { normalize, extractKeywords } = require('./compare-sellers.js');

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
 * 查找梦的采摘员从音乐大同采购的商品
 */
function findAcquisitions() {
  const outputDir = path.join(__dirname, '../output');

  // 读取历史数据（音乐大同之前的库存）
  const yydtHistoryFiles = fs.readdirSync(outputDir)
    .filter(f => f.startsWith('yinyuedatong_202602') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (yydtHistoryFiles.length < 2) {
    console.log('❌ 需要至少两个历史数据文件');
    return;
  }

  // 使用最早的历史数据作为"之前"的状态
  const earliestFile = yydtHistoryFiles[yydtHistoryFiles.length - 1];
  const currentFile = yydtHistoryFiles[0];

  console.log('='.repeat(60));
  console.log('🔄 梦的采摘员从音乐大同采购的商品分析');
  console.log('='.repeat(60));
  console.log(`音乐大同历史数据: ${earliestFile}`);
  console.log(`音乐大同当前数据: ${currentFile}`);

  const yydtHistory = JSON.parse(fs.readFileSync(path.join(outputDir, earliestFile), 'utf8'));
  const yydtCurrent = JSON.parse(fs.readFileSync(path.join(outputDir, currentFile), 'utf8'));

  // 读取梦的采摘员当前数据
  const mengdeFiles = fs.readdirSync(outputDir)
    .filter(f => f.startsWith('mengde_202602') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (mengdeFiles.length === 0) {
    console.log('❌ 没有找到梦的采摘员数据');
    return;
  }

  const mengdeCurrent = JSON.parse(fs.readFileSync(path.join(outputDir, mengdeFiles[0]), 'utf8'));

  console.log(`梦的采摘员当前数据: ${mengdeFiles[0]}`);
  console.log('');
  console.log(`音乐大同之前: ${yydtHistory.total} 张`);
  console.log(`音乐大同现在: ${yydtCurrent.total} 张`);
  console.log(`梦的采摘员现在: ${mengdeCurrent.total} 张`);
  console.log('');

  // 找出音乐大同已下架的商品（之前有，现在没有）
  const yydtHistoryTitles = new Set(yydtHistory.albums);
  const yydtCurrentTitles = new Set(yydtCurrent.albums);

  const yydtDelisted = yydtHistory.albums.filter(title => !yydtCurrentTitles.has(title));

  console.log(`音乐大同已下架/售罄: ${yydtDelisted.length} 张`);
  console.log('');

  // 在梦的采摘员当前商品中查找匹配
  const acquisitions = [];
  const matchedMengde = new Set();

  for (const mengdeTitle of mengdeCurrent.albums) {
    const match = findMatch(mengdeTitle, yydtDelisted, matchedMengde);

    if (match) {
      matchedMengde.add(match.title);
      acquisitions.push({
        mengde: mengdeTitle,
        yydt_had: match.title,
        method: match.method
      });
    }
  }

  console.log('='.repeat(60));
  console.log(`📦 梦的采摘员可能从音乐大同采购的商品: ${acquisitions.length} 张`);
  console.log('='.repeat(60));
  console.log('');

  if (acquisitions.length === 0) {
    console.log('❌ 没有找到可能的采购商品');
    return;
  }

  // 按匹配方法分组显示
  const exactMatches = acquisitions.filter(a => a.method === 'exact');
  const keywordMatches = acquisitions.filter(a => a.method === 'keyword');
  const containsMatches = acquisitions.filter(a => a.method === 'contains');

  if (exactMatches.length > 0) {
    console.log(`【完全匹配】${exactMatches.length} 张:`);
    exactMatches.forEach((item, i) => {
      console.log(`${i + 1}. ${normalize(item.yydt_had)}`);
      if (item.mengde !== item.yydt_had) {
        console.log(`   音乐大同曾售: ${item.yydt_had}`);
        console.log(`   梦的采摘员: ${item.mengde}`);
      }
    });
    console.log('');
  }

  if (keywordMatches.length > 0) {
    console.log(`【关键词匹配】${keywordMatches.length} 张:`);
    keywordMatches.forEach((item, i) => {
      console.log(`${i + 1}. ${normalize(item.yydt_had)}`);
      if (item.mengde !== item.yydt_had) {
        console.log(`   音乐大同曾售: ${item.yydt_had}`);
        console.log(`   梦的采摘员: ${item.mengde}`);
      }
    });
    console.log('');
  }

  if (containsMatches.length > 0) {
    console.log(`【模糊匹配】${containsMatches.length} 张:`);
    containsMatches.forEach((item, i) => {
      console.log(`${i + 1}. ${normalize(item.yydt_had)}`);
      console.log(`   音乐大同曾售: ${item.yydt_had}`);
      console.log(`   梦的采摘员: ${item.mengde}`);
    });
    console.log('');
  }

  // 保存结果
  const result = {
    analyzed_at: new Date().toISOString(),
    yydt_history: {
      file: earliestFile,
      total: yydtHistory.total
    },
    yydt_current: {
      file: currentFile,
      total: yydtCurrent.total
    },
    mengde_current: {
      file: mengdeFiles[0],
      total: mengdeCurrent.total
    },
    yydt_delisted: yydtDelisted.length,
    acquisitions: {
      count: acquisitions.length,
      exact: exactMatches.length,
      keyword: keywordMatches.length,
      contains: containsMatches.length,
      items: acquisitions
    }
  };

  const reportPath = path.join(outputDir, `acquisitions_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(`💾 分析结果已保存: ${reportPath}`);

  return result;
}

// 运行分析
if (require.main === module) {
  findAcquisitions();
}

module.exports = { findAcquisitions };
