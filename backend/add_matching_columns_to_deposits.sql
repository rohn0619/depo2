-- deposits 테이블에 매칭 회원 관련 컬럼 추가
ALTER TABLE deposits 
ADD COLUMN is_matching_member BOOLEAN DEFAULT FALSE COMMENT '매칭 회원 여부',
ADD COLUMN requires_new_alert BOOLEAN DEFAULT FALSE COMMENT '새로운 알림음 필요 여부';

-- 인덱스 추가
ALTER TABLE deposits 
ADD INDEX idx_is_matching_member (is_matching_member),
ADD INDEX idx_requires_new_alert (requires_new_alert);
