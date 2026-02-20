/**
 * 智能专辑识别与对比系统
 * 提取艺人名和专辑名，基于核心信息进行匹配
 */

const fs = require('fs');

// ============================================
// 核心信息提取器
// ============================================

class AlbumExtractor {
  constructor() {
    // 常见艺人名分隔符
    this.separators = [
      '\\s+-\\s+',     // " - "
      '\\s*–\\s*',     // " – "
      '\\s*—\\s*',     // " — "
      '\\s*:\\s*',     // " : "
      '\\s*：\\s*',    // " ： "
      '\\s*\\.\\s*',   // " . "
      '\\s+feature\\s+', // " feature "
    ];

    // 标题前缀/后缀需要移除的模式
    this.patterns = {
      prefixes: [
        '现货', '预定', '预售', 'RSD', 'RSD预定',
        '【.*?】', '\\[.*?\\]', '（.*?）', '\\(.*?\\)',
        '特价', '已绝版', '带编号', '独立编号',
        '包顺丰', '签名版', '全新未拆'
      ],

      suffixes: [
        '黑胶', '唱片', '专辑', 'LP', '1LP', '2LP', '3LP',
        '彩胶', '透明胶', '红胶', '蓝胶', '黄胶', '绿胶',
        '紫胶', '粉红胶', '白胶', '金胶', '水晶胶',
        '限量', '限定', '编号版', '带独立编号',
        '日版', '台版', '港版', '欧版', '美版',
        '全新', '未拆', '二手', '99新', '95新',
        '透明', '米色', '可乐瓶色', '奶油色',
        '动画胶', '画胶', '动态画胶', '爆花胶', '夜光胶',
        '双', '三', '四', '十吋', '七吋',
        '附海报', '附签名卡', '含签名', '带海'
      ],

      versions: [
        'Remastered', 'Deluxe', 'Expanded', 'Collector',
        'Anniversary', 'Legacy', 'Reissue'
      ]
    };
  }

  /**
   * 提取艺人名和专辑名
   */
  extract(title) {
    // 1. 提取颜色信息（用于区分不同版本）
    const colorInfo = this.extractColorInfo(title);

    // 2. 移除前缀
    let cleaned = title;
    for (const pattern of this.patterns.prefixes) {
      const regex = new RegExp('^' + pattern, 'gi');
      cleaned = cleaned.replace(regex, '');
    }

    // 3. 移除后缀（但保留颜色信息）
    for (const pattern of this.patterns.suffixes) {
      const regex = new RegExp(pattern, 'gi');
      cleaned = cleaned.replace(regex, '');
    }

    // 4. 分离艺人和专辑
    let result = {
      artist: '',
      album: '',
      raw: cleaned.trim(),
      keywords: [],
      color: colorInfo.color,      // 颜色信息
      variant: colorInfo.variant,  // 版本信息
      edition: colorInfo.edition    // 版次信息
    };

    // 尝试各种分隔符
    for (const sep of this.separators) {
      const regex = new RegExp(sep);
      const parts = cleaned.split(regex);

      if (parts.length >= 2) {
        // 第一部分通常是艺人名
        result.artist = this.cleanArtistName(parts[0]);

        // 第二部分是专辑名
        result.album = this.cleanAlbumName(parts.slice(1).join(' '));

        // 提取关键词
        result.keywords = this.extractKeywords(result.artist, result.album);

        break;
      }
    }

    // 如果没有找到分隔符，尝试其他方法
    if (!result.artist) {
      result = { ...result, ...this.fallbackExtract(cleaned) };
    }

    return result;
  }

