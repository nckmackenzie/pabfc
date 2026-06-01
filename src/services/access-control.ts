import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { accessControlAgents } from "@/drizzle/schema";

export async function authenticateAccessAgent(authHeader: string | null) {
	if (!authHeader?.startsWith("Bearer ")) {
		return null;
	}

	const token = authHeader.replace("Bearer ", "").trim();

	const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

	const agent = await db.query.accessControlAgents.findFirst({
		where: eq(accessControlAgents.apiKeyHash, tokenHash),
	});

	if (!agent || !agent.isActive) {
		return null;
	}

	return agent;
}
