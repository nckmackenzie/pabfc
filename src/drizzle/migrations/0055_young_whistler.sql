CREATE TABLE "access_control_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"machine_name" varchar(100),
	"api_key_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_ip_address" varchar(100),
	"status" varchar(30) DEFAULT 'offline' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_access_control_agents_name" ON "access_control_agents" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_access_control_agents_status" ON "access_control_agents" USING btree ("status");