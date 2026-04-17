const hash = '$argon2id$v=19$m=65536,t=3,p=4$cQ8lHKCnsDBqbqwQGGIR4g$eHbfO70Qw/OWWhCUO495Men4V2FIZwYOWzIMWPPZLKs';
db.users.updateOne(
  { email: 'superadmin@rishabh.tail09a4d0.ts.net' },
  { $set: { email: 'superadmin@rishabh.tail09a4d0.ts.net', password: hash, role: 'superadmin', domain: 'rishabh.tail09a4d0.ts.net', quotaMb: 1024, active: true, createdAt: new Date() } },
  { upsert: true }
);
print('Done — superadmin created.');