-- 1단계: 컬럼 추가 (기본값으로 안전하게)
ALTER TABLE deposits 
ADD COLUMN is_matching_member BOOLEAN DEFAULT FALSE COMMENT '매칭 회원 여부',
ADD COLUMN requires_new_alert BOOLEAN DEFAULT FALSE COMMENT '새로운 알림음 필요 여부';

-- 2단계: 기존 데이터 확인 (모든 기존 데이터가 FALSE로 설정되었는지 확인)
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN is_matching_member = TRUE THEN 1 END) as matching_member_true,
    COUNT(CASE WHEN is_matching_member = FALSE THEN 1 END) as matching_member_false,
    COUNT(CASE WHEN requires_new_alert = TRUE THEN 1 END) as new_alert_true,
    COUNT(CASE WHEN requires_new_alert = FALSE THEN 1 END) as new_alert_false
FROM deposits;

-- 3단계: 인덱스 추가 (성능 최적화)
ALTER TABLE deposits 
ADD INDEX idx_is_matching_member (is_matching_member),
ADD INDEX idx_requires_new_alert (requires_new_alert);

-- 4단계: 최종 확인
SHOW CREATE TABLE deposits;
