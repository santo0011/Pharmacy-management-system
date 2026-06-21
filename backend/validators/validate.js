import { validationResult } from 'express-validator';
import ApiResponse from '../utils/apiResponse.js';

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const extractedErrors = errors.array().map((err) => err.msg);
    return ApiResponse.error(res, 'Validation failed', 400, extractedErrors);
  }
  next();
};

export default validate;