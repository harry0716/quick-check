# 學後即測　Quick Check

本專案已獨立整理為 **iPas_AI應用規劃師初級題庫系統**。請先閱讀 [專案入口與搬移說明](00_專案入口與搬移說明.md) 及 [維護交接](maintenance/HANDOFF.md)。題庫主檔在 `data/`，完整原始資料與既有文件在本機 `local-materials/`。

目前維持 18 週：W01–W15 為主題練習（各 10 題），W16 科二 30 題、W17 科一 40 題、W18 科二 40 題。後三週重用既有 150 題，不另造新題。

課後即時測驗與錯誤觀念診斷平台。純靜態網站，放 GitHub Pages 就能用，**學生不需要註冊或登入，知道網址就能作答**。

- 作答完立刻看到分數、每一題的正解與解析
- 自動指出「你最該補的觀念」（依錯題所屬章節統計）
- 錯題自動存進個人錯題本，可單獨重練
- 支援多門課、多題庫，新增課程不必改程式
- 老師可發專屬網址，學生開啟就直接是指定的那一份測驗
- 成績自動回傳到私人 Cloudflare 資料庫，教師可查詢及匯出 CSV

---

## 一、放上 GitHub Pages（約 5 分鐘）

1. 在 GitHub 建一個新的 repository，名稱自取（例如 `quick-check`）。可以是 Public；本專案不含任何個資與機密。
2. 把本資料夾裡的 **`docs/`** 整個上傳到 repository 根目錄（網頁介面：`Add file → Upload files`，把 `docs` 資料夾拖進去即可）。
3. Repository → **Settings → Pages**：
   - Source 選 **Deploy from a branch**
   - Branch 選 **main**、資料夾選 **/docs**，按 Save
4. 等一兩分鐘，網址會長這樣：

   ```
   https://<你的帳號>.github.io/quick-check/
   ```

這個根網址是教師後台，請保留給老師使用；發給學生的是下方的指定測驗連結。

> 若之後想換成自己的網域，在 Settings → Pages 的 Custom domain 設定即可。

### 為什麼不能直接用檔案總管打開 index.html？

題庫是用 `fetch` 讀取 JSON 的，瀏覽器會擋掉 `file://` 的跨檔讀取。要在本機測試，先在 `docs/` 資料夾開一個簡易伺服器：

```bash
cd docs
python3 -m http.server 8000
# 瀏覽器開 http://localhost:8000
```

---

## 二、發給學生的網址

| 情境 | 網址 |
|---|---|
| 教師後台（不發給學生） | `https://…/quick-check/` |
| 指定某一週、測驗模式 | `https://…/quick-check/?b=cchs-ipas-2026&s=w07&m=exam` |
| 指定某一週、練習模式 | `https://…/quick-check/?b=cchs-ipas-2026&s=w07&m=practice` |
| 科目一模擬考 | `https://…/quick-check/?b=cchs-ipas-2026&s=k1&m=exam` |

- `b` = 課程代號（見 `docs/banks/manifest.json`）
- `s` = 測驗代號（`w01`–`w18`、`k1`、`k2`、`mix20`）
- `m` = `exam`（測驗模式，計時、最後才給分）或 `practice`（練習模式，每題立刻對答案）

網站首頁的「老師」區塊列出所有單元的練習與測驗連結，並提供複製按鈕。選擇評量類別後，連結會帶上 `a=class`（課堂）、`a=midterm`（期中）或 `a=final`（期末）。未帶 `a` 的既有學生連結預設為課堂練習。

學生連結的標題、結果、身分頁與錯誤頁都不提供返回教師後台的入口；錯誤或不完整連結請學生向老師重新索取。這是操作路徑分離，不是 RBAC：手動修改網址仍可進入首頁或其他測驗，也沒有伺服器端的週次開放時間控制。

**建議做法**：上完課最後 15 分鐘，投影一個 QR code（用任何線上 QR 產生器把上表的網址轉成圖），學生手機或電腦掃了就開始寫。

---

## 三、收學生成績（Cloudflare）

目前改用 Cloudflare Workers + D1，無需 Google Apps Script 授權。部署維護見 [Cloudflare 說明](collector/cloudflare/README.md)。

學生仍使用原來的逐週連結，填班級、座號、姓名後作答，交卷自動回報。教師預覽及本次錯題重練不回報；重送同一次交卷只存一笔。斷網時可複製結果頁的回報碼交給老師。過去僅存在學生瀏覽器的成績不會自動補傳。

### 教師查詢

