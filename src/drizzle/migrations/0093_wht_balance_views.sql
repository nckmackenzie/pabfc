-- Withholding tax splits what a bill owes into two debts: the vendor is owed the
-- total less the tax withheld on their behalf, and KRA is owed the withheld
-- portion. `vw_invoices` previously computed every "amount owed" figure off
-- `b.total`, which overstates the vendor's balance by the withheld amount, so a
-- bill settled in full would never reach 'paid'. Recompute it net of WHT, and add
-- `vw_wht_balances` for the KRA side.
--
-- Views are owned by these migrations rather than by drizzle-kit (they are
-- declared `.existing()` in the schema). `CREATE OR REPLACE VIEW` cannot add
-- columns in the middle of the list nor change a column's type, so vw_invoices is
-- dropped and recreated. Nothing in the database depends on it, but CASCADE keeps
-- the drop from failing against a hand-made dependent in an older environment.
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
	-- Gross value of the bill, before withholding.
	b.total,
	b.wht_amount,
	-- What the vendor is actually owed, and the basis of every figure below.
	(b.total - COALESCE(b.wht_amount, 0::numeric)) AS net_payable,
	COALESCE(sum(bpl.amount), 0::numeric) AS total_payment,
	(b.total - COALESCE(b.wht_amount, 0::numeric)) - COALESCE(sum(bpl.amount), 0::numeric) AS balance,
	b.status,
	-- Past its due date and still owing. Draft and cancelled bills are not
	-- payable, so they are never overdue.
	(
		b.due_date IS NOT NULL
		AND b.due_date < CURRENT_DATE
		AND (b.total - COALESCE(b.wht_amount, 0::numeric)) - COALESCE(sum(bpl.amount), 0::numeric) > 0::numeric
		AND b.status <> ALL (ARRAY['draft'::bill_status, 'cancelled'::bill_status])
	) AS is_overdue,
	-- Payable at all: excludes the workflow states that can never carry a
	-- balance owing. Reports that bucket outstanding money (ageing) and reports
	-- that list late money (overdue) both filter on this, so they reconcile.
	(b.status <> ALL (ARRAY['draft'::bill_status, 'cancelled'::bill_status])) AS is_payable,
	-- The single label the UI shows. Payment state and lateness are derived from
	-- the payment lines on every read, so they cannot drift; b.status supplies
	-- only the workflow state it still owns. A bill whose only outstanding amount
	-- is the withheld tax reads as 'paid' here, because the vendor has been
	-- settled in full; what remains is owed to KRA and is tracked separately.
	CASE
		WHEN b.status = ANY (ARRAY['draft'::bill_status, 'cancelled'::bill_status]) THEN b.status
		WHEN (b.total - COALESCE(b.wht_amount, 0::numeric)) - COALESCE(sum(bpl.amount), 0::numeric) <= 0::numeric THEN 'paid'::bill_status
		WHEN b.due_date IS NOT NULL AND b.due_date < CURRENT_DATE THEN 'overdue'::bill_status
		WHEN COALESCE(sum(bpl.amount), 0::numeric) > 0::numeric THEN 'partially-paid'::bill_status
		ELSE b.status
	END AS display_status
FROM bills b
	JOIN vendors v ON b.vendor_id::text = v.id::text
	LEFT JOIN bill_payment_lines bpl ON bpl.bill_id::text = b.id::text AND bpl.dc = 'credit'::line_dc
GROUP BY b.id, b.invoice_date, b.due_date, b.invoice_no, v.name, b.total, b.wht_amount
ORDER BY b.invoice_date DESC, b.invoice_no DESC;
--> statement-breakpoint

-- The withholding-tax counterpart of vw_invoices: what was withheld per bill,
-- what has since been remitted to KRA, and what is still owed. The remittance
-- screen selects from here the way payments select unpaid bills from vw_invoices.
-- Only bills that actually withheld tax appear.
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
	COALESCE(sum(wrl.amount), 0::numeric) AS remitted_amount,
	b.wht_amount - COALESCE(sum(wrl.amount), 0::numeric) AS wht_balance,
	b.wht_certificate_no,
	b.wht_certificate_issued_date
FROM bills b
	JOIN vendors v ON b.vendor_id::text = v.id::text
	LEFT JOIN wht_remittance_lines wrl ON wrl.bill_id::text = b.id::text AND wrl.dc = 'credit'::line_dc
WHERE b.wht_amount > 0::numeric
	AND b.status <> ALL (ARRAY['draft'::bill_status, 'cancelled'::bill_status])
GROUP BY b.id, b.invoice_date, b.invoice_no, b.vendor_id, v.name, v.tax_pin, b.total, b.wht_amount, b.wht_certificate_no, b.wht_certificate_issued_date
ORDER BY b.invoice_date DESC, b.invoice_no DESC;
