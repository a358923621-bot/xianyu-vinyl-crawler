const fs = require('fs');

const yydt = JSON.parse(fs.readFileSync('C:/Users/chq04/xianyu-vinyl-crawler/output/yinyuedatong_20260208.json', 'utf8'));
const md = JSON.parse(fs.readFileSync('C:/Users/chq04/xianyu-vinyl-crawler/output/mengde_20260208.json', 'utf8'));

// Normalize title for comparison
function norm(title) {
  return title.toLowerCase()
    .replace(/[·•:：,，、""''「」『』【】《》（）\(\)]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/黑胶|唱片|专辑|新专辑|限量|带独立编号|带编|日版|台版/g, '')
    .replace(/买家评价.*?$|预定|现货|粉丝更优惠|2人小刀价/g, '')
    .trim();
}

// Check if two albums are the same
function isSame(t1, t2) {
  const n1 = norm(t1);
  const n2 = norm(t2);

  if (n1 === n2) return true;
  if (n1.length > 12 && n2.includes(n1)) return true;
  if (n2.length > 12 && n1.includes(n2)) return true;

  return false;
}

// Find overlaps
const overlapping = [];
const yydtOnly = [];
const mdOnly = [];
const processedYYDT = new Set();
const processedMD = new Set();

// YYDT vs MD
for (const p1 of yydt.albums) {
  if (processedYYDT.has(p1)) continue;
  processedYYDT.add(p1);

  let found = false;
  for (const p2 of md.albums) {
    if (processedMD.has(p2)) continue;
    if (isSame(p1, p2)) {
      overlapping.push({ yydt: p1, md: p2 });
      processedMD.add(p2);
      found = true;
      break;
    }
  }
  if (!found) {
    yydtOnly.push(p1);
  }
}

// MD only
for (const p2 of md.albums) {
  if (processedMD.has(p2)) continue;
  mdOnly.push(p2);
}

// Console output
console.log('\n========================================');
console.log('   闲鱼卖家黑胶唱片对比 (2026-02-08)');
console.log('========================================\n');

console.log('【统计】');
console.log(`  音乐大同: ${yydt.total_for_sale} 张`);
console.log(`  梦的采摘员: ${md.total_for_sale} 张`);
console.log(`  重叠: ${overlapping.length} 张`);
console.log(`  音乐大同独有: ${yydtOnly.length} 张`);
console.log(`  梦的采摘员独有: ${mdOnly.length} 张`);

console.log('\n【重叠专辑】(' + overlapping.length + '张)');
overlapping.forEach((p, i) => {
  console.log(`  ${i+1}. ${p.yydt.substring(0, 55)}`);
});

console.log('\n【音乐大同独有专辑】(' + yydtOnly.length + '张)');
yydtOnly.forEach((p, i) => {
  console.log(`  ${i+1}. ${p.substring(0, 55)}`);
});

console.log('\n【梦的采摘员独有专辑】(' + mdOnly.length + '张)');
mdOnly.forEach((p, i) => {
  console.log(`  ${i+1}. ${p.substring(0, 55)}`);
});

console.log('\n========================================\n');

// Save result
const result = {
  date: '2026-02-08',
  summary: {
    yinyuedatong: yydt.total_for_sale,
    mengde: md.total_for_sale,
    overlapping: overlapping.length,
    yinyuedatongOnly: yydtOnly.length,
    mengdeOnly: mdOnly.length
  },
  overlapping: overlapping.map(p => ({ title: p.yydt })),
  yinyuedatongOnly: yydtOnly.map(p => ({ title: p })),
  mengdeOnly: mdOnly.map(p => ({ title: p }))
};

fs.writeFileSync('C:/Users/chq04/xianyu-vinyl-crawler/output/comparison_20260208.json', JSON.stringify(result, null, 2));
console.log('已保存到 comparison_20260208.json');
