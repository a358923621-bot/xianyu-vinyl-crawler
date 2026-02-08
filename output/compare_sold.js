const fs = require('fs');

// Today's data from 梦的采摘员
const mdToday = JSON.parse(fs.readFileSync('C:/Users/chq04/xianyu-vinyl-crawler/output/mengde_20260208.json', 'utf8'));

// Previous data from 音乐大同 (from old JSON)
const yydtOldContent = fs.readFileSync('C:/Users/chq04/xianyu-vinyl-crawler/output/xianyu_yinyuedatong_complete_172_fixed.json', 'utf8');

// Fix the JSON issues
function fixJSON(json) {
  return json.replace(/"title":"([^"]*)"买家评价"([^"]*)"/g, '"title":"$1买家评价$2"')
             .replace(/"title":"([^"]*)"([^"]*)"/g, (match, p1, p2) => {
               if (p2.includes('买家评价') || p2.includes('完好无损') || p2.includes('很好') || p2.includes('描述真实') || p2.includes('没有损坏')) {
                 return `"title":"${p1}${p2}"`;
               }
               return match;
             })
             .replace(/"包装很好"/g, '包装很好')
             .replace(/"完好无损"/g, '完好无损')
             .replace(/"很好"/g, '很好')
             .replace(/"没有损坏"/g, '没有损坏')
             .replace(/"描述真实"/g, '描述真实');
}

let yydtOld;
try {
  yydtOld = JSON.parse(yydtOldContent);
} catch (e) {
  yydtOld = JSON.parse(fixJSON(yydtOldContent));
}

// Today's data from 音乐大同
const yydtToday = JSON.parse(fs.readFileSync('C:/Users/chq04/xianyu-vinyl-crawler/output/yinyuedatong_20260208.json', 'utf8'));

// Normalize title for comparison
function norm(title) {
  return title.toLowerCase()
    .replace(/[·•:：,，、""''「」『』【】《》（）\(\)]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/黑胶|唱片|专辑|新专辑|限量|带独立编号|带编|日版|台版|cd|lp|1lp|2lp|双|三/g, '')
    .replace(/买家评价.*?$|预定|现货|粉丝更优惠|2人小刀价|电影原声|动画胶|彩胶|紫胶|红胶|黄胶|绿胶|金胶|灰胶|蓝胶|白胶|透明胶/g, '')
    .trim();
}

// Get 音乐大同's today items for quick lookup
const yydtTodaySet = new Set(yydtToday.albums.map(norm));

// Find items that 梦的采摘员 has today but 音乐大同 had before but doesn't have now
const results = [];

for (const mdAlbum of mdToday.albums) {
  const mdNorm = norm(mdAlbum);

  // Check if 音乐大同 had this before
  let foundInOldYYDT = false;
  for (const oldItem of yydtOld.products) {
    const oldNorm = norm(oldItem.title);
    if (mdNorm === oldNorm || (mdNorm.length > 10 && oldNorm.includes(mdNorm)) || (oldNorm.length > 10 && mdNorm.includes(oldNorm))) {
      foundInOldYYDT = true;
      break;
    }
  }

  if (foundInOldYYDT) {
    // Check if 音乐大同 still has it today
    const stillHasToday = yydtTodaySet.has(mdNorm) ||
                         Array.from(yydtTodaySet).some(t => t.includes(mdNorm) && mdNorm.length > 10);

    if (!stillHasToday) {
      results.push({
        title: mdAlbum,
        reason: '音乐大同已下架'
      });
    }
  }
}

// Console output
console.log('\n========================================');
console.log('   梦的采摘员在售，音乐大同已下架商品');
console.log('========================================\n');

console.log(`找到 ${results.length} 张专辑：\n`);

results.forEach((item, i) => {
  console.log(`  ${i+1}. ${item.title.substring(0, 60)}`);
});

console.log('\n========================================\n');

// Save result
fs.writeFileSync('C:/Users/chq04/xianyu-vinyl-crawler/output/md_for_sale_yydt_sold.json', JSON.stringify(results, null, 2));
console.log('已保存到 md_for_sale_yydt_sold.json');
