/**
 * 智能分析报告
 * 基于优化后的专辑识别算法
 */

const fs = require('fs');
const path = require('path');

// 导入智能对比模块
const { compareAlbums, AlbumExtractor, SimilarityCalculator } = require('./compare-smart.js');

// 读取数据
const yydtData = JSON.parse(fs.readFileSync('C:/Users/chq04/xianyu-vinyl-crawler/output/yinyuedatong_20260216.json', 'utf8'));
const mdData = JSON.parse(fs.readFileSync('C:/Users/chq04/xianyu-vinyl-crawler/output/mengde_20260216.json', 'utf8'));

// 读取之前的音乐大同数据（2月8日）
const yydtPrevPath = 'C:/Users/chq04/xianyu-vinyl-crawler/output/yinyuedatong_20260208.json';
let yydtPrevious = null;
try {
  yydtPrevious = JSON.parse(fs.readFileSync(yydtPrevPath, 'utf8'));
} catch (e) {
  console.log('未找到2月8日的历史数据');
}

console.log('='.repeat(70));
console.log('🔍 闲鱼黑胶唱片智能对比分析');
console.log('='.repeat(70));
console.log(`音乐大同 (2月16日): ${yydtData.total} 张`);
console.log(`梦的采摘员 (2月16日): ${mdData.total} 张`);
if (yydtPrevious) {
  const prevTotal = yydtPrevious.total || yydtPrevious.total_for_sale || 0;
  console.log(`音乐大同 (2月8日): ${prevTotal} 张 (历史数据)`);
}
console.log('');

// ============================================
// 1. 两位卖家都在售的商品（智能匹配）
// ============================================
console.log('📊 两位卖家都在售的商品（智能识别）');
console.log('='.repeat(70));

const matches = compareAlbums(yydtData.albums, mdData.albums);

// 筛选高质量匹配（相似度 >= 70%）
const highQualityMatches = matches.filter(m => m.score >= 0.7);

console.log(`找到 ${highQualityMatches.length} 个高质量匹配（相似度 >= 70%）\n`);

highQualityMatches.slice(0, 15).forEach((match, index) => {
  console.log(`${index + 1}. [${match.confidence}] ${(match.score * 100).toFixed(1)}%`);
  console.log(`   音乐大同: ${match.seller1}`);
  if (match.artist1) console.log(`   艺人: ${match.artist1}`);
  if (match.color) console.log(`   颜色: ${match.color || '无'}`);
  console.log(`   梦的采摘员: ${match.seller2}`);
  if (match.artist2) console.log(`   艺人: ${match.artist2}`);
  if (match.color) console.log(`   颜色: ${match.color || '无'}`);
  console.log('');
});

// ============================================
// 2. 音乐大同已下架的商品
// ============================================
console.log('📉 音乐大同已下架商品（对比2月8日）');
console.log('='.repeat(70));

// 定义在外部作用域以便后续使用
let extractor = null;
let calculator = null;
let prevAlbums = [];
let currAlbums = [];
let soldItems = [];

if (yydtPrevious) {
  extractor = new AlbumExtractor();
  calculator = new SimilarityCalculator();

  // 提取之前的所有专辑
  prevAlbums = yydtPrevious.albums.map(title => ({
    original: title,
    ...extractor.extract(title)
  }));

  // 提取当前的专辑
  currAlbums = yydtData.albums.map(title => ({
    original: title,
    ...extractor.extract(title)
  }));

  // 找出已下架的
  for (const prev of prevAlbums) {
    let found = false;
    for (const curr of currAlbums) {
      if (calculator.isSameAlbum(prev, curr)) {
        found = true;
        break;
      }
    }
    if (!found) {
      soldItems.push({
        title: prev.original,
        artist: prev.artist,
        album: prev.album,
        color: prev.color
      });
    }
  }

  console.log(`共 ${soldItems.length} 张已下架\n`);

  // 显示部分已下架商品
  soldItems.slice(0, 10).forEach((item, index) => {
    console.log(`${index + 1}. ${item.title}`);
    if (item.artist) console.log(`   艺人: ${item.artist}`);
    if (item.color) console.log(`   颜色: ${item.color}`);
  });
  console.log('');
}

// ============================================
// 3. 梦的采摘员在售，音乐大同已下架的商品
// ============================================
console.log('🆕 梦的采摘员在售，音乐大同已下架的商品');
console.log('='.repeat(70));

