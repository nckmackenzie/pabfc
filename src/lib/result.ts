export type Result<T, E = AppError> =
	| { success: true; data: T }
	| { success: false; error: E };

export type AppError =
	| { type: "AuthenticationError"; message: string }
	| { type: "AuthorizationError"; message: string }
	| { type: "ValidationError"; message: string }
	| { type: "NotFoundError"; message: string }
	| { type: "ConflictError"; message: string }
	| { type: "ApplicationError"; message: string }
	| { type: "UnknownError"; message: string };

export function success<T>(data: T): Result<T> {
	return { success: true, data };
}

export function failure(error: AppError): Result<never> {
	return { success: false, error };
}
