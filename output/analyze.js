const yydt = require('C:/Users/chq04/xianyu-vinyl-crawler/output/xianyu_yinyuedatong_complete_172_fixed.json');
const md = require('C:/Users/chq04/xianyu-vinyl-crawler/output/mengdezhihaiyuan_complete_170_fixed.json');

function norm(t) {
  return t.toLowerCase().replace(/[^\w\s\u4e00-\u9fff]/g, '').replace(/\s+/g, ' ').trim();
}

function sim(p1, p2) {
  if (p1.id === p2.id) return true;
  const t1 = norm(p1.title);
  const t2 = norm(p2.title);
  if (t1 === t2) return true;
  if (t1.length > 8 && t2.includes(t1)) return true;
  if (t2.length > 8 && t1.includes(t2)) return true;
  return false;
}

const overlap = [];
const yydtOnly = [];
const mdOnly = [];

for (const p1 of yydt.products) {
  const m = md.products.find(p2 => sim(p1, p2));
  if (m) {
    overlap.push({
      title: p1.title.substring(0, 40),
      yydt: p1.price,
      md: m.price,
      diff: parseInt(m.price) - parseInt(p1.price),
      id: p1.id
    });
  } else {
    yydtOnly.push(p1);
  }
}

for (const p2 of md.products) {
  const found = yydt.products.some(p1 => sim(p1, p2));
  if (!found) {
    mdOnly.push(p2);
  }
}

console.log('\n========== 两个咸鱼卖家商品对比报告 ==========\n');
console.log('【基本信息】');
console.log('  音乐大同: ' + yydt.products.length + '件在售商品');
console.log('  梦的采摘员: ' + md.products.length + '件在售商品');
console.log('\n【商品对比】');
console.log('  重叠商品: ' + overlap.length + '件');
console.log('  音乐大同独有: ' + yydtOnly.length + '件');
console.log('  梦的采摘员独有: ' + mdOnly.length + '件');
console.log('\n【24小时内上架】');
console.log('  音乐大同: ' + yydt.products.filter(p=>p.within24Hours).length + '件');
console.log('  梦的采摘员: ' + md.products.filter(p=>p.within24Hours).length + '件');

console.log('\n【梦的采摘员价格更高的重叠商品 TOP10】');
overlap.sort((a,b) => b.diff - a.diff).slice(0, 10).forEach((p, i) => {
  console.log(`  ${i+1}. ${p.title}`);
  console.log(`     音乐大同: ¥${p.yydt} -> 梦的采摘员: ¥${p.md} (+¥${p.diff})`);
});

console.log('\n【音乐大同独有热门商品】(按想要人数排序)');
yydtOnly.filter(p => p.wantCount && parseInt(p.wantCount) > 10)
  .sort((a,b) => parseInt(b.wantCount) - parseInt(a.wantCount))
  .slice(0, 10).forEach((p, i) => {
    console.log(`  ${i+1}. ${p.title.substring(0,35)} - ¥${p.price} (${p.wantCount}人想要)`);
  });

console.log('\n【梦的采摘员独有24小时内上架商品】');
mdOnly.filter(p => p.within24Hours).forEach((p, i) => {
  console.log(`  ${i+1}. ${p.title.substring(0,35)} - ¥${p.price}`);
});

// 保存结果
const result = {
  summary: {
    yinyuedatong: yydt.products.length,
    mengde: md.products.length,
    overlapping: overlap.length,
    yinyuedatongOnly: yydtOnly.length,
    mengdeOnly: mdOnly.length
  },
  overlapping: overlap,
  yinyuedatongOnly: yydtOnly.map(p => ({title: p.title, price: p.price, wantCount: p.wantCount})),
  mengdeOnly: mdOnly.map(p => ({title: p.title, price: p.price, within24Hours: p.within24Hours}))
};

require('fs').writeFileSync('C:/Users/chq04/xianyu-vinyl-crawler/output/sellers_comparison_final.json', JSON.stringify(result, null, 2));
