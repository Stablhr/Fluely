"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBaseUserSchema = createBaseUserSchema;
const mongoose_1 = require("mongoose");
function createBaseUserSchema() {
    const schema = new mongoose_1.Schema({
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        passwordHash: { type: String, required: true },
        username: { type: String, unique: true, sparse: true },
        // Primary workspace. Membership itself lives in the WorkspaceMember
        // collection, which is the source of truth; this field is denormalised
        // for convenience so the UI can resolve a default without a join.
        workspaceId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Workspace', default: null, index: true },
        isVerified: { type: Boolean, default: false },
        verificationCode: { type: String, default: null },
        verificationExpiry: { type: Date, default: null },
        resetCode: { type: String, default: null },
        resetExpiry: { type: Date, default: null }
    }, { timestamps: true });
    return schema;
}
