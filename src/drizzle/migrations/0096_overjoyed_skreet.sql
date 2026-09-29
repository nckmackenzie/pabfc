CREATE TYPE "public"."wht_correction_status" AS ENUM('already_remitted', 'pending');--> statement-breakpoint
CREATE TABLE "wht_correction_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"line_number" integer NOT NULL,
	"correction_id" varchar NOT NULL,
	"bill_id" varchar NOT NULL,
	"wht_category" "wht_category" NOT NULL,
	"wht_rate" numeric(5, 2) NOT NULL,
	"amount" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wht_corrections" (
	"id" varchar PRIMARY KEY NOT NULL,
	"correction_no" integer NOT NULL,
	"correction_date" date NOT NULL,
	"treatment_account_id" integer NOT NULL,
	"remittance_status" "wht_correction_status" NOT NULL,
	"remittance_date" date,
	"bank_id" varchar,
	"crediting_account_id" integer,
	"memo" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wht_correction_lines" ADD CONSTRAINT "wht_correction_lines_correction_id_wht_corrections_id_fk" FOREIGN KEY ("correction_id") REFERENCES "public"."wht_corrections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wht_correction_lines" ADD CONSTRAINT "wht_correction_lines_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wht_corrections" ADD CONSTRAINT "wht_corrections_treatment_account_id_ledger_accounts_id_fk" FOREIGN KEY ("treatment_account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wht_corrections" ADD CONSTRAINT "wht_corrections_bank_id_bank_accounts_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wht_corrections" ADD CONSTRAINT "wht_corrections_crediting_account_id_ledger_accounts_id_fk" FOREIGN KEY ("crediting_account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wht_corrections" ADD CONSTRAINT "wht_corrections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_wht_correction_lines_correction_id" ON "wht_correction_lines" USING btree ("correction_id");--> statement-breakpoint
CREATE INDEX "idx_wht_correction_lines_bill_id" ON "wht_correction_lines" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "idx_wht_corrections_correction_no" ON "wht_corrections" USING btree ("correction_no");--> statement-breakpoint
CREATE INDEX "idx_wht_corrections_correction_date" ON "wht_corrections" USING btree ("correction_date");
--> statement-breakpoint

-- Withholding tax corrections retroactively adjust two things this view
-- already computes: the vendor's net payable (regardless of whether the
-- catch-up has been remitted to KRA yet — the vendor was never entitled to
-- it either way) and, for corrections still owed to KRA, the WHT balance
-- available to remit. See docs/superpowers/specs/2026-09-29-wht-corrections-design.md.
DROP VIEW IF EXISTS vw_invoices CASCADE;
--> statement-breakpoint

CREATE VIEW vw_invoices AS
SELECT
	b.id,
	b.invoice_date,
	b.due_date,
	b.vendor_id,
	b.invoice_no,
	v.name,
	b.total,
	b.wht_amount,
	b.total - COALESCE(b.wht_amount, 0::numeric) - COALESCE(wc.amount, 0::numeric) AS net_payable,
	COALESCE(sum(bpl.amount), 0::numeric) AS total_payment,
	(b.total - COALESCE(b.wht_amount, 0::numeric) - COALESCE(wc.amount, 0::numeric)) - COALESCE(sum(bpl.amount), 0::numeric) AS balance,
	b.status,
	(
		b.due_date IS NOT NULL
		AND b.due_date < CURRENT_DATE
		AND (b.total - COALESCE(b.wht_amount, 0::numeric) - COALESCE(wc.amount, 0::numeric)) - COALESCE(sum(bpl.amount), 0::numeric) > 0::numeric
		AND b.status <> ALL (ARRAY['draft'::bill_status, 'cancelled'::bill_status])
	) AS is_overdue,
	(b.status <> ALL (ARRAY['draft'::bill_status, 'cancelled'::bill_status])) AS is_payable,
	CASE
		WHEN b.status = ANY (ARRAY['draft'::bill_status, 'cancelled'::bill_status]) THEN b.status
		WHEN (b.total - COALESCE(b.wht_amount, 0::numeric) - COALESCE(wc.amount, 0::numeric)) - COALESCE(sum(bpl.amount), 0::numeric) <= 0::numeric THEN 'paid'::bill_status
		WHEN b.due_date IS NOT NULL AND b.due_date < CURRENT_DATE THEN 'overdue'::bill_status
		WHEN COALESCE(sum(bpl.amount), 0::numeric) > 0::numeric THEN 'partially-paid'::bill_status
		ELSE b.status
	END AS display_status
FROM bills b
	JOIN vendors v ON b.vendor_id::text = v.id::text
	LEFT JOIN bill_payment_lines bpl ON bpl.bill_id::text = b.id::text AND bpl.dc = 'credit'::line_dc
	LEFT JOIN (
		SELECT bill_id, sum(amount) AS amount FROM wht_correction_lines GROUP BY bill_id
	) wc ON wc.bill_id::text = b.id::text
GROUP BY b.id, b.invoice_date, b.due_date, b.invoice_no, v.name, b.total, b.wht_amount, wc.amount
ORDER BY b.invoice_date DESC, b.invoice_no DESC;
--> statement-breakpoint

DROP VIEW IF EXISTS vw_wht_balances CASCADE;
--> statement-breakpoint

-- pending_correction_amount adds unremitted correction amounts into the
-- balance available to remit, and widens which bills appear: a bill with
-- zero original wht_amount but a pending correction (WHT missed entirely)
-- must still surface here, or it could never be remitted.
CREATE VIEW vw_wht_balances AS
SELECT
	b.id,
	b.invoice_date,
	b.invoice_no,
	b.vendor_id,
	v.name,
	v.tax_pin,
	b.total,
	b.wht_amount,
	COALESCE(pc.amount, 0::numeric) AS pending_correction_amount,
	COALESCE(sum(wrl.amount), 0::numeric) AS remitted_amount,
	(b.wht_amount + COALESCE(pc.amount, 0::numeric)) - COALESCE(sum(wrl.amount), 0::numeric) AS wht_balance,
	b.wht_certificate_no,
	b.wht_certificate_issued_date
FROM bills b
	JOIN vendors v ON b.vendor_id::text = v.id::text
	LEFT JOIN wht_remittance_lines wrl ON wrl.bill_id::text = b.id::text AND wrl.dc = 'credit'::line_dc
	LEFT JOIN (
		SELECT wcl.bill_id, sum(wcl.amount) AS amount
		FROM wht_correction_lines wcl
		JOIN wht_corrections wc ON wc.id = wcl.correction_id
		WHERE wc.remittance_status = 'pending'
		GROUP BY wcl.bill_id
	) pc ON pc.bill_id::text = b.id::text
WHERE (b.wht_amount > 0::numeric OR pc.amount > 0::numeric)
	AND b.status <> ALL (ARRAY['draft'::bill_status, 'cancelled'::bill_status])
GROUP BY b.id, b.invoice_date, b.invoice_no, b.vendor_id, v.name, v.tax_pin, b.total, b.wht_amount, pc.amount, b.wht_certificate_no, b.wht_certificate_issued_date
ORDER BY b.invoice_date DESC, b.invoice_no DESC;