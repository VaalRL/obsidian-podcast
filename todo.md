# Obsidian Podcast Player - 開發任務清單

> 本專案目標：建立功能完整的 Podcast 播放與管理插件，參考 Podnote 基礎功能並提供更精細的管理能力

## 專案狀態
- **當前階段**：專案初始化與架構規劃
- **最後更新**：2025-11-14
- **開發分支**：`claude/obsidian-podcast-plugin-013CvMVJ3jvNFJNGN2svacbT`

---

## 📋 階段一：專案基礎建設（當前階段）

### ✅ 已完成
- [x] 專案規範文件更新（CLAUDE.md, gemini.md, agents.md）
- [x] 開發指南文件更新（claude/ 和 gemini/ 目錄）
- [x] 專案架構規劃與模組定義
- [x] 資料持久化策略定義（檔案系統儲存）

### 🔄 進行中
- [ ] Test Vault 開發環境設定
  - [ ] 建立 `Test Vault/.obsidian/plugins/podcast-player/` 目錄
  - [ ] 設定符號連結或構建腳本，將編譯輸出導向 Test Vault
  - [ ] 設定熱重載（開發模式）
  - [ ] 建立測試用的 Podcast 資料與範例筆記

- [ ] 基礎專案設定
  - [ ] 建立 manifest.json（插件資訊）
  - [ ] 建立 package.json（依賴與腳本）
  - [ ] 設定 TypeScript 配置（tsconfig.json）
  - [ ] 設定 esbuild 構建配置（輸出到 Test Vault）
  - [ ] 設定測試環境（Jest）
  - [ ] 建立基礎 main.ts（插件入口）

### 📝 待辦
- [ ] 建立核心資料模型（src/model/）
  - [ ] Podcast 介面定義
  - [ ] Episode 介面定義
  - [ ] Playlist 介面定義
  - [ ] Queue 介面定義
  - [ ] PodcastSettings 介面定義
- [ ] 基礎工具函數（src/utils/）
  - [ ] Logger.ts
  - [ ] errorUtils.ts
  - [ ] timeUtils.ts
  - [ ] audioUtils.ts

---

## 📋 階段二：核心功能開發（Feed 管理）

### Feed 解析模組（src/feed/）
- [ ] RSSParser.ts - RSS Feed 解析器
  - [ ] 實作 RSS 2.0 格式解析
  - [ ] 單元測試（RSSParser.test.ts）
- [ ] AtomParser.ts - Atom Feed 解析器
  - [ ] 實作 Atom 1.0 格式解析
  - [ ] 單元測試（AtomParser.test.ts）
- [ ] FeedService.ts - Feed 服務核心
  - [ ] Feed 訂閱功能
  - [ ] Feed 更新檢測
  - [ ] 錯誤處理與重試機制
  - [ ] 單元測試（FeedService.test.ts）
- [ ] FeedSyncManager.ts - Feed 同步管理
  - [ ] 背景同步排程
  - [ ] 增量更新策略
  - [ ] 單元測試（FeedSyncManager.test.ts）

---

## 📋 階段三：核心功能開發（Podcast 管理）

### Podcast 處理模組（src/podcast/）
- [ ] PodcastService.ts - Podcast 服務核心
  - [ ] Podcast 訂閱管理
  - [ ] Podcast 資訊更新
  - [ ] Podcast 刪除
  - [ ] 單元測試（PodcastService.test.ts）
- [ ] PodcastParser.ts - Podcast 元數據解析
  - [ ] 封面圖片處理
  - [ ] 作者資訊解析
  - [ ] 單元測試（PodcastParser.test.ts）
- [ ] EpisodeManager.ts - Episode 管理
  - [ ] Episode 列表管理
  - [ ] Episode 標記（已聽、收藏）
  - [ ] Episode 下載管理（選用）
  - [ ] 單元測試（EpisodeManager.test.ts）

---

## 📋 階段四：核心功能開發（播放器）

### 播放器模組（src/player/）
- [ ] PlayerController.ts - 播放器控制器
  - [ ] 播放/暫停/停止控制
  - [ ] 音量控制
  - [ ] 播放速度控制
  - [ ] 跳躍控制（前進/後退）
  - [ ] 單元測試（PlayerController.test.ts）
- [ ] PlaybackEngine.ts - 播放引擎
  - [ ] HTML5 Audio API 整合
  - [ ] 音訊預載
  - [ ] 錯誤恢復機制
  - [ ] 單元測試（PlaybackEngine.test.ts）
- [ ] ProgressTracker.ts - 進度追蹤
  - [ ] 播放進度記錄
  - [ ] 斷點續播支援
  - [ ] 進度同步
  - [ ] 單元測試（ProgressTracker.test.ts）

---

## 📋 階段五：進階功能開發（清單與佇列）

### 播放清單模組（src/playlist/）
- [ ] PlaylistManager.ts - 播放清單管理器
  - [ ] 建立/刪除播放清單
  - [ ] 新增/移除 Episode
  - [ ] 播放清單排序
  - [ ] 單元測試（PlaylistManager.test.ts）
