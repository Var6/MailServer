// Run inside mongosh to initialize the replica set
// mongosh --eval "load('/setup-replica-set.js')"

rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: process.env.PI_PRIMARY_IP   + ":27017", priority: 2 },
    { _id: 1, host: process.env.PI_SECONDARY_IP + ":27017", priority: 1 },
    { _id: 2, host: "localhost:27017", arbiterOnly: true },
  ],
});

print("Replica set rs0 initiated. Check status with rs.status()");
