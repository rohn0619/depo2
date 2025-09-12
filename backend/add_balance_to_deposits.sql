-- deposits 테이블에 balance 컬럼 추가
ALTER TABLE deposits ADD COLUMN balance INT DEFAULT NULL AFTER amount;

-- balance 컬럼에 주석 추가
ALTER TABLE deposits MODIFY COLUMN balance INT DEFAULT NULL COMMENT '잔액';

-- 테이블 구조 확인
DESCRIBE deposits; 