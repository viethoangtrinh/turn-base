require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");

    // Xóa user cũ
    await User.deleteMany({});
    console.log("Cleared old users");

    // Tạo admin user
    const admin = await User.create({
      username: "admin",
      password: "abc@123",
      role: "admin",
    });

    console.log(`✅ Created admin user: ${admin.username}`);
    console.log(`   Password: abc@123`);

    process.exit(0);
  } catch (error) {
    console.error("Seed error:", error);
    process.exit(1);
  }
};

seedAdmin();
