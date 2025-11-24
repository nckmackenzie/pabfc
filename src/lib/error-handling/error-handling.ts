/**
 * Centralized error handling utilities
 */

import type { ErrorType } from "@/lib/error-handling/app-error";
import {
	AppError,
	AuthenticationError,
	AuthorizationError,
	ConflictError,
	DatabaseError,
	DB_ERROR_MESSAGES,
	NotFoundError,
	ValidationError,
} from "@/lib/error-handling/app-error";

export interface ActionResult {
	error: boolean;
	message: string;
}

export interface ActionSuccess extends ActionResult {
	error: false;
}

export interface ActionError extends ActionResult {
	error: true;
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse(message: string): ActionSuccess {
	return {
		error: false,
		message,
	};
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
	message: string,
	error?: unknown,
): ActionError {
	if (error) {
		// Log based on error type
		if (error instanceof AppError) {
			console.warn("Application error:", {
				name: error.name,
				message: error.message,
				statusCode: error.statusCode,
				isOperational: error.isOperational,
			});
		} else {
			console.error("Unexpected error:", {
				message,
				error: error instanceof Error ? error.message : error,
				stack: error instanceof Error ? error.stack : undefined,
			});
		}
	}

	return {
		error: true,
		message,
	};
}

/**
 * Handles async operations with consistent error handling
 */
export async function handleAsyncOperation<T>(
	operation: () => Promise<T>,
	errorMessage: string = "An error occurred",
): Promise<ActionResult> {
	try {
		await operation();
		return createSuccessResponse("Operation completed successfully");
	} catch (error) {
		const message = error instanceof AppError ? error.message : errorMessage;
		return createErrorResponse(message, error);
	}
}

/**
 * Handles server function errors
 * Re-throws AppError as-is, wraps unexpected errors
 */
export function handleServerError(
	error: unknown,
	errorType: ErrorType,
	context?: string,
): never {
	if (error instanceof AppError) {
		throw error;
	}

	console.error("Unexpected server error:", {
		context,
		error: error instanceof Error ? error.message : error,
		stack: error instanceof Error ? error.stack : undefined,
	});

	throw new DatabaseError(
		errorType,
		error instanceof Error ? error : new Error(String(error)),
	);
}

/**
 * Parses error messages to extract user-friendly title and message
 */
export function parseErrorMessage(error: Error): {
	title: string;
	message: string;
} {
	const errorMessage = error.message;

	if (errorMessage.startsWith("DUPLICATE:")) {
		return {
			title: "Duplicate Entry",
			message: errorMessage.replace("DUPLICATE:", ""),
		};
	}

	if (errorMessage.startsWith("error: ")) {
		return {
			title: "Error",
			message: errorMessage.replace("error:", ""),
		};
	}

	if (errorMessage.startsWith("REFERENCE:")) {
		return {
			title: "Reference Error",
			message: errorMessage.replace("REFERENCE:", ""),
		};
	}

	if (errorMessage.startsWith("NOT_FOUND:")) {
		return {
			title: "Not Found",
			message: errorMessage.replace("NOT_FOUND:", ""),
		};
	}

	if (errorMessage.startsWith("APP_ERROR:")) {
		return {
			title: "Something went wrong",
			message: errorMessage.replace("APP_ERROR:", ""),
		};
	}

	// Handle database constraint violations
	if (errorMessage.includes("violates foreign key constraint")) {
		return {
			title: "Invalid Reference",
			message:
				"The selected reference does not exist. Please refresh and try again.",
		};
	}

	if (errorMessage.includes("Invalid username or password")) {
		return {
			title: "Invalid Credentials",
			message: "Invalid username or password. Please try again.",
		};
	}

	if (errorMessage.includes("violates check constraint")) {
		return {
			title: "Validation Error",
			message: "Please check all required fields and try again.",
		};
	}

	if (errorMessage.includes("violates not-null constraint")) {
		return {
			title: "Missing Required Field",
			message: "Please fill in all required fields.",
		};
	}

	if (errorMessage.includes("violates unique constraint")) {
		return {
			title: "Duplicate Entry",
			message: "This entry already exists. Please use a different value.",
		};
	}

	// Handle network/connection errors
	if (
		errorMessage.includes("fetch failed") ||
		errorMessage.includes("network error")
	) {
		return {
			title: "Connection Error",
			message:
				"Unable to connect to the server. Please check your internet connection.",
		};
	}

	// For any other unexpected errors, return a generic message
	return {
		title: "Error",
		message: "An unexpected error occurred. Please try again.",
	};
}

/**
 * Client-side error handler
 * Extracts user-friendly message and optionally shows toast
 */
export function handleClientError(
	error: unknown,
	options?: {
		errorType?: ErrorType;
		fallbackMessage?: string;
		onError?: (message: string) => void;
	},
): string {
	const fallbackMessage = options?.errorType
		? DB_ERROR_MESSAGES[options.errorType]
		: "An error occurred";

	let message: string;

	if (error instanceof AppError) {
		message = error.message;
	} else if (error instanceof Error) {
		if ("isOperational" in error && error.isOperational) {
			message = error.message;
		}
		message = error.message;
	} else {
		message = fallbackMessage;
	}

	options?.onError?.(message);

	return message;
}

/**
 * Error type guards
 */
export function isAppError(error: unknown): error is AppError {
	return error instanceof AppError;
}

export function isValidationError(error: unknown): error is ValidationError {
	return error instanceof ValidationError;
}

export function isAuthenticationError(
	error: unknown,
): error is AuthenticationError {
	return error instanceof AuthenticationError;
}

export function isAuthorizationError(
	error: unknown,
): error is AuthorizationError {
	return error instanceof AuthorizationError;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
	return error instanceof NotFoundError;
}

export function isConflictError(error: unknown): error is ConflictError {
	return error instanceof ConflictError;
}

export function isDatabaseError(error: unknown): error is DatabaseError {
	return error instanceof DatabaseError;
}

/**
 * @deprecated Use specific error classes instead
 * This function is kept for backward compatibility
 */
export function createErrorMessage(
	error: unknown,
	errorType:
		| "CREATE_FAILED"
		| "UPDATE_FAILED"
		| "DELETE_FAILED"
		| "FETCH_FAILED",
): string {
	console.warn(
		"createErrorMessage is deprecated. Use specific error classes instead.",
	);

	if (error instanceof AppError) {
		return error.message;
	}

	const messages = {
		CREATE_FAILED: "Failed to create record. Please try again",
		UPDATE_FAILED: "Failed to update record. Please try again",
		DELETE_FAILED: "Failed to delete record. Please try again",
		FETCH_FAILED: "Failed to retrieve data. Please try again",
	};

	return messages[errorType];
}
