"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const handler_1 = require("./bot/handler");
const env_1 = require("./config/env");
// Check essential env vars
if (!env_1.config.TELEGRAM_BOT_TOKEN) {
    console.error('Missing TELEGRAM_BOT_TOKEN');
    process.exit(1);
}
(0, handler_1.startBot)();
//# sourceMappingURL=index.js.map