# 🎱 Turn-base - Bida Đánh Đền Game Manager

Real-time pool game turn management system built with Node.js, Express, Socket.IO, and MongoDB.

## ✨ Features

- 🎮 Real-time game state synchronization
- 👥 Support 3-5 players per match
- 🔄 Auto-fill logic for quick game flow
- 🏆 Automatic match order calculation on win
- 📜 Full game history tracking
- 🔐 Admin authentication & session management
- 📱 Mobile-friendly tap interface
- 🎨 Beautiful gradient UI with player themes

## 🚀 Quick Start (Docker)

### 1. Login to Docker Hub

```bash
docker login
```

### 2. Build & Push Image

**Using Make (Recommended):**

```bash
make push DOCKER_USERNAME=your-username VERSION=v1.0.0
```

**Using Script:**

```bash
./build-and-push.sh your-username v1.0.0
```

**Manual:**

```bash
docker build -t your-username/turn-base:v1.0.0 .
docker push your-username/turn-base:v1.0.0
```

### 3. Deploy on VPS

```bash
# Pull image
docker pull your-username/turn-base:v1.0.0

# Create .env file
cat > .env << EOF
MONGODB_URI=mongodb://your-mongo-host:27017/turn-base
SESSION_SECRET=$(openssl rand -base64 32)
PORT=3000
NODE_ENV=production
EOF

# Run container
docker run -d \
  --name turn-base \
  -p 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  your-username/turn-base:v1.0.0
```

### 4. Seed Admin Account

```bash
docker exec -it turn-base node scripts/seedAdmin.js
```

Default admin credentials:

- Username: `admin`
- Password: `abc@123`

## 📖 Documentation

- [DEPLOY.md](./DEPLOY.md) - Full deployment guide
- [SESSION_MANAGEMENT.md](./SESSION_MANAGEMENT.md) - Session & auth details
- [SOCKET_README.md](./SOCKET_README.md) - Socket.IO events
- [LOGIN_UI_README.md](./LOGIN_UI_README.md) - UI/UX documentation

## 🛠️ Development

### Prerequisites

- Node.js 18+
- MongoDB 4.4+

### Install Dependencies

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and update:

```bash
cp .env.example .env
```

### Seed Data

```bash
# Seed admin account
npm run seed:admin

# Seed sample players
npm run seed
```

### Run Development Server

```bash
npm run dev
```

### Run Tests

```bash
npm test
```

## 📦 Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run test suite
- `npm run seed` - Seed sample players
- `npm run seed:admin` - Create admin account

## 🎮 Game Rules

Đánh Đền (Pool Turn-based) rules:

1. First player is the breaker
2. On error: previous player gets another turn (with swap)
3. Exception: If previous player already errored, no swap
4. Exception: Breaker's first move error doesn't swap
5. Round completes when all players have acted
6. Winner of match becomes breaker of next match

## 🏗️ Tech Stack

- **Backend**: Node.js, Express
- **Database**: MongoDB with Mongoose
- **Real-time**: Socket.IO
- **Session**: express-session + connect-mongo
- **Auth**: bcryptjs
- **Testing**: Mocha + Node Assert

## 📂 Project Structure

```
turn-base/
├── config/          # Database config
├── models/          # Mongoose models
├── routes/          # Express routes
├── sockets/         # Socket.IO handlers
├── utils/           # Game logic utilities
├── public/          # Static files (HTML, CSS, JS)
├── scripts/         # Seed scripts
├── test/            # Test files
├── Dockerfile       # Docker configuration
├── docker-compose.yml
└── Makefile        # Build commands
```

## 🔧 Environment Variables

| Variable         | Description                          | Default                               |
| ---------------- | ------------------------------------ | ------------------------------------- |
| `MONGODB_URI`    | MongoDB connection string            | `mongodb://localhost:27017/turn-base` |
| `SESSION_SECRET` | Secret key for sessions              | (required)                            |
| `PORT`           | Server port                          | `3000`                                |
| `NODE_ENV`       | Environment (development/production) | `development`                         |

## 🐳 Docker Commands

```bash
# Build image
make build VERSION=v1.0.0

# Push to Docker Hub
make push DOCKER_USERNAME=your-username VERSION=v1.0.0

# Run locally
make run

# Stop container
make stop

# Clean up
make clean

# View help
make help
```

## 🚀 Deployment

See [DEPLOY.md](./DEPLOY.md) for complete deployment guide.

**Quick Deploy with Docker Compose:**

```bash
docker-compose up -d
```

## 📝 API Endpoints

### Authentication

- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/status` - Check auth status

### Game State

- `GET /api/game` - Get current game state

### Game History

- `GET /api/history` - Get match history

### Players

- `GET /api/players` - Get all players
- `POST /api/players` - Create player (admin)
- `PUT /api/players/:id` - Update player (admin)
- `DELETE /api/players/:id` - Delete player (admin)

## 🔌 Socket.IO Events

### Client → Server

- `game:start` - Start new game
- `game:error` - Mark player error
- `game:success` - Mark player success
- `game:win` - Mark player win
- `game:reset` - Reset game
- `game:undo` - Undo last action

### Server → Client

- `game:updated` - Game state changed
- `game:win` - Player won
- `auth:status` - Auth status changed
- `admin:force-logout` - Force logout (multi-session)
- `error` - Error occurred

## 🧪 Testing

Run unit tests:

```bash
npm test
```

Tests cover core game logic including:

- Turn advancement
- Player swap rules
- Round completion
- Error handling
- Match order calculation

## 🤝 Contributing

This is a personal project for managing pool games with friends.

## 📄 License

MIT

## 👤 Author

**Viet Hoang**

---

Made with ❤️ for billiards lovers
