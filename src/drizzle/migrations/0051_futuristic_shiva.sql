CREATE TABLE "member_registration_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" varchar NOT NULL,
	"short_code" varchar(10) NOT NULL,
	"expires_at" timestamp,
	"used_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_registration_links_short_code_unique" UNIQUE("short_code")
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "completed_registration" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "member_registration_links" ADD CONSTRAINT "member_registration_links_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint