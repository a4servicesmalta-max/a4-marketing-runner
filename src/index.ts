import { loadConfig } from "./config.js";
import { createApp } from "./app.js";

const cfg = loadConfig();
const app = createApp();
app.listen(cfg.PORT, () => console.log(`marketing-runner on :${cfg.PORT}`));
