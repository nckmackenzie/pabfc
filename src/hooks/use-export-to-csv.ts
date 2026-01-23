import Papa, { type UnparseConfig } from "papaparse";
import { useCallback } from "react";

type ExportOptions = UnparseConfig;

export function useExportToCsv() {
	const exportToCsv = useCallback(
		<T>(data: T[], filename: string, options?: ExportOptions) => {
			if (!data.length) {
				console.warn("No data to export");
				return;
			}

			const csv = Papa.unparse(data, options);
			const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
			const link = document.createElement("a");

			if (link.download !== undefined) {
				const url = URL.createObjectURL(blob);
				link.setAttribute("href", url);
				link.setAttribute("download", filename);
				link.style.visibility = "hidden";
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
			}
		},
		[],
	);

	return { exportToCsv };
}
