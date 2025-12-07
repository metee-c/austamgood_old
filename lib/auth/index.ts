// Main export file for authentication module
// This file exports all authentication-related functions and types

// Password utilities
export {
  hashPassword,
  verifyPassword,
  validatePassword
} from './password';

// Session management
export {
  generateSessionToken,
  createSession,
  validateSession,
  updateSessionActivity,
  invalidateSession,
  getSessionTokenFromCookies,
  getSessionTokenFromRequest,
  setSessionCookie,
  clearSessionCookie,
  getCurrentSession,
  getUserActiveSessions,
  invalidateOtherSessions
} from './session';

export type {
  SessionData,
  CreateSessionOptions
} from './session';

// Token management
export {
  generateSecureToken,
  createPasswordResetToken,
  validatePasswordResetToken,
  usePasswordResetToken,
  generateEmailVerificationToken,
  generateTOTPSecret,
  validateTOTPCode,
  cleanupExpiredTokens,
  getUserResetTokens,
  invalidateUserResetTokens
} from './tokens';

export type {
  CreateResetTokenOptions,
  ResetTokenData
} from './tokens';

// Audit logging
export {
  logAuditEntry,
  getAuditLogs,
  getUserAuditTrail,
  logAuthEvent,
  logDataChange,
  logPermissionChange,
  getAuditStatistics
} from './audit';

export type {
  AuditLogEntry,
  AuditLogQuery,
  AuditLogResult
} from './audit';

// Login attempts
export {
  logLoginAttempt,
  checkLoginRateLimit,
  getLoginAttemptStats,
  getUserFailedAttempts,
  getSuspiciousLoginPatterns,
  getRecentLoginAttempts,
  cleanupOldLoginAttempts
} from './login-attempts';

export type {
  LoginAttemptData,
  LoginAttemptOptions,
  RateLimitCheck
} from './login-attempts';

// Middleware
export {
  authenticateRequest,
  checkUserPermissions,
  getClientIP,
  withAuth,
  rateLimit
} from './middleware';

export type {
  AuthMiddlewareOptions,
  AuthenticatedRequest
} from './middleware';

// System settings
export {
  getSystemSetting,
  getAuthSettings,
  updateSystemSetting,
  updateAuthSettings,
  getAllSystemSettings,
  resetToDefaultSettings
} from './settings';

export type {
  SystemSetting,
  AuthSettings
} from './settings';

// Main authentication service
export {
  login,
  logout,
  registerUser,
  requestPasswordReset,
  resetPassword,
  changePassword
} from './auth-service';

export type {
  LoginCredentials,
  LoginResult,
  RegisterUserData,
  RegisterResult,
  PasswordResetRequest,
  PasswordResetResult,
  PasswordChangeData,
  PasswordChangeResult
} from './auth-service';
