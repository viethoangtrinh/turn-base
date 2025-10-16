# Login UI Documentation

## Overview

Login screen đã được tích hợp vào ứng dụng để phân quyền Admin/Guest.

## Features

### 🔑 Login Screen

Hiển thị đầu tiên khi mở app:

- **Form đăng nhập:** Username + Password
- **Button Admin:** Đăng nhập với quyền admin
- **Button Guest:** Tiếp tục xem mà không cần đăng nhập
- **Error message:** Hiển thị khi login thất bại

### 👤 User Badge

Badge hiển thị ở góc trên phải:

- **Admin:** 👑 admin (màu xanh lá)
- **Guest:** 👤 Guest (màu xanh dương)
- **Logout button:** Đăng xuất và quay về login screen

## User Flow

### 1. First Visit (Chưa login)

```
User mở app
  ↓
Login screen xuất hiện
  ↓
2 options:
  - Login as Admin → Full control
  - Continue as Guest → View only
```

### 2. Login as Admin

```
1. Nhập username: admin
2. Nhập password: abc@123
3. Bấm "Đăng nhập Admin"
  ↓
✅ Success → Setup screen
   - Badge hiển thị: 👑 admin
   - Có thể start game, chọn lỗi/thắng
  ↓
❌ Failed → Error message
   - "Invalid credentials"
   - Thử lại
```

### 3. Continue as Guest

```
1. Bấm "Tiếp tục với tư cách Khách"
  ↓
✅ Vào setup screen
   - Badge hiển thị: 👤 Guest
   - CHỈ xem được
   - KHÔNG start game hay thao tác
```

### 4. Logout

```
Bấm "Đăng xuất" ở badge
  ↓
Session bị destroy
  ↓
Quay về login screen
```

## Session Persistence

### Admin Login

- Session lưu trong MongoDB
- Expires sau 24h
- Refresh browser → Vẫn đăng nhập (trong 24h)

### Guest Mode

- Không có session
- Refresh browser → Quay về login screen

## UI Components

### Login Form

```html
<form id="login-form">
  <input type="text" name="username" placeholder="admin" />
  <input type="password" name="password" placeholder="••••••" />
  <button type="submit">🔑 Đăng nhập Admin</button>
  <button type="button">👤 Tiếp tục với tư cách Khách</button>
</form>
```

### User Badge

```html
<div class="user-badge admin">
  <!-- or no 'admin' class for guest -->
  <span class="badge-icon">👑</span>
  <!-- 👤 for guest -->
  <span>admin</span>
  <!-- or 'Guest' -->
  <span class="badge-logout">Đăng xuất</span>
</div>
```

## Styling

### Colors

**Admin Badge:**

- Background: `rgba(16, 185, 129, 0.1)` (green)
- Border: `rgba(16, 185, 129, 0.3)`

**Guest Badge:**

- Background: `rgba(59, 130, 246, 0.1)` (blue)
- Border: `rgba(59, 130, 246, 0.3)`

### Responsive

- Mobile-friendly
- Touch-optimized buttons
- Auto-complete enabled for login fields

## API Integration

### Check Auth Status

```javascript
// On app load
fetch("/api/auth/me").then((response) => {
  if (response.ok) {
    // Already logged in → Go to setup
  } else {
    // Not logged in → Show login screen
  }
});
```

### Login

```javascript
fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, password }),
});
```

### Logout

```javascript
fetch("/api/auth/logout", { method: "POST" });
```

## Permissions

| Action     | Admin | Guest |
| ---------- | ----- | ----- |
| View game  | ✅    | ✅    |
| Start game | ✅    | ❌    |
| Mark error | ✅    | ❌    |
| Mark win   | ✅    | ❌    |
| Reset game | ✅    | ❌    |

## Screenshots (Conceptual)

### Login Screen

```
┌─────────────────────────────────┐
│     [Duy Brothers Logo]         │
│                                 │
│   🎱 Đăng nhập                  │
│   Đăng nhập để quản lý...      │
│                                 │
│   ┌─────────────────────────┐  │
│   │ Tài khoản               │  │
│   │ [admin____________]     │  │
│   └─────────────────────────┘  │
│   ┌─────────────────────────┐  │
│   │ Mật khẩu                │  │
│   │ [••••••___________]     │  │
│   └─────────────────────────┘  │
│                                 │
│   [🔑 Đăng nhập Admin]         │
│   [👤 Tiếp tục Khách]          │
│                                 │
│   💡 Gợi ý:                     │
│   • Admin: Toàn quyền          │
│   • Khách: Chỉ xem             │
└─────────────────────────────────┘
```

### Setup Screen (Logged In)

```
┌─────────────────────────────────┐
│     [Logo]        [👑 admin ⊗] │ ← User badge
│                                 │
│   Lại nghiện rồi đấy =))       │
│   [Player List]                │
│   ...                           │
└─────────────────────────────────┘
```

## Testing

### Test Admin Login

```bash
# Browser console
fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'abc@123'
  })
}).then(r => r.json()).then(console.log);
```

### Test Guest Mode

- Just click "Tiếp tục với tư cách Khách"
- No API call needed
- Local state only

## Notes

- ✅ Mobile-friendly design
- ✅ Auto-focus on username field
- ✅ Enter key submits form
- ✅ Session persistent across refreshes (admin only)
- ✅ Guest mode = no session
- ✅ Logout clears session
- ✅ Error messages user-friendly
- ✅ Icons for visual clarity (👑 admin, 👤 guest)

---

**Login UI ready! 🎉**
