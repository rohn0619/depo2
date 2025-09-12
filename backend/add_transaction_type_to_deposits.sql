-- deposits 테이블에 transaction_type 컬럼 추가 (입금: 1, 출금: 0, NOT NULL)
ALTER TABLE deposits ADD COLUMN transaction_type TINYINT NOT NULL DEFAULT 1 AFTER company;

-- transaction_type 컬럼에 주석 추가
ALTER TABLE deposits MODIFY COLUMN transaction_type TINYINT NOT NULL DEFAULT 1 COMMENT '거래구분 (1: 입금, 0: 출금)';

-- 기존 데이터는 모두 입금으로 설정
UPDATE deposits SET transaction_type = 1 WHERE transaction_type IS NULL;

-- 테이블 구조 확인
DESCRIBE deposits; 