- [ ] PlaylistStore.ts - 播放清單儲存
  - [ ] 資料持久化
  - [ ] 資料匯入/匯出
  - [ ] 單元測試（PlaylistStore.test.ts）

### 播放佇列模組（src/queue/）
- [ ] QueueManager.ts - 佇列管理器
  - [ ] 佇列建立與管理
  - [ ] Episode 加入佇列
  - [ ] 自動播放下一首
  - [ ] 單元測試（QueueManager.test.ts）
- [ ] QueueStore.ts - 佇列儲存
  - [ ] 佇列狀態持久化
  - [ ] 單元測試（QueueStore.test.ts）

---

## 📋 階段六：資料持久化

> **資料儲存策略**：使用可設定的資料夾（預設 `.obsidian/plugins/podcast-player/data/`）中的 md/json/yaml 檔案來儲存所有資料

### 儲存模組（src/storage/）
- [ ] FileSystemStore.ts - 檔案系統儲存基礎類別
  - [ ] 檔案讀寫抽象層（支援 JSON/YAML/Markdown）
  - [ ] 資料夾路徑設定與管理
  - [ ] 檔案鎖定與並發控制
  - [ ] 錯誤處理與備份機制
  - [ ] 單元測試（FileSystemStore.test.ts）

- [ ] SubscriptionStore.ts - 訂閱儲存
  - [ ] 儲存格式：`subscriptions.json` 或個別 Podcast 的 `.md` 檔案
  - [ ] Podcast 訂閱資料管理（CRUD）
  - [ ] 資料遷移機制（版本升級）
  - [ ] 自動備份機制
  - [ ] 單元測試（SubscriptionStore.test.ts）

- [ ] ProgressStore.ts - 播放進度儲存
  - [ ] 儲存格式：`progress.json` 或 `progress/[podcast-id].json`
  - [ ] Episode 播放進度記錄
  - [ ] 歷史記錄管理（保留最近 N 天）
  - [ ] 進度清理策略
  - [ ] 單元測試（ProgressStore.test.ts）

- [ ] SettingsStore.ts - 設定儲存
  - [ ] 儲存格式：`settings.json`
  - [ ] 全域設定管理
  - [ ] Podcast 個別設定（覆寫全域設定）
  - [ ] 設定匯入/匯出（JSON/YAML）
  - [ ] 設定驗證與預設值
  - [ ] 單元測試（SettingsStore.test.ts）

- [ ] CacheStore.ts - 本地快取儲存
  - [ ] 儲存格式：`cache/` 資料夾，各類型資料分別儲存
  - [ ] Feed 快取（`cache/feeds/[feed-id].json`）
  - [ ] 圖片快取（`cache/images/[hash].jpg`）
  - [ ] 快取過期策略（基於時間戳）
  - [ ] 快取清理與大小限制
  - [ ] 單元測試（CacheStore.test.ts）

- [ ] DataPathManager.ts - 資料路徑管理
  - [ ] 可設定的資料夾路徑
  - [ ] 自動建立必要的子目錄結構
  - [ ] 路徑驗證與權限檢查
  - [ ] 單元測試（DataPathManager.test.ts）

### 資料夾結構設計
```
.obsidian/plugins/podcast-player/data/
├── settings.json              # 全域設定
├── subscriptions.json         # 訂閱列表（或用 subscriptions/ 資料夾）
├── progress.json              # 播放進度（或用 progress/ 資料夾）
├── playlists/                 # 播放清單
│   ├── [playlist-id].json
│   └── ...
├── queues/                    # 播放佇列
│   ├── [queue-id].json
│   └── ...
├── cache/                     # 快取資料
│   ├── feeds/                 # Feed 快取
│   │   └── [feed-hash].json
│   └── images/                # 圖片快取
│       └── [image-hash].jpg
└── backups/                   # 自動備份
    └── [timestamp]/
```

---

## 📋 階段七：Markdown 整合

### Markdown 模組（src/markdown/）
- [ ] NoteExporter.ts - 筆記匯出器
  - [ ] Episode 資訊匯出
  - [ ] Front Matter 生成
  - [ ] 模板系統
  - [ ] 單元測試（NoteExporter.test.ts）
- [ ] TimestampFormatter.ts - 時間戳格式化
  - [ ] 播放位置時間戳
  - [ ] 可點擊跳轉
  - [ ] 單元測試（TimestampFormatter.test.ts）

---

## 📋 階段八：使用者介面

### UI 模組（src/ui/）
- [ ] PlayerView.ts - 播放器檢視
  - [ ] 播放控制 UI
  - [ ] 進度條
  - [ ] Episode 資訊顯示
  - [ ] 整合測試
- [ ] PodcastListView.ts - Podcast 列表檢視
  - [ ] 訂閱 Podcast 列表
  - [ ] 搜尋與篩選
  - [ ] 排序功能
  - [ ] 整合測試
- [ ] EpisodeListView.ts - Episode 列表檢視
  - [ ] Episode 列表顯示
  - [ ] 狀態標記（已聽、未聽）
  - [ ] 快速操作
  - [ ] 整合測試
