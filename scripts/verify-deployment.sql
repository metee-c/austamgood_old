-- ============================================================================
-- Deployment Verification Script
-- Verifies Migrations 220, 221, 222 are deployed correctly
-- ============================================================================

\echo '========================================='
\echo 'DEPLOYMENT VERIFICATION'
\echo 'Migrations 220, 221, 222'
\echo '========================================='
\echo ''

-- ============================================================================
-- 1. Check Functions Exist
-- ============================================================================
\echo '1. Checking Functions Exist...'
\echo '-----------------------------------------'

SELECT 
    proname as function_name,
    pg_get_function_identity_arguments(oid) as arguments,
    CASE 
        WHEN proname LIKE '%face_sheet%reservation%' THEN '✅'
        ELSE '❌'
    END as status
FROM pg_proc
WHERE proname IN (
    'create_face_sheet_with_reservation',
    'create_bonus_face_sheet_with_reservation',
    'generate_face_sheet_no_with_lock',
    'generate_bonus_face_sheet_no_with_lock',
    'reserve_stock_for_face_sheet_items',
    'reserve_stock_for_bonus_face_sheet_items'
)
ORDER BY proname;

\echo ''

-- ============================================================================
-- 2. Check FOR UPDATE in Reserve Functions
-- ============================================================================
\echo '2. Checking FOR UPDATE Row Locking...'
\echo '-----------------------------------------'

SELECT 
    proname as function_name,
    CASE 
        WHEN prosrc LIKE '%FOR UPDATE%' THEN '✅ Has FOR UPDATE'
        ELSE '❌ Missing FOR UPDATE'
    END as row_locking_status
FROM pg_proc
WHERE proname IN (
    'reserve_stock_for_face_sheet_items',
    'reserve_stock_for_bonus_face_sheet_items'
);

\echo ''

-- ============================================================================
-- 3. Check Advisory Locks in Generate Functions
-- ============================================================================
\echo '3. Checking Advisory Locks...'
\echo '-----------------------------------------'

SELECT 
    proname as function_name,
    CASE 
        WHEN prosrc LIKE '%pg_try_advisory_xact_lock%' THEN '✅ Has Advisory Lock'
        ELSE '❌ Missing Advisory Lock'
    END as advisory_lock_status,
    CASE 
        WHEN prosrc LIKE '%pg_try_advisory_xact_lock(1001)%' THEN 'Lock Key: 1001'
        WHEN prosrc LIKE '%pg_try_advisory_xact_lock(1002)%' THEN 'Lock Key: 1002'
        ELSE 'No Lock Key'
    END as lock_key
FROM pg_proc
WHERE proname IN (
    'generate_face_sheet_no_with_lock',
    'generate_bonus_face_sheet_no_with_lock'
);

\echo ''

-- ============================================================================
-- 4. Check for Orphaned Face Sheets (Last 24 Hours)
-- ============================================================================
\echo '4. Checking for Orphaned Face Sheets...'
\echo '-----------------------------------------'

WITH orphaned_fs AS (
    SELECT 
        fs.id,
        fs.face_sheet_no,
        fs.created_at,
        COUNT(DISTINCT fsi.id) as total_items,
        COUNT(DISTINCT fsir.reservation_id) as reserved_items
    FROM face_sheets fs
    LEFT JOIN face_sheet_items fsi ON fsi.face_sheet_id = fs.id
    LEFT JOIN face_sheet_item_reservations fsir ON fsir.face_sheet_item_id = fsi.id
    WHERE fs.created_at > NOW() - INTERVAL '24 hours'
    GROUP BY fs.id, fs.face_sheet_no, fs.created_at
    HAVING COUNT(DISTINCT fsi.id) > 0 AND COUNT(DISTINCT fsir.reservation_id) = 0
)
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ No orphaned face sheets'
        ELSE '❌ Found ' || COUNT(*) || ' orphaned face sheets'
    END as status,
    COUNT(*) as orphaned_count
FROM orphaned_fs;

\echo ''

-- ============================================================================
-- 5. Check for Orphaned Bonus Face Sheets (Last 24 Hours)
-- ============================================================================
\echo '5. Checking for Orphaned Bonus Face Sheets...'
\echo '-----------------------------------------'

WITH orphaned_bfs AS (
    SELECT 
        bfs.id,
        bfs.face_sheet_no,
        bfs.created_at,
        COUNT(DISTINCT bfsi.id) as total_items,
        COUNT(DISTINCT bfsir.reservation_id) as reserved_items
    FROM bonus_face_sheets bfs
    LEFT JOIN bonus_face_sheet_items bfsi ON bfsi.face_sheet_id = bfs.id
    LEFT JOIN bonus_face_sheet_item_reservations bfsir ON bfsir.bonus_face_sheet_item_id = bfsi.id
    WHERE bfs.created_at > NOW() - INTERVAL '24 hours'
    GROUP BY bfs.id, bfs.face_sheet_no, bfs.created_at
    HAVING COUNT(DISTINCT bfsi.id) > 0 AND COUNT(DISTINCT bfsir.reservation_id) = 0
)
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ No orphaned bonus face sheets'
        ELSE '❌ Found ' || COUNT(*) || ' orphaned bonus face sheets'
    END as status,
    COUNT(*) as orphaned_count
