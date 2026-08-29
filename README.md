# 學後即測　Quick Check

課後即時測驗與錯誤觀念診斷平台。純靜態網站，放 GitHub Pages 就能用，**學生不需要註冊或登入，知道網址就能作答**。

- 作答完立刻看到分數、每一題的正解與解析
- 自動指出「你最該補的觀念」（依錯題所屬章節統計）
- 錯題自動存進個人錯題本，可單獨重練
- 支援多門課、多題庫，新增課程不必改程式
- 老師可發專屬網址，學生開啟就直接是指定的那一份測驗
- 成績可自動回傳到你自己的 Google 試算表（選用）

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

把這個網址給學生就可以了。

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
| 讓學生自己選單元 | `https://…/quick-check/` |
| 指定某一週、測驗模式 | `https://…/quick-check/?b=cchs-ipas-2026&s=w07&m=exam` |
| 指定某一週、練習模式 | `https://…/quick-check/?b=cchs-ipas-2026&s=w07&m=practice` |
| 科目一模擬考 | `https://…/quick-check/?b=cchs-ipas-2026&s=k1&m=exam` |

- `b` = 課程代號（見 `docs/banks/manifest.json`）
- `s` = 測驗代號（`w01`–`w15`、`k1`、`k2`、`mix20`）
- `m` = `exam`（測驗模式，計時、最後才給分）或 `practice`（練習模式，每題立刻對答案）

網站首頁的「老師」區塊會直接列出可複製的網址。

**建議做法**：上完課最後 15 分鐘，投影一個 QR code（用任何線上 QR 產生器把上表的網址轉成圖），學生手機或電腦掃了就開始寫。

---

## 三、收學生成績（選用，約 10 分鐘）

不設定的話，網站完全靜態，學生只看得到自己的成績。要收成績，加一個 Google Apps Script 端點：

1. 開 <https://script.google.com> → 新增專案，把 `collector/Code.gs` 整段貼上，儲存。
2. 函式選單選 **`setup`** → 執行。第一次會要求授權：
   *檢閱權限 → 選帳號 → 進階 → 前往「專案名稱」（不安全）→ 允許*
   （這個警告是因為指令碼未經 Google 審查，是你自己寫的，可以放行。）
   執行紀錄（Ctrl+Enter）會印出成績試算表網址。
3. 右上 **部署 → 新增部署作業 → 網頁應用程式**
   - 執行身分：**我**
   - 誰可以存取：**所有人** ← 這一項一定要選，學生才不用登入
   - 按部署，複製 `.../exec` 結尾的網址。
4. 編輯 `docs/assets/config.js`：

   ```js
   endpoint: 'https://script.google.com/macros/s/AKfycb..../exec',
   ```

   推回 GitHub，等一分鐘生效。

設定完成後，**測驗模式**會先要求學生填班級／座號／姓名，交卷後自動回報。萬一網路不通，結果頁的「回報碼」可以複製給你。

### 你會拿到什麼

試算表「學後即測　成績紀錄」有兩個工作表：

- **作答紀錄** — 每人每次一列：時間、課程、測驗、班級座號姓名、得分、百分比、作答秒數、答錯題號、逐題對錯序列
- **逐題統計** — 每一題的出現次數、答錯次數、**答錯率**。這張表就是教學檢討用的：答錯率高的題目，代表那個觀念全班都沒聽懂

執行一次 `sortItemStats` 可把逐題統計依答錯率由高到低排序。

> 改了 `Code.gs` 之後要重新部署才會生效：**部署 → 管理部署作業 → 編輯（鉛筆）→ 版本選「新增版本」→ 部署**。網址不會變。

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

`build_site.py` 是把既有的 `bank.json` 轉成上面格式的產生器，新增課程時可以照著改。

---

## 五、資料與隱私

- 網站本身不蒐集任何資料。錯題本與最佳成績只存在學生自己的瀏覽器（localStorage），換裝置或清除瀏覽資料就會消失。
- 只有在你設定 `endpoint` 且學生在**測驗模式**作答時，班級／座號／姓名與成績才會送到你自己的 Google 試算表。
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
