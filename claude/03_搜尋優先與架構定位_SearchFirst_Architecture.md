# 03｜搜尋優先與架構定位（Search-First & Architecture-First）

## 原則
- **先搜尋**：用 Grep/Glob（專用工具）找既有實作與相似邏輯。
- **理解架構**：閱讀 `main.ts` 和核心模組（見 CLAUDE.md 專案概況）。
- **延伸，不複製**：不要產生 `*_v2`, `enhanced_*`, `*_new` 類別或平行檔案。

## 專案架構概覽

### 核心入口
- `main.ts` - 插件主類別，管理生命週期與註冊功能

### 功能模組
- `src/email/` - 郵件處理
  - `EmailService.ts` - 郵件服務核心
  - `EmailParser.ts` - 郵件解析器
  - `EmailSyncManager.ts` - 同步管理
  - `EmailAdapter.ts` - 適配器抽象
  - `ProxyEmailAdapter.ts`, `WebSocketEmailAdapter.ts` - 具體實現
  
- `src/crypto/` - 加密服務
  - `OpenPGPService.ts` - OpenPGP 加密
  - `SMIMEService.ts` - S/MIME 加密
  
- `src/markdown/` - Markdown 處理
  - `EmailMarkdownRenderer.ts` - 郵件渲染器
  - `ComposeMarkdownModal.ts` - 編輯模態框
  
- `src/model/` - 資料模型
  - `index.ts` - 核心模型定義
  
- `src/storage/` - 資料持久化
  - `ContactStore.ts` - 聯絡人儲存
  - `LocalCache.ts` - 本地快取
  
- `src/ui/` - 使用者介面
  - `EmailListView.ts` - 郵件列表檢視
  - `EmailDetailView.ts` - 郵件詳情檢視
  - `ComposeModal.ts` - 撰寫彈窗
  - `SettingsTab.ts` - 設定頁籤
  
- `src/utils/` - 工具函數
  - `Logger.ts` - 日誌工具
  - `errorUtils.ts` - 錯誤處理
  - `contactTools.ts` - 聯絡人工具
  - `frontMatterTools.ts` - Front Matter 處理

## 禁止事項
- 重複檔案／重複邏輯（造成多個 SSOT）
- 硬寫常數（應改用 `src/settings.ts` 管理）
- 繞過既有架構直接實作（破壞 Obsidian 插件模式）

## 整併策略（Consolidate Early）
- 發現相似功能儘早抽取共用模組
- 主動償還技術債，保持結構乾淨
- 優先修正現有組件，而非創建替代組件

## 推薦流程
1. 搜尋現有實作 → 2. 閱讀核心檔案 → 3. 理解設計意圖 → 4. 設計延伸方案 → 5. 實作＋測試 → 6. 整併與文件

## 快速定位指南
```typescript
// 要找某功能？先搜尋：
- EmailService - 郵件核心功能
- OpenPGPService / SMIMEService - 加密功能
- SettingsManager - 設定存取
- ContactStore - 聯絡人資料
- EmailListView / EmailDetailView - UI 組件
```
