# 題庫衍生檔產生工具

原始來源為 `../data/bank.json` 及 `../data/weeks.json`，輸出到 `../exports/題庫匯出/`；路徑以程式檔位置計算，可從任意工作目錄執行。

網站不需要這些額外套件。若需重新產生 Excel／Word：Python 需安裝 `openpyxl`，Node.js 需安裝 `docx`（供 `build_paper.js` 使用），再執行 `python tools/export_bank.py`。

已移除原工具對 `/mnt/skills/.../recalc.py` 的依賴。Excel 統計公式由 Excel 開啟時重算。此次已保留既有匯出成品，尚未重新渲染驗證新版 Word／Excel 匯出工具。

完整原始版本另保存在 `local-materials/原始題庫資料/工具/` 作為歷史參考，後續修改請以本資料夾的工具為準。
