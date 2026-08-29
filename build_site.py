# -*- coding: utf-8 -*-
"""
把 bank.json + weeks.json 轉成「學後即測」網站用的題庫檔。

    python3 build_site.py

會寫出：
    docs/banks/manifest.json
    docs/banks/cchs-ipas-2026.json

要新增一門課（例如大四產學班）：
    1. 準備一份同格式的 bank.json
    2. 在下方 COURSES 加一組設定
    3. 重跑本檔
"""
import json, os

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(BASE)          # /root/course
OUTB = os.path.join(BASE, 'docs', 'banks')
os.makedirs(OUTB, exist_ok=True)


def build_cchs():
    bank = json.load(open(os.path.join(SRC, 'bank.json'), encoding='utf-8'))
    weeks = json.load(open(os.path.join(SRC, 'weeks.json'), encoding='utf-8'))['weeks']
    wtitle = {w['no']: w['title'] for w in weeks}

    used = sorted({q['w'] for q in bank})
    units = []
    for w in used:
        n = sum(1 for q in bank if q['w'] == w)
        units.append({
            'id': 'w%02d' % w,
            'label': 'W%02d' % w,
            'title': wtitle.get(w, ''),
            'field': 'w',
            'value': w,
            'timeSec': max(600, n * 60)      # 每題 60 秒，至少 10 分鐘
        })

    mixes = [
        {'id': 'k1', 'label': '科目一　人工智慧基礎概論', 'note': 'L111–L114　及格率最低的一科，重點練這裡',
         'field': 's', 'value': '科一', 'limit': 40, 'timeSec': 3000},
        {'id': 'k2', 'label': '科目二　生成式 AI 應用與規劃', 'note': 'L121–L123　和你平常在玩的東西高度重疊',
         'field': 's', 'value': '科二', 'limit': 40, 'timeSec': 2700},
        {'id': 'mix20', 'label': '全題庫隨機 20 題', 'note': '橫跨所有單元，測整體熟悉度',
         'limit': 20, 'timeSec': 1500},
    ]

    out = {
        'id': 'cchs-ipas-2026',
        'title': 'iPAS AI 應用規劃師　初級',
        'subtitle': '中正高工　115 學年度第一學期彈性課程',
        'blurb': '依 iPAS 官方鑑定範圍（L111–L114、L121–L123）編寫的情境練習題，'
                 '題型比照正式考試：先描述一個產業情境，再問你怎麼判斷。'
                 '作答完成立刻看到分數、正解、解析，以及你最該補的觀念。',
        'unitNote': '對應每週上課內容，每單元 10 題。上完課當天寫一次，考前再寫一次。',
        'goalNote': '本課程的目標分數策略是：科目一守 60–65 分、科目二衝 80 分以上。',
        'facets': [
            {'label': '科目一', 'short': '科目一', 'field': 's', 'value': '科一'},
            {'label': '科目二', 'short': '科目二', 'field': 's', 'value': '科二'},
        ],
        'tagFields': ['w', 's', 'lc', 't'],
        'units': units,
        'mixes': mixes,
        'questions': [
            {'id': q['id'], 'w': q['w'], 's': q['s'], 'lc': q['lc'], 't': q['t'],
             'ind': q['ind'], 'q': q['q'], 'o': q['o'], 'a': q['a'], 'e': q['e']}
            for q in bank
        ],
    }
    path = os.path.join(OUTB, out['id'] + '.json')
    json.dump(out, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    return {'id': out['id'], 'file': out['id'] + '.json',
            'title': out['title'], 'subtitle': out['subtitle']}


COURSES = [build_cchs]

if __name__ == '__main__':
    entries = [fn() for fn in COURSES]
    manifest = {'site': '學後即測', 'banks': entries}
    json.dump(manifest, open(os.path.join(OUTB, 'manifest.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    for e in entries:
        size = os.path.getsize(os.path.join(OUTB, e['file']))
        print('%-28s %7.1f KB' % (e['file'], size / 1024))
    print('manifest.json 完成，共 %d 門課' % len(entries))
