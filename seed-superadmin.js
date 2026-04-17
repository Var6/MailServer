const bcrypt = require("bcryptjs");
const hash = bcrypt.hashSync("ChangeMe123!", 12);
db.users.updateOne(
  { email: "superadmin@localhost" },
  { $set: { email: "superadmin@localhost", password: hash, role: "superadmin", domain: "localhost", quotaMb: 1024, active: true, createdAt: new Date() } },
  { upsert: true }
);
print("Done — superadmin upserted.");