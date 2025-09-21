-- 기존 deposits 테이블 데이터 확인
SELECT 
    COUNT(*) as total_deposits,
    COUNT(CASE WHEN transaction_type = 1 THEN 1 END) as total_deposits_count,
    COUNT(CASE WHEN transaction_type = 0 THEN 1 END) as total_withdrawals_count,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record
FROM deposits;

-- 컬럼 추가 전 테이블 구조 확인
DESCRIBE deposits;
