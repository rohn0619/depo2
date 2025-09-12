-- users 테이블에 company_name 컬럼이 없는 경우 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(100) AFTER company;

-- 기존 사용자들의 company_name을 company와 동일하게 설정 (임시)
UPDATE users SET company_name = company WHERE company_name IS NULL OR company_name = '';

-- company_name 컬럼에 주석 추가
ALTER TABLE users MODIFY COLUMN company_name VARCHAR(100) COMMENT '사용자명';

-- 테이블 구조 확인
DESCRIBE users;

-- 현재 users 테이블 데이터 확인
SELECT id, username, company, company_name, role FROM users; 