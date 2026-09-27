"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const media_controller_1 = require("../controllers/media.controller");
const validation_1 = require("../middleware/validation");
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../middleware/rateLimit");
const upload_1 = require("../middleware/upload");
const product_dto_1 = require("../dtos/product.dto");
const router = (0, express_1.Router)();
// every media route is account-scoped
router.use(auth_1.requireAuth);
router.post('/', rateLimit_1.uploadLimiter, upload_1.handleUploadErrors, upload_1.uploadMedia.array('files', 10), media_controller_1.mediaController.upload);
router.get('/', rateLimit_1.authReadLimiter, (0, validation_1.validateRequest)({ query: product_dto_1.mediaListQuerySchema }), media_controller_1.mediaController.list);
router.delete('/:mediaId', rateLimit_1.authActionLimiter, (0, validation_1.validateRequest)({ params: product_dto_1.mediaIdParamsSchema }), media_controller_1.mediaController.remove);
exports.default = router;
