-- 모든 입금내역을 확인 상태로 업데이트
UPDATE deposits SET is_checked = TRUE;

-- 업데이트 결과 확인
SELECT 
    COUNT(*) as total_count,
    SUM(CASE WHEN is_checked = TRUE THEN 1 ELSE 0 END) as checked_count,
    SUM(CASE WHEN is_checked = FALSE THEN 1 ELSE 0 END) as unchecked_count
FROM deposits;

-- 최근 10개 입금내역의 확인 상태 확인
SELECT id, date, bank, amount, sender, company, is_checked 
FROM deposits 
ORDER BY id DESC 
LIMIT 10; 