# 🔒 Single Session Management

## ✅ Implemented Features

### 1. Single Admin Session

**Problem:** Multiple admins could log in simultaneously, causing conflicts.

**Solution:**

- Only ONE admin can be logged in at a time
- New admin login → Force logout old admin
- Old admin receives popup notification

**How it works:**

1. Admin A logs in → Session ID saved to `User.activeSessionId`
2. Admin B logs in → Server detects `activeSessionId` exists
3. Server emits `admin:force-logout` event to Admin A's socket
4. Admin A sees popup: "New admin login from another device"
5. Admin A is auto-logged out
6. Admin B's session ID replaces old one

---

### 2. Single Active Game

**Problem:** Multiple admins could start multiple games simultaneously.

**Solution:**

- Only ONE game can be active at a time
- Start Game button checks `GameState.isActive`
- If game already active → Error message

**How it works:**

1. Admin starts game → `GameState.isActive = true`
2. Another admin tries to start → Blocked with error message
3. Game ends (win/reset) → `isActive = false`
4. New game can be started

---

## 📁 Files Modified

### 1. **`models/User.js`**

Added fields to track active session:

```javascript
activeSessionId: {
  type: String,
  default: null,
},
lastLoginAt: {
  type: Date,
  default: null,
},
```

### 2. **`routes/auth.js`**

#### Login Route:

- Check if admin has existing `activeSessionId`
- Emit `admin:force-logout` to kick old session
- Save new `sessionId` to database
- Update `lastLoginAt`

#### Logout Route:

- Clear `activeSessionId` from database
- Destroy session

### 3. **`sockets/gameHandlers.js`**

#### Game Start Handler:

- Check if `GameState.isActive === true`
- If active → Reject with error message
- If not active → Allow game to start

### 4. **`public/app.js`**

#### Socket Event Handler:

```javascript
socket.on("admin:force-logout", async (data) => {
  // Show popup notification
  await customConfirm(data.reason, "⚠️ Đăng xuất");

  // Logout and return to guest view
  await fetch("/api/auth/logout", { method: "POST" });
  currentUser = { username: "Guest", role: "guest" };
  checkGameState();
});
```

---

## 🧪 Testing Scenarios

### Test 1: Admin Force Logout

**Steps:**

1. Device A: Login as admin
2. Device B: Login as admin with same credentials
3. **Expected:** Device A sees popup and is logged out
4. **Expected:** Device B successfully logged in

### Test 2: Prevent Multiple Games

**Steps:**

1. Admin A: Start a game
2. Admin B: Login and try to start another game
3. **Expected:** Admin B sees error: "Đã có trận đấu đang diễn ra"
4. Admin A: End game (win/reset)
5. Admin B: Try to start game again
6. **Expected:** Game starts successfully

### Test 3: Game Persistence After Admin Logout

**Steps:**

1. Admin: Start a game
2. Admin: Logout
3. Guest: View game (should still be active)
4. Admin: Login again
5. **Expected:** Game still active, admin can continue

---

## 🔐 Security Considerations

### Session ID Storage

- Session ID stored in database (`User.activeSessionId`)
- Compared during login to detect conflicts
- Cleared on logout

### Socket.IO Event

- `admin:force-logout` broadcast to ALL clients
- Each client checks if their session matches `oldSessionId`
- Only matching client logs out

### Database Race Conditions

- Session saved with `await req.session.save()`
- Ensures session ID is available before saving to DB
- Atomic update operations

---

## 📊 Database Schema Updates

### User Model

```javascript
{
  username: String,
  password: String (hashed),
  role: String (admin/guest),
  isActive: Boolean,
  activeSessionId: String,    // ← NEW
  lastLoginAt: Date,           // ← NEW
  createdAt: Date,
  updatedAt: Date
}
```

### GameState Model (no changes needed)

```javascript
{
  singleton: Boolean,
  order: [String],
  currentIndex: Number,
  roundNumber: Number,
  matchNumber: Number,
  isActive: Boolean,          // ← Used for single game check
  // ... other fields
}
```

---

## 🎯 User Experience

### Admin View:

- **Login:** Seamless login, old session kicked automatically
- **Force Logout:** Clear popup explaining why they were logged out
- **Game Start:** Prevented from starting duplicate games

### Guest View:

- **No Impact:** Guests unaffected by admin session changes
- **Game Continuity:** Can continue viewing active game regardless of admin sessions

---

## 🚀 Future Improvements (Optional)

1. **Session Timeout**

   - Auto-logout admin after X minutes of inactivity
   - Show countdown warning before auto-logout

2. **Admin Activity Log**

   - Track all admin logins/logouts
   - Show "Last active" timestamp
   - Audit trail for admin actions

3. **Multi-Admin Support (Advanced)**

   - Allow multiple admins with role-based permissions
   - One "primary" admin, others can only view
   - Queue system for admin actions

4. **Session Recovery**
   - "Resume Session" feature if disconnected briefly
   - Grace period before allowing new admin login

---

## 📝 Console Logs

### Successful Login:

```
✅ Admin login: admin (Session: abc123xyz)
```

### Force Logout:

```
🚨 Kicked old admin session: old-session-id-here
```

### Game Start Blocked:

```
⚠️ Game start rejected: already active (Match 5)
```

### Admin Logout:

```
👋 Admin logout: admin
```

---

## ⚠️ Known Limitations

1. **Socket.IO Required**

   - Force logout only works for connected clients
   - If old admin offline → Can't receive logout event
   - Mitigation: Session validation on reconnect

2. **Session Expiry**

   - Sessions expire after 24 hours
   - Admin must re-login after expiry
   - No persistent "remember me" feature

3. **Network Delays**
   - Force logout event may arrive with delay
   - Old admin might perform 1-2 actions before logout
   - Mitigation: Server validates session on every action
