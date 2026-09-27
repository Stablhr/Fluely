"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_routes_1 = __importDefault(require("./auth.routes"));
const media_routes_1 = __importDefault(require("./media.routes"));
const workspace_routes_1 = __importDefault(require("./workspace.routes"));
const router = (0, express_1.default)();
router.use('/auth', auth_routes_1.default);
router.use('/media', media_routes_1.default);
router.use('/workspaces', workspace_routes_1.default);
exports.default = router;
