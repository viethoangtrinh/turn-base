Turn Order (Swap On Error)

Chạy:

```
npm install
npm start
# http://localhost:3000
```

Luật:

- Mặc định 5 người: VH, HA, Tân, DyT, TĐ. Có thể kéo-thả để sắp xếp.
- Hoàn tất lượt: sang người tiếp theo.
- Lỗi: đổi chỗ với người ngay trước; lượt kế tiếp là người sau lượt lỗi.
- Thắng: xoay danh sách để người thắng lên đầu và bắt đầu trận mới.
