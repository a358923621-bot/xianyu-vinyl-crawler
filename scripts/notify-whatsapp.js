/**
 * WhatsApp 通知脚本
 * 使用 Twilio API 发送 WhatsApp 消息
 */

const fs = require('fs');
const path = require('path');
const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

/**
 * 读取最新的分析报告
 */
function loadLatestReport() {
  const outputDir = path.join(__dirname, '../output');
  const files = fs.readdirSync(outputDir)
    .filter(f => f.startsWith('analysis_') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length > 0) {
    try {
      const latestFile = path.join(outputDir, files[0]);
      const content = fs.readFileSync(latestFile, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      console.log(`⚠️  无法读取分析报告: ${e.message}`);
      return null;
    }
  }

  return null;
}

/**
 * 读取卖家数据
 */
function loadSellerData() {
  const outputDir = path.join(__dirname, '../output');
  const result = {};

  const files = fs.readdirSync(outputDir)
    .filter(f => f.endsWith('.json') && !f.startsWith('analysis_') && !f.startsWith('debug-'))
    .sort()
    .reverse();

  // 只读取最新的两个文件（每个卖家一个）
  const seenSellers = new Set();
  for (const file of files) {
    const sellerId = file.split('_')[0];
    if (!seenSellers.has(sellerId)) {
      try {
        const content = fs.readFileSync(path.join(outputDir, file), 'utf8');
        const data = JSON.parse(content);
        result[sellerId] = data;
        seenSellers.add(sellerId);

        if (seenSellers.size >= 2) break;
      } catch (e) {
        console.log(`⚠️  跳过损坏的文件: ${file} - ${e.message}`);
      }
    }
  }

  return result;
}

/**
 * 格式化全量报告
 */
function formatFullReport(report, sellerData) {
  const lines = [];

  lines.push('📊 闲鱼黑胶监控 - 全量报告');
  lines.push('');
  lines.push(`🕐 时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  lines.push('');

  // 卖家数据
  for (const [id, data] of Object.entries(sellerData)) {
    const newCount = data.new_items || data.newItems || 0;
    lines.push(`📦 *${data.seller}*`);
    lines.push(`在售: *${data.total}* 张`);
    if (newCount > 0) {
      lines.push(`🆕 新增: *${newCount}* 张`);
    }
    lines.push('');
  }

  // 智能分析结果（如果有）
  if (report && report.summary) {
    lines.push('📈 *智能分析*');
    lines.push(`两位都在售: *${report.summary.both_selling}* 张`);
    lines.push(`音乐大同已售: *${report.summary.yinyuedatong_sold}* 张`);
    lines.push(`梦的采摘员独家: *${report.summary.mengde_exclusive}* 张`);
    lines.push('');

    // 高置信度匹配
    if (report.both_selling && report.both_selling.length > 0) {
      const topMatches = report.both_selling.slice(0, 5);
      lines.push('*热门重叠商品*:');
      topMatches.forEach((m, i) => {
        lines.push(`${i + 1}. ${m.artist || '未知'} - ${m.album || m.seller1?.substring(0, 20)}...`);
      });
      lines.push('');
    }
  }

  lines.push('💡 详细数据请查看 GitHub Actions');

  return lines.join('\n');
}

/**
 * 格式化增量报告
 */
function formatIncrementalReport(sellerData) {
  const lines = [];

  lines.push('🔄 闲鱼黑胶监控 - 增量更新');
  lines.push('');
  lines.push(`🕐 时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  lines.push('');

  let hasNew = false;

  for (const [id, data] of Object.entries(sellerData)) {
    const newCount = data.new_items || data.newItems || 0;

    lines.push(`📦 *${data.seller}*`);

    if (newCount > 0) {
      hasNew = true;
      lines.push(`🆕 新上架: *${newCount}* 张`);

      // 显示前3个新商品
      if (data.newItems && data.newItems.length > 0) {
        lines.push('');
        lines.push('最新商品:');
        data.newItems.slice(0, 3).forEach((item, i) => {
          const title = item.title.length > 30 ? item.title.substring(0, 30) + '...' : item.title;
          lines.push(`${i + 1}. ${title}`);
          if (item.price) lines.push(`   💰 ${item.price}`);
        });
      }
    } else {
      lines.push('无新商品');
    }

    lines.push('');
  }

  if (!hasNew) {
    lines.push('✨ 所有卖家暂无新商品上架');
  }

  return lines.join('\n');
}

/**
 * 发送 WhatsApp 消息
 */
async function sendWhatsApp(message) {
  let from = process.env.TWILIO_WHATSAPP_FROM;
  let to = process.env.TWILIO_WHATSAPP_TO;

  if (!from || !to) {
    console.error('❌ 缺少 WhatsApp 配置');
    console.error('请设置 TWILIO_WHATSAPP_FROM 和 TWILIO_WHATSAPP_TO 环境变量');
    return false;
  }

  // 确保 from 和 to 有正确的 whatsapp: 前缀
  if (!from.startsWith('whatsapp:')) {
    from = `whatsapp:${from}`;
  }
  if (!to.startsWith('whatsapp:')) {
    to = `whatsapp:${to}`;
  }

  console.log(`📤 发送消息: ${from} -> ${to}`);

  try {
    const response = await client.messages.create({
      from: from,
      to: to,
      body: message
    });

    console.log('✅ WhatsApp 消息已发送');
    console.log(`   SID: ${response.sid}`);
    console.log(`   状态: ${response.status}`);
    return true;

  } catch (error) {
    console.error('❌ WhatsApp 发送失败:', error.message);
    if (error.code) {
      console.error(`   错误代码: ${error.code}`);
    }
    if (error.moreInfo) {
      console.error(`   详情: ${error.moreInfo}`);
    }
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'full';

  console.log('='.repeat(50));
  console.log('📱 WhatsApp 通知');
  console.log('='.repeat(50));
  console.log(`模式: ${mode}`);

  // 检查环境变量
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log('⚠️  未配置 Twilio，跳过通知');
    console.log('   如需启用，请在 GitHub Secrets 中配置:');
    console.log('   - TWILIO_ACCOUNT_SID');
    console.log('   - TWILIO_AUTH_TOKEN');
    console.log('   - TWILIO_WHATSAPP_FROM');
    console.log('   - TWILIO_WHATSAPP_TO');
    return;
  }

  // 读取数据
  const sellerData = loadSellerData();
  const report = loadLatestReport();

  if (Object.keys(sellerData).length === 0) {
    console.log('⚠️  没有找到卖家数据');
    return;
  }

  // 格式化消息
  let message;
  if (mode === 'full') {
    message = formatFullReport(report, sellerData);
  } else {
    message = formatIncrementalReport(sellerData);
  }

  console.log('\n📝 消息内容:');
  console.log('-'.repeat(50));
  console.log(message);
  console.log('-'.repeat(50));

  // 发送消息
  await sendWhatsApp(message);
}

// 运行
main().catch(error => {
  console.error(' fatal error:', error);
  process.exit(1);
});
