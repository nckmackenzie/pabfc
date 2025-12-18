import { createFileRoute } from "@tanstack/react-router";
import { uploadToS3 } from "@/lib/s3";

export const Route = createFileRoute("/api/uploads/expense-attachment")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const formData = await request.formData();
					const file = formData.get("file") as File;

					if (!file) {
						return new Response(JSON.stringify({ error: "No file provided" }), {
							status: 400,
							headers: { "Content-Type": "application/json" },
						});
					}

					const maxSize = 10 * 1024 * 1024;
					if (file.size > maxSize) {
						return new Response(
							JSON.stringify({ error: "File size exceeds 10MB limit" }),
							{
								status: 400,
								headers: { "Content-Type": "application/json" },
							},
						);
					}

					const allowedTypes = [
						"image/jpeg",
						"image/png",
						"image/gif",
						"image/webp",
						"application/pdf",
					];

					if (!allowedTypes.includes(file.type)) {
						return new Response(
							JSON.stringify({ error: "File type not allowed" }),
							{
								status: 400,
								headers: { "Content-Type": "application/json" },
							},
						);
					}

					const url = await uploadToS3(file, "expenses");

					return new Response(
						JSON.stringify({
							url,
							filename: file.name,
							size: file.size,
							mimeType: file.type,
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						},
					);
				} catch (error) {
					console.error("Upload error:", error);
					return new Response(JSON.stringify({ error: "Upload failed" }), {
						status: 500,
						headers: { "Content-Type": "application/json" },
					});
				}
			},
		},
	},
});
