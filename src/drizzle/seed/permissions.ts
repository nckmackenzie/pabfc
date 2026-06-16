import { db } from "@/drizzle/db";
import { permissions } from "@/drizzle/schema";
import { PERMISSIONS } from "@/lib/permissions/constants";

function toSentenceCase(value: string) {
	return value
		.split(/[-:]/g)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function buildPermissionDescription(resource: string, action: string) {
	return `Allow users to ${toSentenceCase(action).toLowerCase()} ${toSentenceCase(resource).toLowerCase()}.`;
}

export async function seedPermissions() {
	try {
		console.log("🌱 Seeding permissions...");
		await db
			.insert(permissions)
			.values(
				PERMISSIONS.map((key) => {
					const [resource, action] = key.split(":");

					return {
						resource,
						action,
						key,
						description: buildPermissionDescription(resource, action),
					};
				})
			)
			.onConflictDoNothing({
				target: permissions.key,
			});
		console.log("✅ Permissions seeded successfully!");
	} catch (error) {
		console.error("❌ Error seeding permissions:", error);
		throw error;
	}
}