FROM orphaned_bfs;

\echo ''

-- ============================================================================
-- 6. Check Face Sheet Creation Performance (Last 24 Hours)
-- ============================================================================
\echo '6. Face Sheet Creation Performance...'
\echo '-----------------------------------------'

SELECT 
    COUNT(*) as total_created,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_creation_time_seconds,
    MIN(EXTRACT(EPOCH FROM (updated_at - created_at))) as min_creation_time_seconds,
    MAX(EXTRACT(EPOCH FROM (updated_at - created_at))) as max_creation_time_seconds
FROM face_sheets
WHERE created_at > NOW() - INTERVAL '24 hours';

\echo ''

-- ============================================================================
-- 7. Check for Duplicate Face Sheet Numbers (Last 24 Hours)
-- ============================================================================
\echo '7. Checking for Duplicate Face Sheet Numbers...'
\echo '-----------------------------------------'

WITH duplicates AS (
    SELECT 
        face_sheet_no,
        COUNT(*) as count
    FROM face_sheets
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY face_sheet_no
    HAVING COUNT(*) > 1
)
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ No duplicate face sheet numbers'
        ELSE '❌ Found ' || COUNT(*) || ' duplicate face sheet numbers'
    END as status,
    COUNT(*) as duplicate_count
FROM duplicates;

\echo ''

-- ============================================================================
-- 8. Check Stock Reservation Integrity
-- ============================================================================
\echo '8. Checking Stock Reservation Integrity...'
\echo '-----------------------------------------'

-- Face Sheets
WITH fs_integrity AS (
    SELECT 
        fs.id,
        fs.face_sheet_no,
        COUNT(DISTINCT fsi.id) as items_count,
        COUNT(DISTINCT fsir.reservation_id) as reservations_count,
        CASE 
            WHEN COUNT(DISTINCT fsi.id) = COUNT(DISTINCT fsir.reservation_id) THEN true
            ELSE false
        END as is_complete
    FROM face_sheets fs
    LEFT JOIN face_sheet_items fsi ON fsi.face_sheet_id = fs.id
    LEFT JOIN face_sheet_item_reservations fsir ON fsir.face_sheet_item_id = fsi.id
    WHERE fs.created_at > NOW() - INTERVAL '24 hours'
    GROUP BY fs.id, fs.face_sheet_no
)
SELECT 
    'Face Sheets' as document_type,
    COUNT(*) as total_documents,
    SUM(CASE WHEN is_complete THEN 1 ELSE 0 END) as complete_reservations,
    SUM(CASE WHEN NOT is_complete THEN 1 ELSE 0 END) as incomplete_reservations,
    CASE 
        WHEN SUM(CASE WHEN NOT is_complete THEN 1 ELSE 0 END) = 0 THEN '✅ All complete'
        ELSE '❌ ' || SUM(CASE WHEN NOT is_complete THEN 1 ELSE 0 END) || ' incomplete'
    END as status
FROM fs_integrity;

-- Bonus Face Sheets
WITH bfs_integrity AS (
    SELECT 
        bfs.id,
        bfs.face_sheet_no,
        COUNT(DISTINCT bfsi.id) as items_count,
        COUNT(DISTINCT bfsir.reservation_id) as reservations_count,
        CASE 
            WHEN COUNT(DISTINCT bfsi.id) = COUNT(DISTINCT bfsir.reservation_id) THEN true
            ELSE false
        END as is_complete
    FROM bonus_face_sheets bfs
    LEFT JOIN bonus_face_sheet_items bfsi ON bfsi.face_sheet_id = bfs.id
    LEFT JOIN bonus_face_sheet_item_reservations bfsir ON bfsir.bonus_face_sheet_item_id = bfsi.id
    WHERE bfs.created_at > NOW() - INTERVAL '24 hours'
    GROUP BY bfs.id, bfs.face_sheet_no
)
SELECT 
    'Bonus Face Sheets' as document_type,
    COUNT(*) as total_documents,
    SUM(CASE WHEN is_complete THEN 1 ELSE 0 END) as complete_reservations,
    SUM(CASE WHEN NOT is_complete THEN 1 ELSE 0 END) as incomplete_reservations,
    CASE 
        WHEN SUM(CASE WHEN NOT is_complete THEN 1 ELSE 0 END) = 0 THEN '✅ All complete'
        ELSE '❌ ' || SUM(CASE WHEN NOT is_complete THEN 1 ELSE 0 END) || ' incomplete'
    END as status
FROM bfs_integrity;

\echo ''

-- ============================================================================
-- SUMMARY
-- ============================================================================
\echo '========================================='
\echo 'VERIFICATION COMPLETE'
\echo '========================================='
\echo ''
\echo 'Expected Results:'
\echo '  ✅ All 6 functions exist'
\echo '  ✅ Reserve functions have FOR UPDATE'
\echo '  ✅ Generate functions have advisory locks'
\echo '  ✅ No orphaned documents'
\echo '  ✅ No duplicate face sheet numbers'
\echo '  ✅ All reservations complete'
\echo ''
\echo 'If any ❌ appears above, please investigate!'
\echo '========================================='
