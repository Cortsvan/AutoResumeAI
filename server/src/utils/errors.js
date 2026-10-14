export class AppError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} code machine-readable code
   * @param {string} publicMessage safe message for the client
   */
  constructor(status, code, publicMessage, details) {
    super(publicMessage);
    this.status = status;
    this.code = code;
    this.publicMessage = publicMessage;
    this.details = details;
  }
}

export const badRequest = (code, msg, details) => new AppError(400, code, msg, details);
