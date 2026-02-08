import json
import re

# Read today's data
with open('mengde_20260208.json', 'r', encoding='utf-8') as f:
    md_today = json.load(f)

with open('yinyuedatong_20260208.json', 'r', encoding='utf-8') as f:
    yydt_today = json.load(f)

# Read old 音乐大同 data (corrupted JSON)
with open('xianyu_yinyuedatong_complete_172_fixed.json', 'r', encoding='utf-8') as f:
    old_content = f.read()

# Extract titles using regex from corrupted JSON
yydt_old_titles = []
matches = re.findall(r'title:([^,}]+)[,}]', old_content)
for m in matches:
    title = m.strip()
    if len(title) > 5:
        yydt_old_titles.append(title)

print(f'从旧文件提取了 {len(yydt_old_titles)} 个专辑')

# Normalize function
def norm(title):
    title = title.lower()
    # Remove special characters
    for c in '·•:：,，、""''「」『』【】《（）()':
        title = title.replace(c, ' ')
    title = re.sub(r'\s+', ' ', title)
    # Remove common suffixes
    for kw in ['黑胶', '唱片', '专辑', '新专辑', '限量', '带独立编号', '带编', '日版', '台版', 'cd', 'lp', '1lp', '2lp']:
        title = title.replace(kw, '')
    title = title.strip()
    return title

# Get 音乐大同 today titles normalized
yydt_today_norm = set(norm(t) for t in yydt_today['albums'])

# Find items that 梦的采摘员 has today but 音乐大同 had before but not now
results = []
for md_album in md_today['albums']:
    md_norm = norm(md_album)

    # Check if 音乐大同 had this before
    found_in_old = False
    for old_title in yydt_old_titles:
        old_norm = norm(old_title)
        if md_norm == old_norm:
            found_in_old = True
            break
        if len(md_norm) > 10 and md_norm in old_norm:
            found_in_old = True
            break
        if len(old_norm) > 10 and old_norm in md_norm:
            found_in_old = True
            break

    if found_in_old:
        # Check if 音乐大同 still has it today
        still_has = False
        for t in yydt_today_norm:
            if md_norm == t:
                still_has = True
                break
            if len(md_norm) > 10 and md_norm in t:
                still_has = True
                break
            if len(t) > 10 and t in md_norm:
                still_has = True
                break

        if not still_has:
            results.append(md_album)

print(f'\n========================================')
print(f'   梦的采摘员在售，音乐大同已下架商品')
print(f'========================================\n')
print(f'找到 {len(results)} 张专辑：\n')

for i, title in enumerate(results, 1):
    print(f'  {i}. {title[:65]}')

print('\n========================================\n')

# Save results
with open('md_for_sale_yydt_sold.json', 'w', encoding='utf-8') as f:
    json.dump([{'title': t} for t in results], f, ensure_ascii=False, indent=2)
print('已保存到 md_for_sale_yydt_sold.json')
