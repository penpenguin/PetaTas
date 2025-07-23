# PetaTas Chrome Extension - Debug Instructions

## 実機テスト時のデバッグ方法

### 1. Chrome Extension の読み込み確認

1. **拡張機能の読み込み**
   - Chrome → `chrome://extensions/`
   - Developer Mode ON
   - "Load unpacked" → `dist` フォルダ選択
   - エラーが表示されたら、manifest.json の構文を確認

2. **拡張機能の状態確認**
   - 拡張機能が一覧に表示されているか
   - "Errors" リンクがある場合はクリックして確認
   - "Service Worker" リンクがある場合はクリックして確認

### 2. Service Worker のデバッグ

1. **Service Worker Console**
   - 拡張機能詳細 → "Service Worker" → "Inspect"
   - コンソールでエラーを確認
   - 以下のメッセージが表示されるはず：
     ```
     PetaTas Service Worker installed
     PetaTas Service Worker activated
     ```

2. **Service Worker の再起動**
   - Service Worker がクラッシュした場合: "Reload" ボタンをクリック

### 3. Side Panel のデバッグ

1. **Side Panel Console**
   - 拡張機能アイコンをクリック → Side Panel が開く
   - Side Panel で右クリック → "Inspect"
   - コンソールでエラーを確認
   - 以下のメッセージが表示されるはず：
     ```
     PetaTas client initializing...
     PetaTas initialized successfully
     ```

2. **よくあるエラーと対処法**
   - `Chrome Extension environment not detected` → Service Worker が動作していない
   - `Clipboard API not available` → HTTPS または localhost でテストする
   - CSS が適用されない → panel.css, task-list.css のパスを確認
   - JavaScript エラー → panel-client.js の構文エラー

### 4. 権限の確認

1. **Storage 権限**
   - Console で以下を実行: `chrome.storage.sync.get(null, console.log)`
   - エラーが出る場合は manifest.json の permissions を確認

2. **Clipboard 権限**
   - Console で以下を実行: `navigator.clipboard.readText().then(console.log)`
   - Permission denied エラーが出る場合は manifest.json の permissions を確認

3. **Side Panel 権限**
   - Console で以下を実行: `chrome.sidePanel.open({tabId: 123})`
   - エラーが出る場合は manifest.json の permissions を確認

### 5. 手動テストチェックリスト

```
□ 拡張機能が正常に読み込まれる
□ Service Worker が起動している
□ 拡張機能アイコンをクリックできる
□ Side Panel が開く
□ Side Panel に UI が表示される
□ "Paste Markdown" ボタンが機能する
□ タスクが正しく表示される
□ タイマーボタンが機能する
□ チェックボックスが機能する
□ 削除ボタンが機能する
□ "Export" ボタンが機能する
□ ページリロード後もタスクが保持される
```

### 6. パフォーマンステスト

1. **貼り付け速度測定**
   ```javascript
   // Console で実行
   const startTime = performance.now();
   // 貼り付け操作を実行
   const endTime = performance.now();
   console.log(`Paste time: ${endTime - startTime} ms`);
   ```

2. **大量データテスト**
   - 50個以上のタスクを含むテーブルをテスト
   - メモリ使用量を Chrome DevTools で確認

### 7. 問題の報告

問題が発生した場合は、以下の情報を記録してください：

1. **環境情報**
   - Chrome バージョン
   - OS バージョン
   - 拡張機能バージョン

2. **エラー情報**
   - コンソールエラーメッセージ
   - 発生した操作
   - 期待される動作

3. **再現手順**
   - 問題を再現する具体的な手順
   - 使用したテストデータ

### 8. 一般的な修正方法

1. **拡張機能の再読み込み**
   - `chrome://extensions/` → 拡張機能の "Reload" ボタン

2. **ハードリフレッシュ**
   - Side Panel で Ctrl+Shift+R (Windows) または Cmd+Shift+R (Mac)

3. **Chrome の再起動**
   - 権限の問題が発生した場合

4. **開発者ツールの Network タブ**
   - CSS/JS ファイルが正しく読み込まれているか確認
   - 404 エラーがないか確認