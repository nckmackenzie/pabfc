ALTER TYPE "public"."access_control_status" ADD VALUE 'resigned';--> statement-breakpoint
ALTER TYPE "public"."access_control_status" ADD VALUE 'pending_delete';--> statement-breakpoint
ALTER TYPE "public"."access_control_status" ADD VALUE 'deleted';--> statement-breakpoint
ALTER TYPE "public"."access_sync_action" ADD VALUE 'DELETE_EMPLOYEE';--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "deleted_at" timestamp;