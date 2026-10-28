import { useState, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { toast } from "sonner";

type Props = {
	loadDocument: () => Promise<ReactElement>;
	fileName: string;
	children: ({ loading }: { loading: boolean }) => ReactNode;
};

export function ClientPdfDownloadLink({ loadDocument, fileName, children }: Props) {
	const [loading, setLoading] = useState(false);

	async function download(event: MouseEvent<HTMLAnchorElement>) {
		event.preventDefault();
		if (loading) return;

		setLoading(true);
		try {
			const [{ pdf }, pdfDocument] = await Promise.all([
				import("@react-pdf/renderer"),
				loadDocument(),
			]);
			const blob = await pdf(pdfDocument as Parameters<typeof pdf>[0]).toBlob();
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = fileName;
			link.click();
			setTimeout(() => URL.revokeObjectURL(url), 60_000);
		} catch (error) {
			console.error("Failed to generate PDF", error);
			toast.error("Failed to generate PDF");
		} finally {
			setLoading(false);
		}
	}

	return (
		<a href="#" onClick={download} aria-disabled={loading} className="flex items-center gap-1">
			{children({ loading })}
		</a>
	);
}
