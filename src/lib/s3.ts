import {
	DeleteObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";

const s3Client = new S3Client({
	region: process.env.AWS_DEFAULT_REGION as string,
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
	},
});

export async function uploadToS3(
	file: File,
	folder: string = "expenses",
): Promise<string> {
	const timestamp = Date.now();
	const randomString = Math.random().toString(36).substring(7);
	const fileExtension = file.name.split(".").pop();
	const key = `${folder}/${timestamp}-${randomString}.${fileExtension}`;

	const arrayBuffer = await file.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);

	const command = new PutObjectCommand({
		Bucket: process.env.AWS_BUCKET as string,
		Key: key,
		Body: buffer,
		ContentType: file.type,
		ContentDisposition: `inline; filename="${file.name}"`,
	});

	await s3Client.send(command);

	return `${process.env.AWS_S3_PUBLIC_URL}/${key}`;
}

export async function deleteFromS3(url: string): Promise<void> {
	const key = url.replace(`${process.env.AWS_S3_PUBLIC_URL}/`, "");

	const command = new DeleteObjectCommand({
		Bucket: process.env.AWS_BUCKET as string,
		Key: key,
	});

	await s3Client.send(command);
}
