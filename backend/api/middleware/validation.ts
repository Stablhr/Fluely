import {z} from 'zod';
import {Request, Response, NextFunction} from 'express';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';

type RequestSchemas = {
  body?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
};

function validationError(error: z.ZodError): ApiError {
  const flattened = error.flatten();
  const firstFieldError = Object.values(flattened.fieldErrors)
    .flat()
    .filter(Boolean)[0];
  const firstFormError = flattened.formErrors.filter(Boolean)[0];
  const message = firstFieldError ?? firstFormError ?? 'Invalid request';
  return new ApiError(400, ErrorCodes.VALIDATION_ERROR, message, flattened);
}

export const validateRequest =
  (schemas: RequestSchemas) =>
  (req: Request, _res: Response, next: NextFunction) => {
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
    } catch (error) {
      return next(error);
    }
  };

export const validate =
  (schema: z.ZodTypeAny) =>
  (req: Request, res: Response, next: NextFunction) =>
    validateRequest({body: schema})(req, res, next);
