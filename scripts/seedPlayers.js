require("dotenv").config();
const mongoose = require("mongoose");
const Player = require("../models/Player");

const defaultPlayers = [
  { name: "Việt Hoàng", displayOrder: 1 },
  { name: "Hùng Anh", displayOrder: 2 },
  { name: "Tân", displayOrder: 3 },
  { name: "Duy Thuần", displayOrder: 4 },
  { name: "Tấn Đạt", displayOrder: 5 },
  { name: "Tuấn", displayOrder: 6 },
  { name: "Báo", displayOrder: 7 },
  { name: "Duy Mai", displayOrder: 8 },
  { name: "Đạt Đông", displayOrder: 9 },
];

const seedPlayers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");

    // Xóa players cũ
    await Player.deleteMany({});
    console.log("Cleared old players");

    // Thêm players mới
    const players = await Player.insertMany(defaultPlayers);
    console.log(`✅ Seeded ${players.length} players:`);
    players.forEach((p) => console.log(`  - ${p.name}`));

    process.exit(0);
  } catch (error) {
    console.error("Seed error:", error);
    process.exit(1);
  }
};

seedPlayers();
