export class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}
export const badRequest = (m, c = 'BAD_REQUEST') => new HttpError(400, m, c);
export const unauthorized = (m = 'Not signed in', c = 'UNAUTHORIZED') => new HttpError(401, m, c);
export const forbidden = (m = 'Not allowed', c = 'FORBIDDEN') => new HttpError(403, m, c);
export const notFound = (m = 'Not found', c = 'NOT_FOUND') => new HttpError(404, m, c);
/** Wrap async route handlers so thrown errors reach the error middleware. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
