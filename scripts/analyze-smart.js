/**
 * 智能分析报告
 * 基于优化后的专辑识别算法
 */

const fs = require('fs');
const path = require('path');

// 导入智能对比模块
const { compareAlbums, AlbumExtractor, SimilarityCalculator } = require('./compare-smart.js');

/**
 * 查找 output 目录中指定卖家的最新数据文件
 */
function findLatestData(sellerId) {
  const outputDir = path.join(__dirname, '../output');
  if (!fs.existsSync(outputDir)) {
    throw new Error(`输出目录不存在: ${outputDir}`);
  }

  const files = fs.readdirSync(outputDir)
    .filter(f => f.startsWith(sellerId) && f.endsWith('.json'))
    .filter(f => !f.includes('analysis'))  // 排除分析报告
    .sort()
    .reverse();

  if (files.length === 0) {
    throw new Error(`未找到 ${sellerId} 的数据文件`);
  }

  return path.join(outputDir, files[0]);
}

/**
 * 查找指定卖家的倒数第二个数据文件（用于历史对比）
 */
function findPreviousData(sellerId, latestFile) {
  const outputDir = path.join(__dirname, '../output');
  const files = fs.readdirSync(outputDir)
    .filter(f => f.startsWith(sellerId) && f.endsWith('.json'))
    .filter(f => !f.includes('analysis'))
    .sort()
    .reverse();

  // 找到最新文件之后的下一个
  const latestIndex = files.findIndex(f => f === path.basename(latestFile));
  if (latestIndex >= 0 && latestIndex + 1 < files.length) {
    const prevFile = path.join(outputDir, files[latestIndex + 1]);
    try {
      return JSON.parse(fs.readFileSync(prevFile, 'utf8'));
    } catch (e) {
      return null;
    }
  }
  return null;
}

// 主函数
function main() {
  // 查找最新的数据文件
  const yydtPath = findLatestData('yinyuedatong');
  const mdPath = findLatestData('mengde');

  console.log(`读取音乐大同数据: ${path.basename(yydtPath)}`);
  console.log(`读取梦的采摘员数据: ${path.basename(mdPath)}`);

  // 读取数据
  const yydtData = JSON.parse(fs.readFileSync(yydtPath, 'utf8'));
  const mdData = JSON.parse(fs.readFileSync(mdPath, 'utf8'));

  // 尝试读取历史数据
  const yydtPrevious = findPreviousData('yinyuedatong', yydtPath);

  const currentDate = new Date().toISOString().slice(0, 10);
  console.log('='.repeat(70));
  console.log('🔍 闲鱼黑胶唱片智能对比分析');
  console.log('='.repeat(70));
  console.log(`音乐大同: ${yydtData.total} 张`);
  console.log(`梦的采摘员: ${mdData.total} 张`);
  if (yydtPrevious) {
    const prevTotal = yydtPrevious.total || yydtPrevious.total_for_sale || 0;
    console.log(`音乐大同 (历史): ${prevTotal} 张`);
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
  console.log('📉 音乐大同已下架商品（对比历史数据）');
  console.log('='.repeat(70));

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
        { artist: '', album: r.extracted.album }
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
      date: currentDate,
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

    const outputPath = path.join(__dirname, '../output/analysis_smart.json');
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
  } else {
    console.log('没有足够的历史数据进行对比分析');
    console.log('='.repeat(70));
  }
}

function getConfidence(score) {
  if (score >= 0.9) return '非常高';
  if (score >= 0.8) return '高';
  if (score >= 0.7) return '中等';
  if (score >= 0.5) return '较低';
  return '低';
}

// 运行
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

module.exports = { main };
