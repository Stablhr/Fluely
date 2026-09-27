"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoardCollaboratorModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const product_1 = require("../constants/product");
const BoardCollaboratorSchema = new mongoose_1.Schema({
    boardId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Board',
        required: true,
        index: true
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    role: { type: String, enum: product_1.CollaboratorRoles, required: true, default: 'viewer' },
    status: {
        type: String,
        enum: product_1.CollaboratorStatuses,
        required: true,
        default: 'pending'
    },
    invitedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    invitedAt: { type: Date, required: true, default: Date.now },
    respondedAt: { type: Date, default: null }
}, { timestamps: true });
// One row per (board, user). A re-invite overwrites the existing row rather
// than creating a duplicate.
BoardCollaboratorSchema.index({ boardId: 1, userId: 1 }, { unique: true });
// Serves the invitee's "what is waiting for me" query.
BoardCollaboratorSchema.index({ userId: 1, status: 1 });
exports.BoardCollaboratorModel = mongoose_1.default.model('BoardCollaborator', BoardCollaboratorSchema, 'board_collaborators');
