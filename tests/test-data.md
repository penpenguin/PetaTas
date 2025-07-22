# PetaTas Chrome Extension - Test Data

## Sample Markdown Tables for Testing

### Test Case 1: Basic Task Table
```markdown
| Task | Status | Notes |
|------|--------|-------|
| Review documentation | todo | Important for project |
| Fix styling issues | in-progress | Almost complete |
| Write tests | todo | Need to add E2E tests |
| Deploy to production | todo | After all tests pass |
```

### Test Case 2: Complex Task Table
```markdown
| Name | State | Description | Priority |
|------|-------|-------------|----------|
| Database migration | todo | Migrate to PostgreSQL | High |
| API documentation | done | Update Swagger docs | Medium |
| Security audit | in-progress | Review authentication | High |
| Performance testing | todo | Load test with 1000 users | Medium |
| UI/UX improvements | todo | Mobile responsive design | Low |
```

### Test Case 3: Minimal Task Table
```markdown
| Task | Status |
|------|--------|
| Call client | todo |
| Send email | done |
| Book meeting | todo |
```

### Test Case 4: Japanese Tasks (Unicode Test)
```markdown
| タスク | ステータス | メモ |
|-------|-----------|------|
| 資料作成 | todo | プレゼン用 |
| 会議準備 | in-progress | 議事録準備 |
| レビュー | done | 完了済み |
```

### Test Case 5: Special Characters
```markdown
| Task | Status | Notes |
|------|--------|-------|
| Fix "bug" #123 | todo | Critical issue |
| Update API (v2.0) | in-progress | Breaking changes |
| Test & Deploy | todo | QA required |
```

## Testing Steps

1. **Load Extension**: Chrome Developer Mode → Load unpacked → Select `dist` folder
2. **Click Extension Icon**: Should open Side Panel
3. **Test Paste**: Copy one of the tables above, click "Paste Markdown"
4. **Test Timer**: Click play button on any task
5. **Test Status**: Click checkbox to mark task as done
6. **Test Delete**: Click trash button to delete task
7. **Test Export**: Click "Export" button to copy to clipboard
8. **Test Persistence**: Refresh page, tasks should remain

## Expected Behavior

- Tasks should appear in the list with proper formatting
- Timers should start/stop correctly and show elapsed time
- Task status should update visually (strikethrough for done)
- Export should generate proper Markdown table format
- No console errors should appear
- Side Panel should remain open during interaction

## Common Issues to Check

- CSS not loading (check paths)
- JavaScript errors (check console)
- Clipboard permissions denied
- Service Worker not running
- Storage not persisting
- Timer not updating
- Side Panel not opening