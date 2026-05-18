/**
 * Standard HTTP JSON envelope for successful API responses.
 * Errors use the same `{ success: false, error }` shape from `error.middleware.js`.
 */
class ApiResponseDto {
  /**
   * @param {object} data - Response payload (often a DTO or DTO composition).
   */
  static success(data) {
    return {
      success: true,
      data,
    };
  }
}

module.exports = { ApiResponseDto };
