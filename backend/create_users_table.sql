-- 사용자 테이블 생성
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role ENUM('super', 'admin', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 기본 super 관리자 계정 생성 (비밀번호: admin123)
-- 주의: 실제 운영 환경에서는 더 강력한 비밀번호를 사용하세요
INSERT INTO users (username, password, name, role) 
VALUES ('admin', '$2b$10$OJq0eTmrwkYFGGwBaSFGpO.RE34fx4k7k.WWXZ0hNvahqobDPnxBe', '슈퍼 관리자', 'super')
ON DUPLICATE KEY UPDATE username=username;

-- 일반 관리자 계정 생성 (비밀번호: manager123)
INSERT INTO users (username, password, name, role) 
VALUES ('manager', '$2b$10$l1jqrRbdd.uTPjcPabPKwO3w0UBeczQqOcTJBUbHo0nZt0HAyOoP2', '일반 관리자', 'admin')
ON DUPLICATE KEY UPDATE username=username;

-- 추가 사용자 계정 예시 (비밀번호: user123)
-- INSERT INTO users (username, password, name, role) 
-- VALUES ('user1', '$2b$10$l1jqrRbdd.uTPjcPabPKwO3w0UBeczQqOcTJBUbHo0nZt0HAyOoP2', '일반사용자1', 'user')
-- ON DUPLICATE KEY UPDATE username=username;

-- 테이블 구조 확인
DESCRIBE users;

-- 사용자 목록 확인
SELECT id, username, name, role, created_at FROM users; 