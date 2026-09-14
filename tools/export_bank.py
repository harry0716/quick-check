# -*- coding: utf-8 -*-
"""
中正高工 115-1 彈性課程　iPAS 題庫匯出工具
------------------------------------------------------------------
把 bank.json 匯出成多種格式，方便依不同情境使用：

    python3 export_bank.py

產出（全部放在 out/題庫匯出/）：
    題庫_全部_UTF8BOM.csv          Excel 直接開不會亂碼；也可匯入 Quizizz、Wordwall 等平台
    依週次CSV/W01.csv … W15.csv     每週一檔，隨堂測驗用
    題庫_全部.xlsx                  含篩選、凍結窗格、統計工作表
    題庫_教師本_含答案解析.docx      150 題完整版，備課與紙本複習用
    試卷_科目一模擬40題.docx         學生用（無答案）
    試卷_科目一模擬40題_解答.docx     教師用（含答案與解析）
    試卷_科目二模擬40題.docx
    試卷_科目二模擬40題_解答.docx

要改抽題數量或範圍，改最下方 main() 裡的參數即可。
"""
import json, csv, os, random, subprocess, sys

BASE = os.path.dirname(os.path.abspath(__file__))
BANK = json.load(open(os.path.join(BASE, '..', 'data', 'bank.json'), encoding='utf-8'))
WEEKS = {str(w['no']): w['title'] for w in
         json.load(open(os.path.join(BASE, '..', 'data', 'weeks.json'), encoding='utf-8'))['weeks']}
OUT = os.path.join(BASE, '..', 'exports', '題庫匯出')
os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(OUT, '依週次CSV'), exist_ok=True)

KEYS = ['A', 'B', 'C', 'D']
HEADERS = ['編號', '週次', '單元', '科目', 'L代碼', '主題', '產業情境', '難度',
           '題目', '選項A', '選項B', '選項C', '選項D', '正確答案', '解析']


def row_of(q):
    return [q['id'], q['w'], WEEKS.get(str(q['w']), ''), q['s'], q['lc'], q['t'],
            q['ind'], q['lv'], q['q'], q['o'][0], q['o'][1], q['o'][2], q['o'][3],
            KEYS[q['a']], q['e']]


