-- Query to get all trigger definitions
SELECT
    'CREATE TRIGGER ' || tgname ||
    CASE
        WHEN tgtype & 2 = 2 THEN ' BEFORE'
        WHEN tgtype & 4 = 4 THEN ' AFTER'
        ELSE ' INSTEAD OF'
    END ||
    CASE
        WHEN tgtype & 4 = 4 THEN ' INSERT'
        WHEN tgtype & 8 = 8 THEN ' DELETE'
        WHEN tgtype & 16 = 16 THEN ' UPDATE'
        ELSE ''
    END ||
    ' ON ' || schemaname || '.' || tablename ||
    ' FOR EACH ROW' ||
    CASE
        WHEN tgqual IS NOT NULL THEN ' WHEN (' || tgqual || ')'
        ELSE ''
    END ||
    ' EXECUTE FUNCTION ' || proname || '();' as trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE n.nspname = 'public'
  AND NOT tgisinternal
ORDER BY schemaname, tablename, tgname;