  /**
   * 提取颜色和版本信息
   */
  extractColorInfo(title) {
    const info = {
      color: '',
      variant: '',
      edition: ''
    };

    // 颜色列表
    const colors = [
      '透明胶', '透明', '水晶胶', '黑胶', '黑冰胶',
      '红胶', '蓝胶', '黄胶', '绿胶', '紫胶', '粉红胶', '粉胶',
      '白胶', '金胶', '银胶', '橙胶', '灰胶', '彩胶',
      '奶白色胶', '珍珠白胶', '象牙白胶',
      '米色', '米色透明', '可乐瓶色', '奶油色', '奶油色胶',
      '海蓝', '海蓝胶', '天蓝', '天蓝胶',
      '爆花胶', '爆花彩胶', '夜光胶', '动画胶', '画胶',
      '动态画胶', '旋转画胶', '限量画胶', '立体画胶'
    ];

    // 版本信息
    const variants = [
      '双黑胶', '双彩胶', '双', '三彩胶', '三',
      '1LP', '2LP', '3LP', '七吋', '十吋', '十二吋',
      '限量版', '限定版', '编号版', '独立编号', '带编号',
      'RSD', 'Record Store Day'
    ];

    // 检测颜色
    for (const color of colors) {
      if (title.includes(color)) {
        info.color = color;
        break;
      }
    }

    // 检测版本
    for (const variant of variants) {
      if (title.match(new RegExp(variant, 'i'))) {
        info.variant = variant;
        break;
      }
    }

    // 检测特殊版次
    if (title.includes('豪华版')) info.edition = '豪华版';
    if (title.includes('双专辑')) info.edition = '双专辑';
    if (title.includes('精选集')) info.edition = '精选集';

    return info;
  }

  /**
   * 清理艺人名
   */
  cleanArtistName(name) {
    return name
      .replace(/^艺术家[:：]/, '')
      .replace(/^Artist[:：]/, '')
      .replace(/^[aA]rtist[:：]\s*/, '')
      .replace(/^by\s+/i, '')
      .replace(/演唱$/, '')
      .trim();
  }

  /**
   * 清理专辑名
   */
  cleanAlbumName(name) {
    return name
      // 移除版本信息（通常在末尾）
      .replace(/\s*(\(|\[|（)[^)\]]*?\d+周年[^)\]]*?(\)|\]|）)\s*/g, '')
      .replace(/\s*(Deluxe|Expanded|Remastered|Reissue|Version)\s*$/gi, '')
      // 移除媒体格式信息
      .replace(/\s*(OST|O\.S\.T\.|原声|电影原声| soundtrack)\s*$/gi, '')
      // 移除剩余的特殊字符
      .trim();
  }

  /**
   * 提取关键词（用于模糊匹配）
   */
  extractKeywords(artist, album) {
    const keywords = [];

    // 艺人名中的英文单词
    const artistWords = artist.match(/[a-zA-Z]+/g) || [];
    keywords.push(...artistWords.map(w => w.toLowerCase()));

    // 专辑名中的英文单词
    const albumWords = album.match(/[a-zA-Z]+/g) || [];
    keywords.push(...albumWords.map(w => w.toLowerCase()));

    // 中文词汇（取2个字以上的词）
    const chineseWords = (artist + album).match(/[\u4e00-\u9fa5]{2,}/g) || [];
    keywords.push(...chineseWords);

    // 去重并返回
    return [...new Set(keywords)];
  }

  /**
   * 备用提取方法（当没有找到标准分隔符时）
   */
  fallbackExtract(title) {
    // 尝试识别常见的艺人+专辑模式
    const patterns = [
      // "ArtistAlbum" (驼峰命名)
      /^([A-Z][a-z]+)([A-Z][a-z]+(?:[A-Z][a-z]+)*)/,
      // "Artist Album" (空格分隔)
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+([A-Z][a-z].+)/
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        return {
          artist: match[1],
          album: match[2] || '',
          raw: title,
          keywords: this.extractKeywords(match[1], match[2] || '')
        };
      }
    }

    // 都没找到，返回原始标题
    return {
      artist: '',
      album: title,
      raw: title,
      keywords: this.extractKeywords('', title)
    };
  }
}

// ============================================
// 相似度计算器
// ============================================

