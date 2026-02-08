const fs = require('fs');

// Read files
const yydtContent = fs.readFileSync('C:/Users/chq04/xianyu-vinyl-crawler/output/xianyu_yinyuedatong_complete_172_fixed.json', 'utf8');
const mdContent = fs.readFileSync('C:/Users/chq04/xianyu-vinyl-crawler/output/mengdezhihaiyuan_complete_170_fixed.json', 'utf8');

// Fix JSON by replacing problematic quotes
function fixJSON(json) {
  // Replace Chinese quotes inside title values
  return json.replace(/"title":"([^"]*)"买家评价"([^"]*)"/g, '"title":"$1买家评价$2"')
             .replace(/"title":"([^"]*)"([^"]*)"/g, (match, p1, p2) => {
               if (p2.includes('买家评价') || p2.includes('完好无损') || p2.includes('很好') || p2.includes('描述真实')) {
                 return `"title":"${p1}${p2}"`;
               }
               return match;
             });
}

// Try to parse with fallback
let yydt, md;
try {
  yydt = JSON.parse(yydtContent);
} catch (e) {
  console.log('Fixing YYDT JSON...');
  const fixed = fixJSON(yydtContent);
  yydt = JSON.parse(fixed);
}

try {
  md = JSON.parse(mdContent);
} catch (e) {
  console.log('Fixing MD JSON...');
  const fixed = fixJSON(mdContent);
  md = JSON.parse(fixed);
}

// Normalize title for comparison
function normTitle(title) {
  return title.toLowerCase()
    .replace(/[""'']/g, '')
    .replace(/[·•:：,，、]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/买家评价.*?["']|["'][^"']*["']/g, '')
    .replace(/黑胶|新专辑|唱片|专辑|限量|带独立编号/g, '')
    .trim();
}

// Check if two albums are the same
function isSameAlbum(p1, p2) {
  if (p1.id === p2.id) return true;

  const t1 = normTitle(p1.title);
  const t2 = normTitle(p2.title);

  if (t1 === t2) return true;
  if (t1.length > 10 && t2.includes(t1)) return true;
  if (t2.length > 10 && t1.includes(t2)) return true;

  return false;
}

// Find overlaps
const overlapping = [];
const yydtOnly = [];
const mdOnly = [];

// Track processed
const processedYYDT = new Set();
const processedMD = new Set();

// YYDT vs MD
for (const p1 of yydt.products) {
  if (processedYYDT.has(p1.id)) continue;
  processedYYDT.add(p1.id);

  let found = false;
  for (const p2 of md.products) {
    if (processedMD.has(p2.id)) continue;
    if (isSameAlbum(p1, p2)) {
      overlapping.push({
        title: p1.title,
        yydtPrice: p1.price,
        mdPrice: p2.price
      });
      processedMD.add(p2.id);
      found = true;
      break;
    }
  }
  if (!found) {
    yydtOnly.push(p1);
  }
}

// MD only
for (const p2 of md.products) {
  if (processedMD.has(p2.id)) continue;
  mdOnly.push(p2);
}

// Console output - album names only
console.log('\n========================================');
console.log('   闲鱼卖家黑胶唱片对比 (专辑名称)');
console.log('========================================\n');

console.log('【统计】');
console.log(`  音乐大同: ${yydt.products.length} 张`);
console.log(`  梦的采摘员: ${md.products.length} 张`);
console.log(`  重叠: ${overlapping.length} 张`);
console.log(`  音乐大同独有: ${yydtOnly.length} 张`);
console.log(`  梦的采摘员独有: ${mdOnly.length} 张`);

console.log('\n【重叠专辑】(' + overlapping.length + '张)');
overlapping.forEach((p, i) => {
  console.log(`  ${i+1}. ${p.title.replace(/["''""]/g, '').substring(0, 50)}`);
});

console.log('\n【音乐大同独有专辑】(' + yydtOnly.length + '张)');
yydtOnly.forEach((p, i) => {
  console.log(`  ${i+1}. ${p.title.replace(/["''""]/g, '').substring(0, 50)}`);
});

console.log('\n【梦的采摘员独有专辑】(' + mdOnly.length + '张)');
mdOnly.forEach((p, i) => {
  console.log(`  ${i+1}. ${p.title.replace(/["''""]/g, '').substring(0, 50)}`);
});

console.log('\n========================================\n');

// Save result
const result = {
  summary: {
    yinyuedatong: yydt.products.length,
    mengde: md.products.length,
    overlapping: overlapping.length,
    yinyuedatongOnly: yydtOnly.length,
    mengdeOnly: mdOnly.length
  },
  overlapping: overlapping.map(p => ({ title: p.title })),
  yinyuedatongOnly: yydtOnly.map(p => ({ title: p.title })),
  mengdeOnly: mdOnly.map(p => ({ title: p.title }))
};

fs.writeFileSync('C:/Users/chq04/xianyu-vinyl-crawler/output/seller_comparison_today.json', JSON.stringify(result, null, 2));
console.log('已保存结果到 seller_comparison_today.json');