# ---------------------------------------------------------------- CSV
def export_csv():
    # UTF-8 with BOM，Excel 雙擊開啟不會變亂碼
    p = os.path.join(OUT, '題庫_全部_UTF8BOM.csv')
    with open(p, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(HEADERS)
        for q in BANK:
            w.writerow(row_of(q))

    for wk in sorted({q['w'] for q in BANK}):
        p = os.path.join(OUT, '依週次CSV', f'W{wk:02d}.csv')
        with open(p, 'w', encoding='utf-8-sig', newline='') as f:
            w = csv.writer(f)
            w.writerow(HEADERS)
            for q in BANK:
                if q['w'] == wk:
                    w.writerow(row_of(q))
    print('CSV 完成')


# ---------------------------------------------------------------- XLSX
def export_xlsx():
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    ws = wb.active
    ws.title = '全部題庫'

    head_font = Font(name='Arial', bold=True, size=11, color='FFFFFF')
    head_fill = PatternFill('solid', fgColor='0E6B4F')
    body_font = Font(name='Arial', size=10)
    ans_font = Font(name='Arial', size=10, bold=True, color='0E6B4F')
    thin = Side(style='thin', color='D0D7D2')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    ws.append(HEADERS)
    for c in range(1, len(HEADERS) + 1):
        cell = ws.cell(row=1, column=c)
        cell.font = head_font
        cell.fill = head_fill
        cell.alignment = Alignment(horizontal='center', vertical='center')
        cell.border = border

    for q in BANK:
        ws.append(row_of(q))

    widths = [7, 7, 24, 7, 10, 16, 11, 7, 60, 30, 30, 30, 30, 10, 60]
    for i, wdt in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = wdt

    for r in range(2, ws.max_row + 1):
        for c in range(1, len(HEADERS) + 1):
            cell = ws.cell(row=r, column=c)
            cell.font = ans_font if c == 14 else body_font
            cell.border = border
            cell.alignment = Alignment(
                vertical='top',
                wrap_text=c in (3, 9, 10, 11, 12, 13, 15),
                horizontal='center' if c in (1, 2, 4, 8, 14) else 'left')
        ws.row_dimensions[r].height = 58

    ws.freeze_panes = 'A2'
    ws.auto_filter.ref = f'A1:{get_column_letter(len(HEADERS))}{ws.max_row}'

    # ---- 統計工作表（用公式，不寫死數字）----
    st = wb.create_sheet('統計')
    st['A1'] = '題庫統計'
    st['A1'].font = Font(name='Arial', bold=True, size=14, color='0E6B4F')
    st['A2'] = '本表以公式連動「全部題庫」工作表，新增題目後數字會自動更新。'
    st['A2'].font = Font(name='Arial', size=9, color='777777')

    last = ws.max_row
    st['A4'] = '依週次'
    st['A4'].font = Font(name='Arial', bold=True, size=11)
    st['A5'], st['B5'], st['C5'] = '週次', '單元', '題數'
    weeks = sorted({q['w'] for q in BANK})
    for i, wk in enumerate(weeks):
        r = 6 + i
        st.cell(row=r, column=1, value=wk)
        st.cell(row=r, column=2, value=WEEKS.get(str(wk), ''))
        st.cell(row=r, column=3, value=f"=COUNTIF('全部題庫'!$B$2:$B${last},A{r})")

    r0 = 6 + len(weeks) + 2
    st.cell(row=r0, column=1, value='依科目').font = Font(name='Arial', bold=True, size=11)
    st.cell(row=r0 + 1, column=1, value='科目')
    st.cell(row=r0 + 1, column=3, value='題數')
    for i, s in enumerate(['科一', '科二']):
        r = r0 + 2 + i
        st.cell(row=r, column=1, value=s)
        st.cell(row=r, column=3, value=f"=COUNTIF('全部題庫'!$D$2:$D${last},A{r})")

    r1 = r0 + 5
    st.cell(row=r1, column=1, value='依 L 代碼').font = Font(name='Arial', bold=True, size=11)
    st.cell(row=r1 + 1, column=1, value='L代碼')
    st.cell(row=r1 + 1, column=3, value='題數')
    for i, lc in enumerate(sorted({q['lc'] for q in BANK})):
        r = r1 + 2 + i
        st.cell(row=r, column=1, value=lc)
        st.cell(row=r, column=3, value=f"=COUNTIF('全部題庫'!$E$2:$E${last},A{r})")

    r2 = r1 + 2 + len(sorted({q['lc'] for q in BANK})) + 2
    st.cell(row=r2, column=1, value='總題數').font = Font(name='Arial', bold=True, size=11)
    st.cell(row=r2, column=3, value=f"=COUNTA('全部題庫'!$A$2:$A${last})")

    for col, wdt in (('A', 14), ('B', 34), ('C', 10)):
        st.column_dimensions[col].width = wdt
    for row in st.iter_rows(min_row=1, max_row=st.max_row, max_col=3):
        for cell in row:
            if cell.font.size is None or cell.font.name != 'Arial':
                cell.font = Font(name='Arial', size=10)

    p = os.path.join(OUT, '題庫_全部.xlsx')
    wb.save(p)
    print('XLSX 完成')


# ---------------------------------------------------------------- DOCX
def export_docx(name, qs, with_answer, subtitle):
    payload = {
        'title': name, 'subtitle': subtitle, 'withAnswer': with_answer,
        'items': [{'id': q['id'], 'w': q['w'], 's': q['s'], 'lc': q['lc'], 't': q['t'],
                   'q': q['q'], 'o': q['o'], 'a': q['a'], 'e': q['e']} for q in qs]
    }
    tmp = os.path.join(OUT, '_paper.json')
    json.dump(payload, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False)
    subprocess.run(['node', os.path.join(BASE, 'build_paper.js'), tmp,
                    os.path.join(OUT, name + '.docx')], check=True)
    os.remove(tmp)


def main():
    export_csv()
    export_xlsx()

    export_docx('題庫_教師本_含答案解析', BANK, True,
                '全 150 題，依週次排列，含正確答案與逐題解析')

    rnd = random.Random(1150902)
    k1 = rnd.sample([q for q in BANK if q['s'] == '科一'], 40)
    k2 = rnd.sample([q for q in BANK if q['s'] == '科二'], 40)
    export_docx('試卷_科目一模擬40題', k1, False, '限時 50 分鐘　每題 2.5 分　共 100 分')
    export_docx('試卷_科目一模擬40題_解答', k1, True, '教師用　含答案與解析')
    export_docx('試卷_科目二模擬40題', k2, False, '限時 45 分鐘　每題 2.5 分　共 100 分')
    export_docx('試卷_科目二模擬40題_解答', k2, True, '教師用　含答案與解析')
    print('DOCX 完成')
    print('輸出目錄：', OUT)


if __name__ == '__main__':
    main()
