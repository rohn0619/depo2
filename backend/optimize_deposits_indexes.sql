-- deposits 테이블 성능 최적화를 위한 인덱스 생성
-- 실행 전 기존 인덱스 확인: SHOW INDEX FROM deposits;

-- 1. 기본 정렬용 인덱스 (가장 중요)
CREATE INDEX idx_deposits_id_desc ON deposits(id DESC);

-- 2. 회사별 조회용 인덱스
CREATE INDEX idx_deposits_company ON deposits(company);

-- 3. 날짜별 정렬용 인덱스
CREATE INDEX idx_deposits_date_desc ON deposits(date DESC);

-- 4. 확인 상태별 조회용 인덱스
CREATE INDEX idx_deposits_is_checked ON deposits(is_checked);

-- 5. 복합 인덱스: 회사 + 확인 상태 (미확인 개수 조회용)
CREATE INDEX idx_deposits_company_checked ON deposits(company, is_checked);

-- 6. 복합 인덱스: 회사 + 날짜 (회사별 최신순 조회용)
CREATE INDEX idx_deposits_company_date ON deposits(company, date DESC);

-- 7. 복합 인덱스: 회사 + ID (폴링용)
CREATE INDEX idx_deposits_company_id ON deposits(company, id DESC);

-- 8. 생성일시 인덱스 (백업/아카이빙용)
CREATE INDEX idx_deposits_created_at ON deposits(created_at DESC);

-- 인덱스 생성 후 테이블 분석
ANALYZE TABLE deposits;

-- 인덱스 확인
SHOW INDEX FROM deposits; 