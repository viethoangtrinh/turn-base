# Turn Order (Billiards)

App quản lý lượt chơi billiards với logic swap-on-error và real-time sync.

## Setup

1. **Cài đặt dependencies:**

```bash
npm install
```

2. **Cấu hình môi trường:**

```bash
cp .env.example .env
# Sửa .env với MongoDB connection string của bạn
```

3. **Chạy server:**

```bash
npm start
# Mở http://localhost:3000
```

## Luật chơi

- Chạm vào tên: đánh dấu **lỗi**
- Kéo sang trái ←: **thắng trận** 🏆
- Người lỗi → swap với người trước (nếu người trước chưa lỗi)
- Trạng thái lỗi chỉ xóa khi người đó đánh thành công
- Người thắng lên đầu ở trận mới

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** MongoDB + Mongoose
- **Frontend:** Vanilla JS + CSS
- **Real-time:** (Coming soon: Socket.IO)
