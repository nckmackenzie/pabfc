-- The reporting views were previously created by hand and existed only inside
-- the database, so a fresh provision from migrations produced an app that could
-- not read bills, payments or attendance. Capture all three here, and extend
-- vw_invoices with the payment state that bills.status used to store.
--
-- CREATE OR REPLACE VIEW only permits appending columns, so vw_invoices keeps
-- its existing column order and gains is_overdue/display_status at the end.

CREATE OR REPLACE VIEW vw_invoices AS
SELECT
	b.id,
	b.invoice_date,
	b.due_date,
	b.vendor_id,
	b.invoice_no,
	v.name,
	b.total,
	COALESCE(sum(bpl.amount), 0::numeric) AS total_payment,
	b.total - COALESCE(sum(bpl.amount), 0::numeric) AS balance,
	b.status,
	-- Past its due date and still owing. Draft and cancelled bills are not
	-- payable, so they are never overdue.
	(
		b.due_date IS NOT NULL
		AND b.due_date < CURRENT_DATE
		AND b.total - COALESCE(sum(bpl.amount), 0::numeric) > 0::numeric
		AND b.status <> ALL (ARRAY['draft'::bill_status, 'cancelled'::bill_status])
	) AS is_overdue,
	-- The single label the UI shows. Payment state and lateness are derived from
	-- the payment lines on every read, so they cannot drift; b.status supplies
	-- only the workflow state it still owns.
	CASE
		WHEN b.status = ANY (ARRAY['draft'::bill_status, 'cancelled'::bill_status]) THEN b.status
		WHEN b.total - COALESCE(sum(bpl.amount), 0::numeric) <= 0::numeric THEN 'paid'::bill_status
		WHEN b.due_date IS NOT NULL AND b.due_date < CURRENT_DATE THEN 'overdue'::bill_status
		WHEN COALESCE(sum(bpl.amount), 0::numeric) > 0::numeric THEN 'partially-paid'::bill_status
		ELSE b.status
	END AS display_status
FROM bills b
	JOIN vendors v ON b.vendor_id::text = v.id::text
	LEFT JOIN bill_payment_lines bpl ON bpl.bill_id::text = b.id::text AND bpl.dc = 'credit'::line_dc
GROUP BY b.id, b.invoice_date, b.due_date, b.invoice_no, v.name, b.total
ORDER BY b.invoice_date DESC, b.invoice_no DESC;
--> statement-breakpoint

CREATE OR REPLACE VIEW vw_member_overview AS
SELECT
	m.id,
	m.member_no,
	m.first_name,
	m.last_name,
	(m.first_name::text || ' '::text) || m.last_name::text AS full_name,
	m.image,
	m.contact,
	m.gender,
	m.member_status,
	am.plan_id AS active_plan_id,
	am.plan_name AS active_plan_name,
	am.end_date AS next_renewal_date,
	la.last_visit,
	m.notes,
	m.created_at,
	m.emergency_contact_name,
	m.emergency_contact_no,
	(
		SELECT users.banned
		FROM users
		WHERE users.member_id::text = m.id::text
	) AS banned,
	m.completed_registration
FROM members m
	LEFT JOIN LATERAL (
		SELECT mp.id AS plan_id, mp.name AS plan_name, mm.end_date
		FROM member_memberships mm
			JOIN membership_plans mp ON mp.id::text = mm.membership_plan_id::text
		WHERE mm.member_id::text = m.id::text
			AND mm.status = 'active'::membership_status
			AND mm.start_date <= CURRENT_DATE
			AND mm.end_date >= CURRENT_DATE
		ORDER BY mm.end_date DESC
		LIMIT 1
	) am ON true
	LEFT JOIN LATERAL (
		SELECT max(al.check_in_time) AS last_visit
		FROM attendance_logs al
		WHERE al.member_id::text = m.id::text
	) la ON true
WHERE m.deleted_at IS NULL;
--> statement-breakpoint

CREATE OR REPLACE VIEW vw_attendance_details AS
SELECT
	al.id,
	(m.first_name::text || ' '::text) || m.last_name::text AS member_name,
	m.image,
	al.check_in_time,
	al.check_out_time,
	al.check_out_time - al.check_in_time AS duration,
	am.plan_name AS active_plan_name,
	am.end_date AS next_renewal_date
FROM attendance_logs al
	JOIN members m ON al.member_id::text = m.id::text
	LEFT JOIN LATERAL (
		SELECT mp.name AS plan_name, mm.end_date
		FROM member_memberships mm
			JOIN membership_plans mp ON mp.id::text = mm.membership_plan_id::text
		WHERE mm.member_id::text = m.id::text
			AND mm.status = 'active'::membership_status
			AND mm.start_date <= CURRENT_DATE
			AND mm.end_date >= CURRENT_DATE
		ORDER BY mm.end_date DESC
		LIMIT 1
	) am ON true;
--> statement-breakpoint

-- bills.status is now workflow state only. Rows whose status was overwritten by
-- the payment/overdue jobs are returned to the workflow state they were created
-- with; their payment state is derived from the payment lines instead.
UPDATE bills
SET status = 'pending'
WHERE status = ANY (ARRAY['paid'::bill_status, 'partially-paid'::bill_status, 'overdue'::bill_status]);