- [ ] PlaylistView.ts - 播放清單檢視
  - [ ] 播放清單管理 UI
  - [ ] 拖放排序
  - [ ] 整合測試
- [ ] QueueView.ts - 佇列檢視
  - [ ] 當前佇列顯示
  - [ ] 佇列編輯
  - [ ] 整合測試
- [ ] SettingsTab.ts - 設定頁籤
  - [ ] 全域設定 UI
  - [ ] Podcast 個別設定
  - [ ] 整合測試

---

## 📋 階段九：插件整合

### 主程式（根目錄）
- [ ] main.ts - 插件入口
  - [ ] Plugin 類別實作
  - [ ] onload 生命週期
  - [ ] onunload 清理
  - [ ] 命令註冊
  - [ ] Ribbon 圖示
  - [ ] 整合測試
- [ ] settings.ts - 設定管理
  - [ ] 設定介面定義
  - [ ] 預設值
  - [ ] 設定載入/儲存
- [ ] styles.css - 樣式
  - [ ] 播放器樣式
  - [ ] 列表樣式
  - [ ] 響應式設計
  - [ ] 主題相容性

---

## 📋 階段十：進階功能

### 個別 Podcast 設定
- [ ] 音量設定
- [ ] 播放速度設定
- [ ] 跳過開頭秒數設定
- [ ] 設定繼承與覆寫邏輯

### 快捷操作
- [ ] 快速匯入到筆記
- [ ] 鍵盤快捷鍵
- [ ] 右鍵選單整合

### 同步與備份
- [ ] 訂閱資料匯出
- [ ] 訂閱資料匯入
- [ ] 播放進度備份

---

## 📋 階段十一：測試與優化

### 測試覆蓋
- [ ] 單元測試覆蓋率 > 80%
- [ ] 整合測試覆蓋核心流程
- [ ] E2E 測試（選用）

### 性能優化
- [ ] Feed 同步效能
- [ ] UI 渲染效能
- [ ] 記憶體使用優化
- [ ] 大量 Episode 處理

### 錯誤處理
- [ ] 網路錯誤處理
- [ ] Feed 格式錯誤處理
- [ ] 音訊載入錯誤處理
- [ ] 使用者友好的錯誤訊息

---

## 📋 階段十二：文件與發布

### 文件
- [ ] README.md
  - [ ] 功能介紹
  - [ ] 安裝說明
  - [ ] 使用教學
  - [ ] 截圖/GIF 示範
- [ ] CHANGELOG.md
- [ ] 貢獻指南
- [ ] 授權聲明

### 發布準備
- [ ] 版本號管理
- [ ] 構建測試
- [ ] 插件市場資料準備
- [ ] 發布到 Obsidian 插件市場

---

## 🎯 里程碑

### M1: 基礎架構完成 (預估: 第 1-2 週)
- 專案設定完成
- 核心資料模型定義
- 基礎工具函數

### M2: Feed 管理功能 (預估: 第 3-4 週)
- RSS/Atom 解析
- Feed 訂閱與同步
- Podcast 管理

### M3: 播放器核心 (預估: 第 5-6 週)
- 播放控制
- 進度追蹤
- 基礎 UI

### M4: 進階功能 (預估: 第 7-8 週)
- 播放清單
- 播放佇列
- Markdown 整合

### M5: 完整 UI (預估: 第 9-10 週)
- 所有檢視完成
- 設定頁面
- 樣式優化

### M6: 測試與優化 (預估: 第 11-12 週)
- 測試覆蓋
- 性能優化
- Bug 修復

### M7: 發布準備 (預估: 第 13-14 週)
- 文件完成
- 發布到市場

---

## 📝 注意事項

### 開發原則（遵循 CLAUDE.md）
- ✅ **先找再做**：搜尋現有實作，延伸而非重寫
- ✅ **測試先行**：TDD，Red → Green → Refactor
- ✅ **修正優先**：優先修正現有組件，而非新建
- ✅ **單一真實來源**：避免重複實作
- ✅ **檔案規範**：不在 root 新增非必要檔案
- ✅ **Test Vault 開發**：所有實作直接在 Test Vault 中開發與測試

### 開發流程
1. **開發環境**：使用 `Test Vault` 作為實際開發與測試環境
2. **即時測試**：編譯輸出直接到 `Test Vault/.obsidian/plugins/podcast-player/`
3. **快速迭代**：修改程式碼 → 自動編譯 → Obsidian 重載 → 測試
4. **真實場景**：使用真實的 Podcast Feed 和筆記進行測試

### 技術堆疊
- TypeScript
- Obsidian Plugin API
- esbuild（構建，輸出到 Test Vault）
- Jest（測試）
- rss-parser（Feed 解析）
- HTML5 Audio API（播放器）

### 參考專案
- Podnote - Obsidian Podcast 插件（基礎功能參考）

---

## 🐛 已知問題與待解決

（目前無）

---

## 💡 未來功能構想

- [ ] Podcast 搜尋與探索
- [ ] 離線下載 Episode
- [ ] 播放統計與分析
- [ ] 社群分享功能
- [ ] 與其他 Obsidian 插件整合
- [ ] 跨裝置同步（透過第三方服務）
