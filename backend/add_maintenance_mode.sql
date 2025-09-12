-- 점검 모드 설정 테이블 생성
CREATE TABLE IF NOT EXISTS system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(50) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 기본 점검 모드 설정 추가 (비활성화 상태)
INSERT INTO system_settings (setting_key, setting_value, description) 
VALUES ('maintenance_mode', 'false', '시스템 점검 모드 (true: 점검 중, false: 정상 운영)')
ON DUPLICATE KEY UPDATE 
    setting_value = VALUES(setting_value),
    description = VALUES(description); 