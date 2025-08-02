# 🎬 Bilibili 視頻下載器

一個功能完整的網站應用，專門用於下載 Bilibili 視頻，特別支援互動式視頻和隱藏片段的下載。

## ✨ 特色功能

### 🎮 互動式視頻支援
- **自動檢測**：通過 `is_stein_gate` 標識自動檢測互動視頻
- **分支解析**：調用 `/x/stein/edgeinfo_v2` API 獲取所有分支路徑
- **隱藏內容發現**：解析 `hidden_vars` 發現隱藏片段和結局
- **完整下載**：支援下載所有分支，不遺漏任何內容

### 📹 高質量下載
- **多種格式**：支援 BV號、av號、短鏈接等格式
- **高清畫質**：支援 4K、1080P60、1080P、720P 等多種畫質
- **音頻合併**：使用 FFmpeg 自動合併視頻和音頻流
- **斷點續傳**：支援範圍請求，網路中斷可繼續下載

### 🚀 現代化界面
- **響應式設計**：完美適配手機和電腦
- **實時進度**：WebSocket 實時顯示下載進度
- **批量下載**：支援多個分支同時下載
- **錯誤處理**：完善的錯誤提示和重試機制

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

### API 集成
- Bilibili 官方 API 調用
- 互動視頻專用 API 支援
- 錯誤處理和重試機制

### 性能優化
- 並發下載支援
- 斷點續傳功能
- WebSocket 實時通訊
- 資源清理機制

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
