import { Pool } from "pg";
import { loadConfig } from "./config.js";
import { buildServer } from "./server.js";
import { chain } from "./chain.js";
import { CHAIN_ID } from "../../../packages/protocol/index.js";
import { prune } from "./retention.js";
const config = loadConfig(),
  pool = new Pool({ connectionString: config.DATABASE_URL, max: 10 });
await pool.query("SELECT 1");
if ((await chain(config.SEPOLIA_RPC_URL).client.getChainId()) !== CHAIN_ID)
  throw new Error("RPC must point to Sepolia");
const app = await buildServer(config, pool);
await prune(pool);
const timer = setInterval(
  () =>
    prune(pool).catch((e) =>
      app.log.error({ message: e.message }, "Retention failed"),
    ),
  60 * 60 * 1000,
);
timer.unref();
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    clearInterval(timer);
    await app.close();
    await pool.end();
    process.exit(0);
  });
await app.listen({ port: config.PORT, host: "0.0.0.0" });
