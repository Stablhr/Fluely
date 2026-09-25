"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const app_1 = __importDefault(require("./app"));
const db_1 = require("./api/config/db");
const env_1 = require("./api/config/env");
let dbInitPromise = null;
const ensureDb = () => {
    if (!dbInitPromise) {
        dbInitPromise = (0, db_1.connectDb)();
    }
    return dbInitPromise;
};
async function handler(req, res) {
    try {
        await ensureDb();
        return (0, app_1.default)(req, res);
    }
    catch (error) {
        console.error('Failed to connect to database', error);
        return res.status(500).json({ message: 'Database connection failed' });
    }
}
if (process.env.VERCEL !== '1') {
    ensureDb()
        .then(() => {
        app_1.default.listen(env_1.env.PORT, () => {
            console.log(`Server listening on port ${env_1.env.PORT}`);
        });
    })
        .catch(error => {
        console.error('Failed to connect to database', error);
        process.exit(1);
    });
}