class SimilarityCalculator {
  /**
   * 计算两个专辑的相似度 (0-1)
   */
  calculate(album1, album2) {
    let score = 0;
    const weights = {
      artistExact: 0.35,      // 艺人名完全匹配
      artistFuzzy: 0.15,      // 艺人名模糊匹配
      albumExact: 0.25,       // 专辑名完全匹配
      albumFuzzy: 0.10,       // 专辑名模糊匹配
      keywords: 0.05,        // 关键词匹配
      sameVariant: 0.10       // 版本/颜色匹配
    };

    // 如果颜色不同且都是具体颜色，大幅降低相似度
    if (album1.color && album2.color && album1.color !== album2.color) {
      // 两个都是明确的颜色，不是同一商品
      return 0.1;  // 很低的相似度
    }

    // 如果有一个有颜色信息而另一个没有，略微降低相似度
    if ((album1.color && !album2.color) || (!album1.color && album2.color)) {
      // 不影响，继续匹配
    }

    // 1. 艺人名完全匹配
    if (album1.artist && album2.artist) {
      const norm1 = this.normalize(album1.artist);
      const norm2 = this.normalize(album2.artist);
      if (norm1 === norm2) {
        score += weights.artistExact;
      }
    }

    // 2. 艺人名模糊匹配（包含关系）
    if (album1.artist && album2.artist) {
      const norm1 = this.normalize(album1.artist);
      const norm2 = this.normalize(album2.artist);
      if (norm1.includes(norm2) || norm2.includes(norm1)) {
        score += weights.artistFuzzy;
      }
    }

    // 3. 专辑名完全匹配
    if (album1.album && album2.album) {
      const norm1 = this.normalize(album1.album);
      const norm2 = this.normalize(album2.album);
      if (norm1 === norm2) {
        score += weights.albumExact;
      }
    }

    // 4. 专辑名模糊匹配
    if (album1.album && album2.album) {
      const norm1 = this.normalize(album1.album);
      const norm2 = this.normalize(album2.album);
      if (norm1.length > 10 && (norm1.includes(norm2) || norm2.includes(norm1))) {
        score += weights.albumFuzzy;
      }
    }

    // 5. 关键词匹配
    const keywordMatch = this.calculateKeywordOverlap(album1.keywords, album2.keywords);
    score += keywordMatch * weights.keywords;

    // 6. 版本/颜色匹配加分
    if (this.isSameVariant(album1, album2)) {
      score += weights.sameVariant;
    }

    return Math.min(score, 1);  // 确保不超过1
  }

  /**
   * 判断是否是同一版本/颜色
   */
  isSameVariant(album1, album2) {
    // 如果两者都没有颜色信息，认为可能是同一版本
    if (!album1.color && !album2.color) {
      return true;
    }

    // 如果有颜色信息，检查是否相同
    if (album1.color && album2.color) {
      return album1.color === album2.color;
    }

    // 其他情况
    return true;
  }

  /**
   * 标准化字符串（用于比较）
   */
  normalize(str) {
    return str
      .toLowerCase()
      .replace(/[·•:：,，、""''「」『』【】《（）\(\)\[\]]/g, '')
      .replace(/\s+/g, '')
      .replace(/黑胶|唱片|专辑|lp|cd/g, '')
      .trim();
  }

  /**
   * 计算关键词重叠度
   */
  calculateKeywordOverlap(keywords1, keywords2) {
    // 确保 keywords 是数组
    const kw1 = Array.isArray(keywords1) ? keywords1 : [];
    const kw2 = Array.isArray(keywords2) ? keywords2 : [];

    const set1 = new Set(kw1);
    const set2 = new Set(kw2);

    let overlap = 0;
    for (const kw of set1) {
      if (set2.has(kw) && kw.length > 2) {
        overlap++;
      }
    }

    const union = new Set([...kw1, ...kw2]);
    return union.size > 0 ? overlap / union.size : 0;
  }

  /**
   * 判断两个专辑是否是同一个
   */
  isSameAlbum(album1, album2, threshold = 0.5) {
    // 特殊情况：两个都有颜色信息且颜色不同 → 不是同一个
    if (album1.color && album2.color && album1.color !== album2.color) {
      return false;  // 不同颜色 = 不同商品
    }

    // 特殊情况：两个都没有艺人信息
    if (!album1.artist && !album2.artist) {
      // 直接比较专辑名
      const norm1 = this.normalize(album1.album);
      const norm2 = this.normalize(album2.album);
      return norm1 === norm2 || (norm1.length > 10 && norm1.includes(norm2));
    }

    const score = this.calculate(album1, album2);
    return score >= threshold;
  }
}

