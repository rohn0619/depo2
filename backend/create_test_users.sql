-- 테스트용 일반 사용자 계정 생성
-- 각 사용자는 특정 분류(company)에 해당하는 입금내역만 볼 수 있음

-- an-coinup-11 분류 사용자
INSERT INTO users (username, password, name, role) 
VALUES ('user_an_coinup_11', '$2b$10$l1jqrRbdd.uTPjcPabPKwO3w0UBeczQqOcTJBUbHo0nZt0HAyOoP2', 'an-coinup-11', 'user')
ON DUPLICATE KEY UPDATE username=username;

-- coinpos365 분류 사용자
INSERT INTO users (username, password, name, role) 
VALUES ('user_coinpos365', '$2b$10$l1jqrRbdd.uTPjcPabPKwO3w0UBeczQqOcTJBUbHo0nZt0HAyOoP2', 'coinpos365', 'user')
ON DUPLICATE KEY UPDATE username=username;

-- bizpay 분류 사용자
INSERT INTO users (username, password, name, role) 
VALUES ('user_bizpay', '$2b$10$l1jqrRbdd.uTPjcPabPKwO3w0UBeczQqOcTJBUbHo0nZt0HAyOoP2', 'bizpay', 'user')
ON DUPLICATE KEY UPDATE username=username;

-- paynow 분류 사용자
INSERT INTO users (username, password, name, role) 
VALUES ('user_paynow', '$2b$10$l1jqrRbdd.uTPjcPabPKwO3w0UBeczQqOcTJBUbHo0nZt0HAyOoP2', 'paynow', 'user')
ON DUPLICATE KEY UPDATE username=username;

-- fastbank 분류 사용자
INSERT INTO users (username, password, name, role) 
VALUES ('user_fastbank', '$2b$10$l1jqrRbdd.uTPjcPabPKwO3w0UBeczQqOcTJBUbHo0nZt0HAyOoP2', 'fastbank', 'user')
ON DUPLICATE KEY UPDATE username=username;

-- 테스트용 사용자 목록 확인
SELECT id, username, name, role, created_at FROM users WHERE role = 'user' ORDER BY created_at DESC; 