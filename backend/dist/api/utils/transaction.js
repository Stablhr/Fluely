"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withProductTransaction = withProductTransaction;
const mongoose_1 = __importDefault(require("mongoose"));
function isUnsupportedTransaction(error) {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const record = error;
    const code = record.code;
    const message = typeof record.message === 'string' ? record.message : '';
    return (code === 20 ||
        code === 303 ||
        code === 263 ||
        message.toLowerCase().includes('transaction') &&
            (message.toLowerCase().includes('not supported') || message.toLowerCase().includes('replica set')));
}
async function withProductTransaction(work) {
    let session;
    try {
        session = await mongoose_1.default.startSession();
        let result;
        await session.withTransaction(async () => {
            result = await work(session);
        });
        if (result === undefined) {
            throw new Error('Transaction completed without a result');
        }
        return result;
    }
    catch (error) {
        if (!isUnsupportedTransaction(error)) {
            throw error;
        }
        return work(undefined);
    }
    finally {
        if (session) {
            await session.endSession();
        }
    }
}
