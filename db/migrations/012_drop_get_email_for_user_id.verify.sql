select proname from pg_proc
where proname = 'get_email_for_user_id' and pronamespace = 'public'::regnamespace;
-- BEKLENEN: 0 satir.

select grantee from information_schema.routine_privileges
where routine_name = 'get_email_for_user_id' and routine_schema = 'public';
-- BEKLENEN: 0 satir.