const result = [];

if (yydtPrevious) {
  for (const mdAlbum of mdData.albums) {
    const mdExtracted = {
      original: mdAlbum,
      ...new AlbumExtractor().extract(mdAlbum)
    };

    // 检查是否在音乐大同的之前数据中
    let wasInYydt = false;
    for (const prev of prevAlbums) {
      if (calculator.isSameAlbum(mdExtracted, prev)) {
        wasInYydt = true;
        break;
      }
    }

    if (wasInYydt) {
      // 检查是否还在音乐大同的当前数据中
      let stillInYydt = false;
      for (const curr of currAlbums) {
        if (calculator.isSameAlbum(mdExtracted, curr)) {
          stillInYydt = true;
          break;
        }
      }

      if (!stillInYydt) {
        result.push({
          album: mdAlbum,
          extracted: mdExtracted
        });
      }
    }
  }

  console.log(`共找到 ${result.length} 张\n`);

  // 按置信度排序
  const resultWithScore = result.map(r => ({
    ...r,
    score: calculator.calculate(
      { ...r.extracted, raw: '' },
      { artist: '', album: r.extracted.album } // 用于对比
    )
  })).sort((a, b) => b.score - a.score);

  resultWithScore.slice(0, 15).forEach((item, index) => {
    console.log(`${index + 1}. [${getConfidence(item.score)}] ${(item.score * 100).toFixed(1)}%`);
    console.log(`   ${item.album}`);
    if (item.extracted.artist) console.log(`   艺人: ${item.extracted.artist}`);
    if (item.extracted.color) console.log(`   颜色: ${item.extracted.color}`);
    console.log('');
  });

  // 保存完整结果
  const finalResult = {
    date: '2026-02-16',
    method: '智能专辑识别 v2.0',
    threshold: 0.7,
    color_aware: true,
    summary: {
      yinyuedatong_current: yydtData.total,
      mengde_current: mdData.total,
      yinyuedatong_previous: yydtPrevious ? (yydtPrevious.total || yydtPrevious.total_for_sale || 0) : 0,
      both_selling: highQualityMatches.length,
      yinyuedatong_sold: soldItems.length,
      mengde_exclusive: result.length
    },
    both_selling: highQualityMatches.map(m => ({
      seller1: m.seller1,
      seller2: m.seller2,
      artist: m.artist1 || m.artist2,
      album: m.album1 || m.album2,
      confidence: m.confidence,
      score: m.score,
      color: m.color
    })),
    yinyuedatong_sold: soldItems.map(s => ({
      title: s.title,
      artist: s.artist,
      album: s.album,
      color: s.color
    })),
    mengde_exclusive: result.map(r => ({
      title: r.album,
      artist: r.extracted.artist,
      album: r.extracted.album,
      confidence: getConfidence(r.score),
      score: r.score,
      color: r.extracted.color
    }))
  };

  const outputPath = 'C:/Users/chq04/xianyu-vinyl-crawler/output/analysis_smart.json';
  fs.writeFileSync(outputPath, JSON.stringify(finalResult, null, 2), 'utf8');

  console.log('='.repeat(70));
  console.log('📊 分析总结');
  console.log('='.repeat(70));
  console.log(`两位卖家都在售: ${finalResult.summary.both_selling} 张`);
  console.log(`音乐大同已下架: ${finalResult.summary.yinyuedatong_sold} 张`);
  console.log(`梦的采摘员独家: ${finalResult.summary.mengde_exclusive} 张`);
  console.log('');

  // 置信度分布
  const confidenceStats = {};
  highQualityMatches.forEach(m => {
    const level = getConfidence(m.score);
    confidenceStats[level] = (confidenceStats[level] || 0) + 1;
  });

  console.log('两者都在售的商品 - 置信度分布:');
  Object.entries(confidenceStats).sort((a, b) => b[1] - a[1]).forEach(([level, count]) => {
    console.log(`  ${level}: ${count} 个`);
  });

  console.log('\n完整结果已保存到: ' + outputPath);
  console.log('='.repeat(70));
}

function getConfidence(score) {
  if (score >= 0.9) return '非常高';
  if (score >= 0.8) return '高';
  if (score >= 0.7) return '中等';
  if (score >= 0.5) return '较低';
  return '低';
}
