ALTER TABLE "addon_invoice_lines" DROP CONSTRAINT "addon_invoice_lines_addon_id_addons_id_fk";
--> statement-breakpoint
ALTER TABLE "addon_invoice_lines" ADD CONSTRAINT "addon_invoice_lines_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE set null ON UPDATE no action;