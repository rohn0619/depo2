-- 입금내역 테이블에 확인 상태 컬럼 추가
ALTER TABLE deposits ADD COLUMN is_checked BOOLEAN DEFAULT FALSE;

-- 기존 데이터는 모두 미확인 상태로 설정
UPDATE deposits SET is_checked = FALSE WHERE is_checked IS NULL;

-- 테이블 구조 확인
DESCRIBE deposits;

-- 샘플 데이터 확인 (확인 상태 포함)
SELECT id, date, bank, amount, sender, company, is_checked FROM deposits ORDER BY id DESC LIMIT 5; 