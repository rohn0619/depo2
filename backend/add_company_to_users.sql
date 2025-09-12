-- users 테이블에 company 컬럼 추가
ALTER TABLE users ADD COLUMN company VARCHAR(100) AFTER name;

-- 기존 사용자들의 company를 name과 동일하게 설정 (임시)
UPDATE users SET company = name WHERE company IS NULL;

-- company 컬럼을 NOT NULL로 변경
ALTER TABLE users MODIFY COLUMN company VARCHAR(100) NOT NULL;

-- 테이블 구조 확인
DESCRIBE users; 