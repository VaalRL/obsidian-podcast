# 04｜程式品質與測試（TDD）

> 適用於 Obsidian Email Client 插件開發

## 指南
- **先寫測試**：Red → Green → Refactor
- **覆蓋率**：維持關鍵路徑與風險區域的高覆蓋；測試即文件
- **避免重複**：共用邏輯抽成測試工具/fixtures

## 專案測試策略

### 單元測試重點
- `src/crypto/OpenPGPService.ts` - 加密/解密流程
- `src/crypto/SMIMEService.ts` - S/MIME 處理
- `src/utils/frontMatterTools.ts` - Front Matter 解析
- `src/storage/ContactStore.ts` - 資料持久化

### 測試檔案規範
- 與源檔案同目錄
- 命名：`原檔名.test.ts`
- 示例：`OpenPGPService.test.ts`

### 測試工具函數
```typescript
// 示例：建立測試用的郵件物件
export function createTestEmail(overrides?: Partial<Email>): Email {
  return {
    uid: 1,
    from: [{ email: 'test@example.com', name: 'Test' }],
    to: [{ email: 'test2@example.com' }],
    subject: 'Test Email',
    text: 'Test content',
    html: false,
    date: new Date(),
    attachments: [],
    ...overrides
  };
}
```

### 避免測試
- Obsidian API（使用模擬）
- UI 渲染（依賴 Obsidian 環境）
- 實際網路請求（使用測試替身）

## 完成定義（DoD）
- 測試通過且可讀性佳
- 未新增重複來源；延伸既有實作
- 關鍵決策記錄清楚
- 構建無錯誤：`npm run build`
