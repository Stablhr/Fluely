"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = exports.validateRequest = void 0;
const error_1 = require("../utils/error");
const errorCodes_1 = require("../constants/errorCodes");
function validationError(error) {
    const flattened = error.flatten();
    const firstFieldError = Object.values(flattened.fieldErrors)
        .flat()
        .filter(Boolean)[0];
    const firstFormError = flattened.formErrors.filter(Boolean)[0];
    const message = firstFieldError ?? firstFormError ?? 'Invalid request';
    return new error_1.ApiError(400, errorCodes_1.ErrorCodes.VALIDATION_ERROR, message, flattened);
}
const validateRequest = (schemas) => (req, _res, next) => {
    try {
        if (schemas.body) {
            const result = schemas.body.safeParse(req.body);
            if (!result.success) {
                return next(validationError(result.error));
            }
            req.body = result.data;
        }
        if (schemas.params) {
            const result = schemas.params.safeParse(req.params);
            if (!result.success) {
                return next(validationError(result.error));
            }
            req.params = result.data;
        }
        if (schemas.query) {
            const result = schemas.query.safeParse(req.query);
            if (!result.success) {
                return next(validationError(result.error));
            }
            req.query = result.data;
        }
        return next();
    }
    catch (error) {
        return next(error);
    }
};
exports.validateRequest = validateRequest;
const validate = (schema) => (req, res, next) => (0, exports.validateRequest)({ body: schema })(req, res, next);
exports.validate = validate;
