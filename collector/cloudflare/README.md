# Cloudflare 成績服務

目前收件使用 Cloudflare Workers + D1，不依賴 Google Apps Script 授權。學生連結維持原樣；老師在網站首頁輸入教師檢視碼即可查詢及匯出 CSV。

教師檢視碼保存在本機 `private/cloudflare-teacher-key.txt` 及 Worker 的 `TEACHER_KEY` secret，不得提交到 GitHub。更換電腦時請安全保留私人檔案；遺失可產生新碼後重新設定 secret。Wrangler 登入憑證由官方工具管理，不在專案內。

## 維護與重建

從專案根目錄執行（需要 Node.js 24 以上）：

```powershell
npx wrangler@4.131.2 login
npx wrangler@4.131.2 d1 execute quick-check-grades --remote --file collector/cloudflare/schema.sql --config collector/cloudflare/wrangler.jsonc
npx wrangler@4.131.2 deploy --config collector/cloudflare/wrangler.jsonc
Get-Content private/cloudflare-teacher-key.txt | npx wrangler@4.131.2 secret put TEACHER_KEY --config collector/cloudflare/wrangler.jsonc
```

另一個 Cloudflare 帳號需先建立 D1，更新設定的 account_id、database_id 與 Worker 名稱，再更新前端 endpoint。上面 schema 可重複執行，不清除成績。日常只改 Worker 時只需 deploy；前端變更另推 GitHub Pages。

測試：`node --test --test-isolation=none tests/cloudflare.test.mjs tests/collector.test.cjs tests/teacher.test.cjs` 及 `python tests/portability_test.py`。`/health` 回報服務設定狀態；不包含成績或教師碼。部署後必須再做實際交卷與教師查詢驗證。

## 資料與界線

- 每次正式交卷存入 D1 `attempts`。同一作答識別碼相同內容重送只保留一筆，不同內容拒收。
- 教師查詢使用 HTTPS POST，教師碼放 Authorization 標頭，不放網址。每頁 500 筆，以固定查詢上限讀完全部紀錄。
- 來源限制只允許正式 GitHub Pages 及本機測試網址；更換網域須同步改 ALLOWED_ORIGINS。這不是學生身分驗證，使用者仍可能偽造成績。
- 本課程固定 150 題、18 週及 k1/k2/mix20。擴充課程或題號時需同步更新 Worker 驗證。
- 無自動 Google 試算表同步或舊版 Stats 工作表；教師可匯出 CSV 用 Excel 分析。改用本服務不會自動補傳舊瀏覽器紀錄。
- Worker 未啟用請求觀測日誌，避免記錄學生請求內容。資料保留直到老師刪除；定期從教師介面匯出私人備份。
- D1 備份可用 `wrangler d1 export quick-check-grades --remote --output private/grades-backup.sql --config collector/cloudflare/wrangler.jsonc`；備份含個資，不可提交到 GitHub。

Google 備案仍留在 `collector/Code.gs`；如日後重新使用，設定 `transport: 'jsonp'` 並獨立完成 Google 部署與驗證。
