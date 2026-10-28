import {
	useState,
	type ComponentProps,
	type MouseEvent,
	type ReactElement,
	type ReactNode,
} from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<"a">, "children" | "href"> & {
	loadDocument: () => Promise<ReactElement>;
	fileName: string;
	children: ({ loading }: { loading: boolean }) => ReactNode;
};

export function ClientPdfDownloadLink({
	loadDocument,
	fileName,
	children,
	className,
	onClick,
	...anchorProps
}: Props) {
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
		<a
			{...anchorProps}
			href="#"
			onClick={(event) => {
				onClick?.(event);
				if (!event.defaultPrevented) void download(event);
			}}
			aria-disabled={loading}
			className={cn("flex items-center gap-1", className)}
		>
			{children({ loading })}
		</a>
	);
}
