import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { expenseSchema } from "./schemas";

export const createExpense = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator(expenseSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			console.log(data);
			return "Successfully created expense";
		},
	);
