import { loadConfig } from "./config.js";
import { createApp } from "./app.js";

const cfg = loadConfig();
createApp(cfg).listen(cfg.PORT, () => console.log(`marketing-runner on :${cfg.PORT}`));
