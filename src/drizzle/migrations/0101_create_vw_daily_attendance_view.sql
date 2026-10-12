CREATE VIEW vw_daily_attendance AS
SELECT
	al.member_id,
	(al.check_in_time AT TIME ZONE 'Africa/Nairobi')::date AS attendance_date,
	min(al.check_in_time) AS first_check_in_time,
	max(al.check_in_time) AS last_check_in_time,
	count(*)::int AS punch_count,
	(array_agg(al.id ORDER BY al.check_in_time ASC, al.id ASC))[1] AS first_attendance_log_id
FROM attendance_logs al
GROUP BY al.member_id, (al.check_in_time AT TIME ZONE 'Africa/Nairobi')::date;
