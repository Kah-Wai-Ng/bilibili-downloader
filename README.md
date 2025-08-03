# 🎬 Bilibili 視頻下載器

一個功能完整的網站應用，專門用於下載 Bilibili 視頻，特別支援互動式視頻和隱藏片段的下載。

## ✨ 特色功能

### 🎮 互動式視頻支援
- **自動檢測**：通過 `is_stein_gate` 標識自動檢測互動視頻
- **完整分支發現**：使用遞歸圖遍歷算法發現所有可能的分支路徑
- **多層次探索**：調用多個 API 端點獲取完整的互動視頻結構
  - `/x/stein/edgeinfo_v2` - 獲取分支選擇信息
  - `/x/stein/nodeinfo` - 獲取節點圖信息  
  - `/x/stein/story` - 獲取完整故事結構
- **隱藏內容發現**：自動解析 `hidden_vars` 發現隱藏片段和結局
- **智能分支分類**：
  - 主要分支：用戶選擇驅動的主要劇情路線
  - 隱藏分支：需要特定條件解鎖的隱藏內容
  - 發現分支：通過備用 API 發現的其他片段
- **條件解析**：顯示每個分支的解鎖條件和路徑信息
- **防重複機制**：避免下載重複的CID內容

### 📹 高質量下載
- **多種格式**：支援 BV號、av號、短鏈接等格式
- **高清畫質**：支援 4K、1080P60、1080P、720P 等多種畫質
- **動態URL處理**：智能處理 Bilibili 的動態令牌和參數變化
- **多重API備援**：
  - 標準 playurl API (主要方法)
  - 增強參數 API (互動視頻優化)
  - PUGV API (備用方法)
- **智能流選擇**：自動選擇最佳畫質和編碼格式
- **音頻合併**：使用 FFmpeg 自動合併視頻和音頻流
- **斷點續傳**：支援範圍請求，網路中斷可繼續下載
- **會話管理**：動態生成會話ID避免部分限制

### 🚀 現代化界面
- **響應式設計**：完美適配手機和電腦
- **實時進度**：WebSocket 實時顯示下載進度
- **增強分支顯示**：
  - 分組顯示：主要分支、隱藏分支、發現分支
  - 詳細信息：路徑追蹤、深度顯示、CID信息
  - 條件標註：顯示分支解鎖條件
  - 視覺標識：隱藏、主線等狀態標記
- **批量下載**：支援多個分支同時下載
- **智能錯誤處理**：友好的錯誤提示和重試機制
- **發現統計**：顯示分支發現的詳細統計信息

## 🏗️ 項目結構

```
bilibili-downloader/
├── public/                 # 前端文件
│   ├── index.html         # 主頁面
│   ├── style.css          # 樣式文件
│   └── script.js          # 前端邏輯
├── server.js              # Node.js 後端服務器
├── package.json           # 依賴配置
├── Dockerfile             # Docker 部署配置
├── .gitignore            # Git 忽略文件
├── downloads/             # 下載文件存放目錄
└── temp/                 # 臨時文件目錄
```

## 🚀 使用方式

### 方式一：快速體驗（HTML 版本）
適合快速體驗和查看界面，功能為演示模式。

1. 下載 `public/index.html` 文件
2. 雙擊在瀏覽器中打開
3. 輸入任意 Bilibili 視頻鏈接體驗界面

### 方式二：完整功能（Node.js 版本）
推薦使用，支援真實視頻下載功能。

#### 本地運行
```bash
# 克隆項目
git clone https://github.com/Kah-Wai-Ng/bilibili-downloader.git
cd bilibili-downloader

# 安裝依賴
npm install

# 啟動服務
npm start

# 訪問應用
# 瀏覽器打開 http://localhost:3000
```

#### Docker 部署
```bash
# 構建鏡像
docker build -t bilibili-downloader .

# 運行容器
docker run -p 3000:3000 -v $(pwd)/downloads:/app/downloads bilibili-downloader

# 訪問應用
# 瀏覽器打開 http://localhost:3000
```

#### 雲服務部署
支援部署到 Heroku、Railway、Render 等平台：

```bash
# Heroku 部署
heroku create your-app-name
git push heroku main

# Railway 部署
railway login
railway new
railway up
```

## 📖 使用教程

### 1. 解析視頻
- 在輸入框中貼上 Bilibili 視頻鏈接
- 支援格式：
  - `https://www.bilibili.com/video/BV1xx411c7mD`
  - `https://www.bilibili.com/video/av123456`
  - `https://b23.tv/abc123`
  - `BV1xx411c7mD`
  - `av123456`

