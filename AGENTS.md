# 題庫系統維護指引

開始工作先讀 `00_專案入口與搬移說明.md`、`maintenance/HANDOFF.md`、`README.md`。

- 本專案是獨立 Git repository。所有執行路徑必須相對於專案或程式檔，不得依賴外部學年度課程目錄。
- 題庫來源是 `data/bank.json`，週次来源是 `data/weeks.json`；`docs/banks/` 是 `python build_site.py` 的產物。保留題號與題庫代號，避免破壞既有連結與歷次成績。
- 保留 18 週架構、教師逐週發連結、不做完整 RBAC 的使用者決策。
- 學生流程不得提供回教師首頁、全部题庫或其他週次的按鈕。教師預覽、錯題重練不得污染正式作答紀錄。
- `local-materials/`、`private/`、`exports/`、`backups/` 都是本機資料，不要用 `git add -f` 放上公開 GitHub。教師檢視碼、成績、名冊與其他私人資料不得寫入前端或提交紀錄。
- 重要變更需同步更新 `maintenance/HANDOFF.md` 及 `CHANGELOG.md`，尤其部署完成／未完成事項與使用者决策。
- 適用檢查：`python tests/portability_test.py`、`node tests/collector.test.cjs`、`node tests/teacher.test.cjs`。UI 變更另做瀏覽器驗證。
- 更新 `collector/Code.gs` 後必須另更新 Google Apps Script 部署；沒有端點與跨裝置驗證就不能宣稱成績收集已啟用。
