#!/usr/bin/env python3
"""
闲鱼黑胶卖家对比技能
Xianyu Vinyl Sellers Comparison Skill

用法:
    python xianyu_compare.py                    # 使用默认卖家
    python xianyu_compare.py --seller1 xxx --seller2 yyy
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path

# 如果安装了 playwright，可以使用：
# from playwright.sync_api import sync_playwright

# Default seller IDs
SELLER1_ID = "2219735146783"  # 音乐大同
SELLER2_ID = "1059107164"     # 梦的采摘员
OUTPUT_DIR = Path("./output")


def normalize_title(title: str) -> str:
    """标准化专辑标题，去除干扰信息"""
    title = title.lower()

    # 移除特殊字符
    for c in '·•:：,，、""''「」『』【】《（）()':
        title = title.replace(c, ' ')

    # 移除多余空格
    title = re.sub(r'\s+', ' ', title)

    # 移除常见后缀
    keywords = [
        '黑胶', '唱片', '专辑', '新专辑', '限量', '带独立编号', '带编',
        '日版', '台版', 'cd', 'lp', '1lp', '2lp', '双', '三',
        '彩胶', '紫胶', '红胶', '黄胶', '绿胶', '金胶', '灰胶', '蓝胶',
        '白胶', '透明胶', '动画胶', '电影原声', '买家评价', '预定',
        '现货', '粉丝更优惠', '2人小刀价', '人气第', '热销第',
        '24小时内发布', '48小时内发布', '72小时内发布', '一周内发布'
    ]
    for kw in keywords:
        title = title.replace(kw, '')

    return title.strip()


def is_same_album(title1: str, title2: str) -> bool:
    """判断两个专辑名是否相同"""
    n1 = normalize_title(title1)
    n2 = normalize_title(title2)

    if n1 == n2:
        return True
    if len(n1) > 10 and n1 in n2:
        return True
    if len(n2) > 10 and n2 in n1:
        return True
    return False


def compare_sellers(seller1_data: list, seller2_data: list) -> dict:
    """对比两个卖家的专辑"""
    processed_s1 = set()
    processed_s2 = set()

    overlapping = []
    s1_only = []
    s2_only = []

    # 找出重叠和seller1独有
    for album1 in seller1_data:
        if album1 in processed_s1:
            continue
        processed_s1.add(album1)

        found = False
        for album2 in seller2_data:
            if album2 in processed_s2:
                continue
            if is_same_album(album1, album2):
                overlapping.append(album1)
                processed_s2.add(album2)
                found = True
                break

        if not found:
            s1_only.append(album1)

    # 找出seller2独有
    for album2 in seller2_data:
        if album2 not in processed_s2:
            s2_only.append(album2)

    return {
        "overlapping": overlapping,
        "seller1_only": s1_only,
        "seller2_only": s2_only
    }


def print_report(result: dict, seller1_name: str, seller2_name: str):
    """打印对比报告"""
    print('\n' + '=' * 40)
    print('   闲鱼卖家黑胶唱片对比')
    print('=' * 40 + '\n')

    print('【统计】')
    print(f'  {seller1_name}: {len(result["seller1_only"]) + len(result["overlapping"])} 张')
    print(f'  {seller2_name}: {len(result["seller2_only"]) + len(result["overlapping"])} 张')
    print(f'  重叠: {len(result["overlapping"])} 张')
    print(f'  {seller1_name}独有: {len(result["seller1_only"])} 张')
    print(f'  {seller2_name}独有: {len(result["seller2_only"])} 张')

    print(f'\n【重叠专辑】({len(result["overlapping"])}张)')
    for i, album in enumerate(result["overlapping"], 1):
        print(f'  {i}. {album[:55]}')

    print(f'\n【{seller1_name}独有专辑】({len(result["seller1_only"])}张)')
    for i, album in enumerate(result["seller1_only"], 1):
        print(f'  {i}. {album[:55]}')

    print(f'\n【{seller2_name}独有专辑】({len(result["seller2_only"])}张)')
    for i, album in enumerate(result["seller2_only"], 1):
        print(f'  {i}. {album[:55]}')

    print('\n' + '=' * 40 + '\n')


def main():
    """主函数"""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 读取数据文件（假设已由浏览器爬取生成）
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    # 这里应该读取爬取的数据
    # 示例：seller1_file = OUTPUT_DIR / f"seller1_{timestamp}.json"

    print("请先使用浏览器爬取两个卖家的数据，然后运行对比分析")
    print("\n使用方法:")
    print("1. 打开闲鱼网页并登录")
    print("2. 访问卖家页面并爬取数据")
    print("3. 保存为JSON文件")
    print("4. 运行此脚本进行对比")


if __name__ == "__main__":
    main()