### 2. 選擇畫質
- 超清 4K (120)：3840×2160
- 高清 1080P60 (116)：1920×1080 60fps
- 高清 1080P (80)：1920×1080
- 高清 720P60 (74)：1280×720 60fps
- 高清 720P (64)：1280×720
- 清晰 480P (32)：854×480

### 3. 互動式視頻分支選擇
對於互動式視頻，系統會自動：
- 檢測所有可能的分支路徑
- 發現隱藏片段和結局
- 提供分支選擇界面
- 支援全選和批量下載

### 4. 開始下載
- 選擇是否自動合併音頻（推薦）
- 選擇是否下載字幕
- 點擊「開始下載」
- 實時查看下載進度

## 🔧 技術特點

### 反爬蟲處理
- 使用真實瀏覽器 User-Agent
- 設置正確的 Referer 和 Origin
- 模擬真實用戶行為
- 動態會話ID生成
- 智能重試機制

### 互動視頻技術突破
- **遞歸圖遍歷**：從根節點開始遞歸探索整個互動視頻圖結構
- **多API聚合**：結合多個 Bilibili API 獲取完整分支信息
- **深度限制保護**：防止無限遞歸和過深探索
- **CID去重機制**：避免重複處理相同內容
- **條件解析引擎**：解析分支解鎖條件和依賴關係

### 動態URL處理
- **多重備援策略**：標準API失敗時自動切換備用方法
- **參數優化**：針對不同視頻類型使用最佳參數組合
- **令牌管理**：處理 Bilibili 的動態訪問令牌
- **流格式適配**：智能選擇 DASH 或 FLV 格式

### API 集成
- Bilibili 官方 API 調用
- 互動視頻專用 API 支援
- 錯誤處理和重試機制
- 智能降級策略

### 性能優化
- 並發下載支援
- 斷點續傳功能
- WebSocket 實時通訊
- 資源清理機制
- 智能延遲控制

## 📋 系統要求

### 本地運行
- Node.js 16.0.0 或更高版本
- FFmpeg（用於視頻合併）
- 足夠的磁盤空間

### Docker 運行
- Docker 引擎
- 至少 1GB 內存
- 足夠的磁盤空間

## 🛠️ 開發指南

### 安裝開發依賴
```bash
npm install --include=dev
```

### 開發模式運行
```bash
npm run dev
```

### 測試增強功能
```bash
node test-enhanced-features.js
```

## 🔧 故障排除

### 互動視頻下載問題
- **症狀**：只能下載到第一段視頻，無法下載其他分支
- **原因**：舊版本只解析基礎分支信息，未進行完整圖遍歷
- **解決**：更新到最新版本，使用增強的遞歸分支發現算法

### 動態URL問題
- **症狀**：每次複製的視頻URL都不一樣
- **原因**：Bilibili使用動態令牌和參數防止盜鏈
- **解決**：使用多重API備援策略和智能參數處理

### 網絡連接問題
- **症狀**：解析視頻時出現網絡錯誤
- **原因**：網絡不穩定或被反爬蟲機制阻止
- **解決**：
  1. 檢查網絡連接
  2. 更換網絡環境
  3. 等待一段時間後重試
  4. 確保系統時間正確

### API限制問題
- **症狀**：頻繁出現API錯誤
- **原因**：請求過於頻繁觸發限制
- **解決**：程序已內建延遲控制，會自動調節請求頻率

### API 文檔

#### POST /api/parse
解析視頻信息
```json
{
  "url": "BV1xx411c7mD"
}
```

#### POST /api/download
開始下載
```json
{
  "videoInfo": {...},
  "quality": 80,
  "branches": ["branch_1", "branch_2"],
  "options": {
    "mergeAudio": true,
    "downloadSubtitle": false
  }
}
```

#### GET /api/progress/:id
獲取下載進度

#### GET /api/health
健康檢查

## ⚠️ 法律聲明

本工具僅供個人學習和研究使用，請遵守相關法律法規和 Bilibili 服務條款：

1. **合法使用**：僅下載您有合法使用權的內容
2. **個人用途**：不得用於商業用途或侵犯版權
3. **尊重創作者**：請支持原創作者，下載不等於擁有版權
4. **服務條款**：使用本工具即表示您同意遵守相關服務條款

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request 來改進項目！

## 📄 許可證

MIT License - 詳見 [LICENSE](LICENSE) 文件

## 🙏 致謝

感謝 Bilibili 提供的 API 服務和開源社區的支持。

---

⭐ 如果這個項目對您有幫助，請給個 Star 支持一下！