1. 開啟 [教師首頁](https://harry0716.github.io/quick-check/)。
2. 從本機 `private/cloudflare-teacher-key.txt` 複製檢視碼，貼入「教師檢視碼」，按「載入／重新整理」。
3. 依班級、學生、測驗、評量類別及模式篩選；選每次、首次、最新或最高分。
4. 按「匯出目前成績 CSV」可用 Excel 開啟。用完按「清除畫面」，移除畫面成績和檢視碼，不刪除資料庫紀錄。

檢視碼只放在 Cloudflare 加密設定和老師私人檔案，不存入瀏覽器或查詢網址。不要分享給學生。採計分組包含課程、測驗、模式、類別、班級、座號與姓名，學生姓名需保持一致。缺交需另與名冊核對；平均分不是學期加權總成績。

成績保存在私人 D1 資料庫，**不會自動寫入 Google 試算表**；舊版逐題統計工作表不在此方案內。Google 接收程式留作備案，切回時須另完成授權及部署驗證。

---

## 四、新增一門課

1. 準備一份題庫 JSON，格式如下（放進 `docs/banks/`）：

```jsonc
{
  "id": "課程代號",
  "title": "課程名稱",
  "subtitle": "副標（學校、班級、學期）",
  "blurb": "首頁的說明文字",
  "goalNote": "結果頁附加的一句提醒，可留空",
  "facets": [                       // 首頁統計卡要顯示的兩個分類
    {"short": "科目一", "field": "s", "value": "科一"},
    {"short": "科目二", "field": "s", "value": "科二"}
  ],
  "tagFields": ["w", "s", "lc", "t"],   // 題目上要顯示哪些欄位當標籤
  "units": [                        // 依單元的測驗
    {"id": "w01", "label": "W01", "title": "單元名稱",
     "field": "w", "value": 1, "timeSec": 600}
  ],
  "mixes": [                        // 綜合／模擬測驗
    {"id": "k1", "label": "科目一模擬 40 題", "note": "說明",
     "field": "s", "value": "科一", "limit": 40, "timeSec": 3000}
  ],
  "questions": [
    {"id": 1, "w": 1, "s": "科一", "lc": "L11101", "t": "AI 定義與分類",
     "q": "題目敘述…", "o": ["選項A", "選項B", "選項C", "選項D"],
     "a": 2, "e": "解析…"}
  ]
}
```

- `a` 是正確選項的索引，從 **0** 開始（0=A、1=B、2=C、3=D）
- `field` / `value` 決定這個測驗從題庫撈哪些題目；不寫就是全部
- `limit` 抽幾題（不寫＝全部）；`timeSec` 限時秒數（不寫＝不計時）

2. 在 `docs/banks/manifest.json` 加一列：

```json
{"id": "課程代號", "file": "課程代號.json", "title": "課程名稱", "subtitle": "副標"}
```

3. 推上 GitHub。首頁會自動出現課程選單（只有一門課時會直接進入該課程）。

`build_site.py` 使用本專案 `data/bank.json` 與 `data/weeks.json`，不依賴上層課程目錄。修改主檔後執行 `python build_site.py`，不要只修改會被重建覆蓋的 `docs/banks/`。新增課程時可依既有流程擴充產生器。

---

## 五、資料與隱私

- 網站本身不蒐集任何資料。錯題本與最佳成績只存在學生自己的瀏覽器（localStorage），換裝置或清除瀏覽資料就會消失。
- 只有在你設定 `endpoint` 且學生透過指定連結完成**練習或測驗**時，班級／座號／姓名與成績才會送到你自己的 Google 試算表。
- 題庫 JSON 含正確答案，任何人打開網頁原始碼都看得到。這個平台定位是**學後即測與觀念矯正**，不是有防弊需求的正式考試——正式評量請用紙筆或有監考機制的系統。

---

## 檔案結構

```
docs/                     ← 這個資料夾就是網站本體，整包放上 GitHub Pages
  index.html
  .nojekyll               ← 讓 GitHub Pages 原樣提供檔案，勿刪
  assets/
    styles.css
    app.js
    config.js             ← 唯一需要你手改的檔案（endpoint 等設定）
  banks/
    manifest.json         ← 課程清單
    cchs-ipas-2026.json   ← 中正高工 iPAS 題庫（150 題）
collector/
  Code.gs                 ← Google Apps Script 成績接收端（選用）
build_site.py             ← 由 bank.json 產生題庫 JSON 的工具
README.md
```

## 驗證與評量限制

執行 `node tests/collector.test.cjs` 與 `node tests/teacher.test.cjs` 可驗證接收端查詢保護、成績格式、重送去重、篩選、採計與清除畫面。Cloudflare 接收端另以 `node tests/cloudflare.test.mjs` 驗證；自動測試不取代線上驗證。部署後需用測試班級完成一次練習及一次測驗，再從教師後台核對並匯出。

此版本支援期中／期末成績**分類與彙整**，未提供防弊、身分認證、伺服器判分、考試單次作答或開放時段限制。學生可修改連結分類或偽造成績請求，公開題庫也含答案，因此正式考試的可信性需另有監考或其他系統支持。
