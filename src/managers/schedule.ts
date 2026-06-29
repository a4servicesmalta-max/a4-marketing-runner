import type { Config } from "../config.js";
import { runDueManagers } from "./run.js";

/** Start the daily department-manager scheduler. Restart-safe: it checks every
 *  30 min whether it's past the run hour and a manager hasn't run today yet
 *  (dedup via manager_runs), so a redeploy can't miss or double-fire the day. */
export function startManagers(cfg: Config): void {
  if (!cfg.MANAGERS_ENABLED) {
    console.log("[managers] disabled");
    return;
  }
  const tick = () => {
    runDueManagers(cfg).catch((e) => console.error("[managers] tick error:", e instanceof Error ? e.message : e));
  };
  console.log(`[managers] scheduler on — daily after ${String(cfg.MANAGER_RUN_HOUR).padStart(2, "0")}:00 ${cfg.MANAGERS_TZ}`);
  setTimeout(tick, 12_000);            // check shortly after boot
  setInterval(tick, 30 * 60_000);      // and every 30 minutes
}
