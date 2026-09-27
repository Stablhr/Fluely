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
exports.WorkspaceMemberModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const Workspace_model_1 = require("./Workspace.model");
const WorkspaceMemberSchema = new mongoose_1.Schema({
    workspaceId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Workspace',
        required: true,
        index: true
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    role: { type: String, enum: Workspace_model_1.WorkspaceMemberRoles, required: true, default: 'member' }
}, { timestamps: true });
// One membership row per (workspace, user). Doubles as the lookup index for
// "which workspaces is this person in".
WorkspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
exports.WorkspaceMemberModel = mongoose_1.default.model('WorkspaceMember', WorkspaceMemberSchema, 'workspace_members');
