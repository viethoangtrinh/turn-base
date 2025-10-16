# Socket.IO Real-time Sync

## Overview

Socket.IO được tích hợp để sync game state real-time giữa admin và guests.

## Architecture

### Server-side Events

#### Emitted by Server:

- `auth:status` - Gửi thông tin user khi connect
- `game:updated` - Broadcast game state mới cho tất cả clients
- `game:win` - Thông báo có người thắng
- `error` - Thông báo lỗi

#### Listened by Server:

- `game:start` - Admin bắt đầu game mới
- `game:error` - Admin đánh dấu player lỗi
- `game:success` - Admin đánh dấu player thành công
- `game:win` - Admin xác nhận player thắng
- `game:reset` - Admin reset game
- `game:undo` - Admin undo action cuối

### Client-side Integration

```javascript
// Connect to server
const socket = io();

// Listen for updates
socket.on("game:updated", (gameState) => {
  // Update UI automatically
  order = gameState.order;
  currentIndex = gameState.currentIndex;
  renderOrder();
});

// Emit events (admin only)
socket.emit("game:error", { playerName: "Tân" });
```

## Flow Example

### Scenario: Admin chọn Tân lỗi

```
1. Admin browser → tap "Tân"
   ↓
2. Client emits: socket.emit('game:error', { playerName: 'Tân' })
   ↓
3. Server receives → Updates GameState in MongoDB
   ↓
4. Server broadcasts: io.emit('game:updated', newState)
   ↓
5. ALL clients (admin + guests) receive update
   ↓
6. Browsers auto re-render UI
```

## Session Integration

- Socket.IO shares session with Express
- `req.session` accessible in socket handlers
- Admin/Guest permissions checked via `session.role`

```javascript
socket.on("game:error", (data) => {
  const role = socket.request.session?.role;
  if (role !== "admin") {
    return socket.emit("error", { message: "Admin required" });
  }
  // Process event...
});
```

## Auto-reconnection

Socket.IO tự động reconnect khi mất kết nối:

```javascript
socket.on("connect", () => {
  console.log("Connected");
});

socket.on("disconnect", () => {
  console.log("Disconnected - will auto-reconnect");
});
```

## Testing

### Test với curl (HTTP endpoint vẫn hoạt động):

```bash
curl http://localhost:3000/api/game
```

### Test với browser:

1. Mở 2 tabs: Tab 1 (Admin), Tab 2 (Guest)
2. Tab 1: Login → Start game → Chọn lỗi
3. Tab 2: Tự động update không cần refresh

## Features

✅ **Bidirectional** - Client ↔ Server realtime
✅ **Broadcast** - 1 admin update → tất cả clients nhận
✅ **Session-aware** - Admin/Guest permissions
✅ **Auto-reconnect** - Tự động kết nối lại
✅ **Low latency** - Update < 100ms
✅ **Fallback** - Long-polling nếu WebSocket fail

## Notes

- Guest CHỈ nhận updates, không emit events
- Admin emit events → Server validate → Broadcast cho all
- Game state lưu trong MongoDB, Socket.IO chỉ sync
- History (undo) cũng được lưu database
