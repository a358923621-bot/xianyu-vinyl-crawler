/**
 * Telegram 通知脚本
 * 发送爬取结果到 Telegram Bot
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

class TelegramNotifier {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  async sendMessage(text, options = {}) {
    const response = await fetch(`${this.apiUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Telegram API Error: ${error}`);
    }

    return response.json();
  }

  formatFullReport(data) {
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    let message = `
<b>📊 闲鱼黑胶监控 - 全量报告</b>

🕐 <b>时间:</b> ${now}
`.trim();

    data.sellers.forEach(seller => {
      message += `\n📦 <b>${seller.name}:</b> ${seller.total} 张在售`;
    });

    message += `\n\n📈 <b>总计:</b> ${data.total} 张`;

    return message;
  }

  formatIncrementalReport(data) {
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    let message = `
<b>🔄 闲鱼黑胶监控 - 增量更新</b>

🕐 <b>时间:</b> ${now}
`.trim();

    if (data.alerts && data.alerts.length > 0) {
      data.alerts.forEach(alert => {
        message += `\n\n📦 <b>${alert.seller}</b>`;
        message += `\n   🆕 新上架: <b>${alert.totalNew}</b> 张`;

        if (alert.newItems.length > 0) {
          message += `\n\n   最新商品:`;
          alert.newItems.slice(0, 5).forEach((item, index) => {
            message += `\n   ${index + 1}. ${item.title.substring(0, 30)}...`;
          });
        }
      });
    } else {
      message += `\n\n✅ 没有新商品`;
    }

    return message;
  }

  formatErrorReport(error) {
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    return `
<b>❌ 闲鱼黑胶监控 - 错误报告</b>

🕐 <b>时间:</b> ${now}

⚠️ <b>错误信息:</b>
<code>${error.message}</code>
`.trim();
  }
}

async function sendNotification(mode) {
  const notifier = new TelegramNotifier();

  if (!notifier.botToken || !notifier.chatId) {
    console.log('⚠️  未配置 Telegram，跳过通知');
    return;
  }

  try {
    let message;

    if (mode === 'full') {
      // 读取全量数据
      const summaryPath = path.join(DATA_DIR, `summary_${new Date().toISOString().split('T')[0]}.json`);

      if (fs.existsSync(summaryPath)) {
        const data = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
        message = notifier.formatFullReport(data);
      } else {
        message = `<b>⚠️ 全量爬取完成，但未找到数据文件</b>`;
      }
    } else {
      // 读取增量数据
      const alertPath = path.join(DATA_DIR, 'alert.json');

      if (fs.existsSync(alertPath)) {
        const data = JSON.parse(fs.readFileSync(alertPath, 'utf8'));
        message = notifier.formatIncrementalReport(data);
      } else {
        message = `<b>✅ 增量更新完成，没有新商品</b>`;
      }
    }

    await notifier.sendMessage(message);
    console.log('✅ 通知已发送到 Telegram');

  } catch (error) {
    console.error('❌ 发送通知失败:', error);

    // 尝试发送错误报告
    try {
      await notifier.sendMessage(notifier.formatErrorReport(error));
    } catch (e) {
      console.error('❌ 无法发送错误报告');
    }
  }
}

// 从命令行参数获取模式
const mode = process.argv[2] || 'incremental';

sendNotification(mode).catch(console.error);
