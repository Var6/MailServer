// ============================================================
//  MongoDB Init Script — creates mailserver DB + users
// ============================================================

db = db.getSiblingDB("mailserver");

db.createCollection("users");
db.createCollection("domains");

// Index for fast email lookups
db.users.createIndex({ email: 1 }, { unique: true });
db.domains.createIndex({ name: 1 }, { unique: true });

// Create dedicated API user
db.createUser({
  user: "mailserver",
  pwd: process.env.MONGO_APP_PASSWORD || "changeme",
  roles: [{ role: "readWrite", db: "mailserver" }],
});

print("MongoDB mailserver database initialized.");
