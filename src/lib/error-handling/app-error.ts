/**
 * Base Application Error
 * All custom errors should extend this class
 */
export class AppError extends Error {
	public readonly isOperational: boolean;
	public readonly statusCode: number;
	public readonly cause?: unknown;

	constructor(
		message: string,
		isOperational: boolean = true,
		statusCode: number = 500,
		cause?: unknown,
	) {
		super(message);
		this.isOperational = isOperational;
		this.name = "AppError";
		this.statusCode = statusCode;
		this.cause = cause;
		Object.setPrototypeOf(this, new.target.prototype);
	}
}

/**
 * Validation Error (400)
 * Thrown when user input fails validation
 */
export class ValidationError extends AppError {
	constructor(message: string, cause?: unknown) {
		super(message, true, 400, cause);
		this.name = "ValidationError";
	}
}

/**
 * Authentication Error (401)
 * Thrown when user is not authenticated
 */
export class AuthenticationError extends AppError {
	constructor(message: string = "Please log in to continue", cause?: unknown) {
		super(message, true, 401, cause);
		this.name = "AuthenticationError";
	}
}

/**
 * Authorization Error (403)
 * Thrown when user lacks permission
 */
export class AuthorizationError extends AppError {
	constructor(
		message: string = "You don't have permission to perform this action",
		cause?: unknown,
	) {
		super(message, true, 403, cause);
		this.name = "AuthorizationError";
	}
}

/**
 * Not Found Error (404)
 * Thrown when a resource is not found
 */
export class NotFoundError extends AppError {
	constructor(resource: string, identifier?: string, cause?: unknown) {
		const message = identifier
			? `NOT_FOUND:${resource} "${identifier}" not found`
			: `NOT_FOUND:${resource} not found`;
		super(message, true, 404, cause);
		this.name = "NotFoundError";
	}
}

/**
 * Conflict Error (409)
 * Thrown when there's a conflict (e.g., duplicate entry)
 */
export class ConflictError extends AppError {
	constructor(resource: string, value?: string, cause?: unknown) {
		const message = value
			? `DUPLICATE:${resource} "${value}" already exists`
			: `DUPLICATE:${resource} already exists`;
		super(message, true, 409, cause);
		this.name = "ConflictError";
	}
}

/**
 * Resource Referenced Error (409)
 * Thrown when trying to delete a resource that is referenced elsewhere
 */
export class ResourceReferencedError extends AppError {
	constructor(resource: string, identifier?: string, cause?: unknown) {
		const message = identifier
			? `REFERENCE:${resource} "${identifier}" is being referenced and cannot be deleted`
			: `REFERENCE:${resource} is being referenced and cannot be deleted`;
		super(message, true, 409, cause);
		this.name = "ResourceReferencedError";
	}
}

/**
 * Application Error (500)
 * Thrown when database operations fail
 */
export class ApplicationError extends AppError {
	constructor(errorMessage: string, cause?: unknown) {
		const message = `APP_ERROR:${errorMessage}`;
		super(message, true, 500, cause);
		this.name = "ApplicationError";
	}
}

/**
 * Database Error (500)
 * Thrown when database operations fail
 */
export class DatabaseError extends AppError {
	constructor(operation: keyof typeof DB_ERROR_MESSAGES, cause?: unknown) {
		super(DB_ERROR_MESSAGES[operation], true, 500, cause);
		this.name = "DatabaseError";
	}
}

/**
 * Database operation error messages
 */
export const DB_ERROR_MESSAGES = {
	CREATE_FAILED: "Failed to create record. Please try again",
	UPDATE_FAILED: "Failed to update record. Please try again",
	DELETE_FAILED: "Failed to delete record. Please try again",
	FETCH_FAILED: "Failed to retrieve data. Please try again",
	DUPLICATE_ENTRY: "A record with this information already exists",
	REFERENCED_RECORD: "Cannot delete record as it is being used elsewhere",
	TRANSACTION_FAILED: "Operation failed. Please try again",
} as const;

export type ErrorType = keyof typeof DB_ERROR_MESSAGES;
