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
exports.BoardModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const product_1 = require("../constants/product");
const BoardSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 5000 },
    ownerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workspaceId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Workspace', default: null, index: true },
    visibility: {
        type: String,
        enum: product_1.BoardVisibilities,
        required: true,
        default: 'private'
    },
    publicSlug: { type: String, default: null },
    background: { type: String, default: 'default', maxlength: 500 },
    backgroundMediaId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'MediaAttachment', default: null },
    labels: {
        type: [
            {
                id: { type: String, required: true },
                name: { type: String, required: true },
                color: { type: String, required: true }
            }
        ],
        default: []
    },
    template: { type: String, default: 'blank' },
    settings: {
        commentPermission: { type: String, default: 'members' },
        selfJoin: { type: Boolean, default: false }
    },
    listOrder: { type: [mongoose_1.Schema.Types.ObjectId], default: [] },
    revision: { type: Number, default: 1, min: 1 },
    archivedAt: { type: Date, default: null }
}, { timestamps: true });
// Only public boards are addressable by slug, and each slug must be unique.
BoardSchema.index({ publicSlug: 1 }, { unique: true, sparse: true });
// Drives the "workspace boards" listing.
BoardSchema.index({ workspaceId: 1, visibility: 1 });
exports.BoardModel = mongoose_1.default.model('Board', BoardSchema, 'boards');
