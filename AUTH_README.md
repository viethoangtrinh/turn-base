# Authentication Guide

## Setup

1. **Seed admin user:**

   ```bash
   npm run seed:admin
   ```

   - Username: `admin`
   - Password: `abc@123`

2. **Environment variables** (`.env`):
   ```
   MONGODB_URI=your_mongodb_uri
   SESSION_SECRET=your_secret_key
   ```

## API Endpoints

### Public Routes (Guest có thể access)

- `GET /api/game` - Xem game state hiện tại
- `GET /api/players` - Xem danh sách players
- `GET /api/history` - Xem lịch sử game

### Auth Routes

- `POST /api/auth/login` - Đăng nhập

  ```json
  {
    "username": "admin",
    "password": "abc@123"
  }
  ```

- `POST /api/auth/logout` - Đăng xuất

- `GET /api/auth/me` - Kiểm tra user hiện tại

### Protected Routes (Chỉ Admin)

- `POST /api/game/start` - Bắt đầu game
- `POST /api/game/error` - Đánh dấu người chơi lỗi
- `POST /api/game/success` - Đánh dấu người chơi thành công
- `POST /api/game/reset` - Reset game
- `POST /api/game` - Update game state
- `POST /api/history/undo` - Undo action

## Session Management

- Session lưu trong MongoDB (MongoStore)
- Thời gian sống: 24 giờ
- Cookie httpOnly, secure=false (đổi thành true khi dùng HTTPS)

## Testing

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"abc@123"}' \
  -c cookies.txt

# Check user
curl http://localhost:3000/api/auth/me -b cookies.txt

# Access protected route
curl -X POST http://localhost:3000/api/game/reset -b cookies.txt

# Logout
curl -X POST http://localhost:3000/api/auth/logout -b cookies.txt
```

## Security Notes

- Passwords được hash bằng bcryptjs
- Session-based auth (không dùng JWT)
- Chỉ 1 admin account (đơn giản cho app nội bộ)
- Guest chỉ xem, không được thao tác
