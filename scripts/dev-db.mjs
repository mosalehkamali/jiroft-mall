/**
 * scripts/dev-db.mjs — a throwaway MongoDB for trying the store locally.
 *
 *   npm run dev:db        (leave it running; data is lost when it stops)
 *
 * Starts a single-node replica set (product writes use transactions, which a
 * standalone mongod does not support) and prints the MONGODB_URI to use.
 * Production needs a real replica set — MongoDB Atlas, or `mongod --replSet`.
 */
import { MongoMemoryReplSet } from "mongodb-memory-server";

const port = Number(process.env.DEV_DB_PORT || 27018);
const set = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
  instanceOpts: [{ port }],
});
const uri = set.getUri("store");
console.log(`\nDev MongoDB is running.\n\n  MONGODB_URI=${uri}\n\nPut that line in .env (or export it), then: npm run seed -- --phone 09120000000 --password secret --demo\nCtrl+C to stop.`);

const stop = async () => {
  await set.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
