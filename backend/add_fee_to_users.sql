-- users 테이블에 fee 컬럼 추가 (수수료율, 단위: %)
ALTER TABLE users ADD COLUMN fee DECIMAL(5,2) DEFAULT 0.00 AFTER company;

-- fee 컬럼에 주석 추가
ALTER TABLE users MODIFY COLUMN fee DECIMAL(5,2) DEFAULT 0.00 COMMENT '수수료율 (%)';

-- 테이블 구조 확인
DESCRIBE users; 