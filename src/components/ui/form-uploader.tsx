/** biome-ignore-all lint/suspicious/noArrayIndexKey: <> */
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import toast from "react-hot-toast";
import Dropzone, { type DropzoneState } from "shadcn-dropzone";

export interface Attachment {
	url: string;
	filename: string;
	mimeType: string;
}

interface FormUploaderProps {
	value?: Attachment[];
	onChange?: (value: Attachment[]) => void;
}

export function FormUploader({ value = [], onChange }: FormUploaderProps) {
	const [uploadingFiles, setUploadingFiles] = useState<
		{ file: File; startTimestamp: number }[]
	>([]);

	const uploadMutation = useMutation({
		mutationFn: async (file: File) => {
			const formData = new FormData();
			formData.append("file", file);

			const response = await fetch("/api/uploads/expense-attachment", {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Upload failed");
			}

			return response.json() as Promise<Attachment>;
		},
	});

	const handleDropBetter = async (acceptedFiles: File[]) => {
		const newUploads = acceptedFiles.map((file) => ({
			file,
			startTimestamp: Date.now(),
		}));
		setUploadingFiles((prev) => [...prev, ...newUploads]);

		const results: Attachment[] = [];

		// Run uploads
		await Promise.all(
			acceptedFiles.map(async (file) => {
				try {
					const result = await uploadMutation.mutateAsync(file);
					results.push(result);
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : "Upload failed";
					toast.error(`${file.name}: ${errorMessage}`);
				} finally {
					setUploadingFiles((prev) =>
						prev.filter((item) => item.file !== file),
					);
				}
			}),
		);

		if (results.length > 0) {
			onChange?.([...value, ...results]);
		}
	};

	return (
		<div className="">
			<h2 className="text-sm font-semibold mb-2">Attachments</h2>
			<Dropzone
				onDrop={handleDropBetter}
				maxSize={10 * 1024 * 1024}
				containerClassName="p-4 border border-dashed rounded-md hover:border-primary transition-colors hover:bg-transparent!"
				dropZoneClassName="hover:bg-transparent!"
				accept={{
					"image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
					"application/pdf": [".pdf"],
				}}
			>
				{(dropzone: DropzoneState) => (
					<div>
						{dropzone.isDragAccept ? (
							<div className="text-sm font-medium">Drop your files here!</div>
						) : (
							<div className="flex items-center flex-col gap-1.5">
								<div className="flex items-center flex-row gap-0.5 text-sm font-medium">
									Upload files
								</div>
							</div>
						)}
						<div className="text-xs text-gray-400 font-medium">
							{(value.length || 0) + uploadingFiles.length === 0
								? "No files uploaded"
								: (value.length || 0) + uploadingFiles.length === 1
									? "1 file uploaded"
									: `${(value.length || 0) + uploadingFiles.length} files uploaded`}
						</div>
					</div>
				)}
			</Dropzone>
		</div>
	);
}