// ============================================
// 主对比逻辑
// ============================================

function compareAlbums(albums1, albums2) {
  const extractor = new AlbumExtractor();
  const calculator = new SimilarityCalculator();

  // 提取所有专辑的核心信息
  const extracted1 = albums1.map(title => ({
    original: title,
    ...extractor.extract(title)
  }));

  const extracted2 = albums2.map(title => ({
    original: title,
    ...extractor.extract(title)
  }));

  // 匹配结果
  const matches = [];
  const matched2 = new Set();

  // 对比
  for (const a1 of extracted1) {
    for (let i = 0; i < extracted2.length; i++) {
      if (matched2.has(i)) continue;

      const a2 = extracted2[i];

      if (calculator.isSameAlbum(a1, a2)) {
        const score = calculator.calculate(a1, a2);
        matches.push({
          seller1: a1.original,
          seller2: a2.original,
          artist1: a1.artist,
          artist2: a2.artist,
          album1: a1.album,
          album2: a2.album,
          score: score,
          confidence: getConfidenceLevel(score)
        });
        matched2.add(i);
        break;
      }
    }
  }

  return matches;
}

function getConfidenceLevel(score) {
  if (score >= 0.9) return '非常高';
  if (score >= 0.8) return '高';
  if (score >= 0.7) return '中等';
  if (score >= 0.6) return '较低';
  return '低';
}

// ============================================
// 执行对比
// ============================================

async function main() {
  console.log('='.repeat(70));
  console.log('🔍 智能专辑对比分析');
  console.log('='.repeat(70));

  // 读取数据
  const yydtData = JSON.parse(fs.readFileSync('C:/Users/chq04/xianyu-vinyl-crawler/output/yinyuedatong_20260216.json', 'utf8'));
  const mdData = JSON.parse(fs.readFileSync('C:/Users/chq04/xianyu-vinyl-crawler/output/mengde_20260216.json', 'utf8'));

  console.log(`\n音乐大同: ${yydtData.total} 张`);
  console.log(`梦的采摘员: ${mdData.total} 张`);

  // 执行对比
  console.log('\n正在提取专辑信息并对比...\n');
  const matches = compareAlbums(yydtData.albums, mdData.albums);

  console.log(`\n找到 ${matches.length} 个匹配的专辑\n`);

  // 显示结果
  console.log('='.repeat(70));
  console.log('匹配详情 (按相似度排序):');
  console.log('='.repeat(70));

  matches.sort((a, b) => b.score - a.score);

  matches.forEach((match, index) => {
    console.log(`\n${index + 1}. [${match.confidence}] 相似度: ${(match.score * 100).toFixed(1)}%`);
    console.log(`   音乐大同: ${match.seller1}`);
    console.log(`   艺人: ${match.artist1 || '未识别'}`);
    console.log(`   专辑: ${match.album1 || ''}`);
    console.log(`   梦的采摘员: ${match.seller2}`);
    console.log(`   艺人: ${match.artist2 || '未识别'}`);
    console.log(`   专辑: ${match.album2 || ''}`);
  });

  // 保存结果
  const result = {
    date: '2026-02-16',
    method: '智能专辑识别',
    threshold: 0.6,
    total: matches.length,
    matches: matches
  };

  const outputPath = 'C:/Users/chq04/xianyu-vinyl-crawler/output/comparison_smart.json';
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\n结果已保存到: ${outputPath}`);

  // 统计
  console.log('\n' + '='.repeat(70));
  console.log('统计摘要:');
  console.log('='.repeat(70));

  const confidenceStats = {};
  matches.forEach(m => {
    confidenceStats[m.confidence] = (confidenceStats[m.confidence] || 0) + 1;
  });

  Object.entries(confidenceStats).sort((a, b) => b[1] - a[1]).forEach(([level, count]) => {
    console.log(`${level}: ${count} 个`);
  });

  console.log('='.repeat(70));
}

// 只在直接运行时执行 main()
if (require.main === module) {
  main().catch(console.error);
}

// 导出模块
module.exports = {
  compareAlbums,
  AlbumExtractor,
  SimilarityCalculator
};
