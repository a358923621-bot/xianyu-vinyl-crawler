# Xianyu Vinyl Sellers Comparison

# Background
This skill compares vinyl record listings between two Xianyu (闲鱼) sellers to identify overlapping albums and unique listings.

# Parameters
- seller1_id: User ID of first seller (default: 音乐大同 = 2219735146783)
- seller2_id: User ID of second seller (default: 梦的采摘员 = 1059107164)
- output_dir: Output directory (default: ./output)

# Steps

## 0. Login Check (New Computer Only)
Navigate to: https://www.goofish.com
- Wait for user to scan QR code for login verification
- Prompt: "请扫码登录闲鱼账号，完成后输入 '继续'"
- Wait for user confirmation before proceeding

## 1. Scrape Seller 1 (音乐大同)
Navigate to: https://www.goofish.com/personal?userId={seller1_id}
- Check if login is required (redirect to login page)
- If login needed: wait for QR code scan, then retry
- Click "在售" tab to filter only for-sale items
- Scroll to load all items (use lazy loading)
- Extract album titles only (remove price, ratings, etc.)
- Save to: {output_dir}/seller1_YYYYMMDD_HHMMSS.json

## 2. Scrape Seller 2 (梦的采摘员)
Navigate to: https://www.goofish.com/personal?userId={seller2_id}
- Click "在售" tab
- Scroll to load all items
- Extract album titles only
- Save to: {output_dir}/seller2_YYYYMMDD_HHMMSS.json

## 3. Compare Data
- Read both JSON files
- Normalize titles (remove special characters, color descriptions, etc.)
- Find overlapping albums
- Find unique albums for each seller

## 4. Output Report
Console output:
```
========================================
   闲鱼卖家黑胶唱片对比
========================================

【统计】
  卖家1: XXX 张
  卖家2: XXX 张
  重叠: XX 张
  卖家1独有: XX 张
  卖家2独有: XX 张

【重叠专辑】(XX张)
  1. 专辑名
  2. 专辑名
  ...

【卖家1独有专辑】(XX张)
  ...

【卖家2独有专辑】(XX张)
  ...
========================================
```

Save to: {output_dir}/comparison_YYYYMMDD_HHMMSS.json

# Title Normalization Rules
Remove:
- Special characters: ·•:：,，、""''「」『』【】《（）()
- Color descriptions: 黑胶、唱片、专辑、彩胶、紫胶、红胶、黄胶、绿胶、金胶、灰胶、蓝胶、白胶、透明胶
- Format info: LP、CD、1LP、2LP、双、三
- Seller notes: 买家评价、预定、现货、粉丝更优惠、2人小刀价

# Output Format
JSON:
```json
{
  "timestamp": "YYYY-MM-DD HH:MM:SS",
  "summary": {
    "seller1": { "name": "音乐大同", "count": 178 },
    "seller2": { "name": "梦的采摘员", "count": 167 },
    "overlapping": 59,
    "seller1_only": 116,
    "seller2_only": 108
  },
  "overlapping": ["专辑1", "专辑2", ...],
  "seller1_only": ["专辑1", "专辑2", ...],
  "seller2_only": ["专辑1", "专辑2", ...]
}
```
