import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
// import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { loadEnv } from "vite";

const env = loadEnv("development", process.cwd(), "");
const pdfServerExternals = [/^@react-pdf\//, /^pdfkit(?:\/|$)/];

const config = defineConfig({
	server: {
		allowedHosts:
			env.NODE_ENV !== "production"
				? ["localhost", "127.0.0.1", "0.0.0.0", "localhost:3000", env.NGROK_DOMAIN!]
				: true,
	},
	resolve: {
		tsconfigPaths: true,
	},
	ssr: {
		external: ["@react-pdf/renderer", "pdfkit"],
	},
	plugins: [
		devtools(),
		nitro({
			rollupConfig: { external: pdfServerExternals },
			traceDeps: ["@react-pdf/renderer*", "pdfkit*"],
		}),
		// this is the plugin that enables path aliases
		// viteTsConfigPaths({
		//   projects: ['./tsconfig.json'],
		// }),
		tailwindcss(),
		tanstackStart(),
		viteReact({
			babel: {
				plugins: ["babel-plugin-react-compiler"],
			},
		}),
	],
});

export default config;
