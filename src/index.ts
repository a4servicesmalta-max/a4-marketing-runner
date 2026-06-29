import "./ws-polyfill.js";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
import { startInboxPoller } from "./inbox/poll.js";
import { startManagers } from "./managers/schedule.js";

const cfg = loadConfig();
createApp(cfg).listen(cfg.PORT, () => console.log(`marketing-runner on :${cfg.PORT}`));
startInboxPoller(cfg);
startManagers(cfg);
