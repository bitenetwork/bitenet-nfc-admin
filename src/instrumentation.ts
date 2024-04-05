import * as cron from "cron";
import { cronSync } from "./server/core/cron";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("instrumentation register");
    const job = new cron.CronJob("0 0 0 * * *", function () {
      console.log("run every day - " + new Date());
      cronSync();
    });
    job.start();
  }
}
