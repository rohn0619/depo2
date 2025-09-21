-- 매칭 회원 테이블 생성
CREATE TABLE IF NOT EXISTS matching_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(100) NOT NULL COMMENT '분류',
    member_name VARCHAR(100) NOT NULL COMMENT '회원명',
    account_holder VARCHAR(100) NOT NULL COMMENT '예금주명',
    bank_name VARCHAR(100) NOT NULL COMMENT '은행명',
    account_number VARCHAR(50) NOT NULL COMMENT '계좌번호',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '등록일',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
    
    -- 인덱스 생성
    INDEX idx_category (category),
    INDEX idx_member_name (member_name),
    INDEX idx_created_at (created_at),
    
    -- 유니크 제약조건 (같은 분류에서 같은 회원명은 중복 불가)
    UNIQUE KEY unique_category_member (category, member_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='매칭 회원 관리 테이블';

-- 샘플 데이터 삽입 (선택사항)
INSERT INTO matching_members (category, member_name, account_holder, bank_name, account_number) VALUES
('테스트분류1', '김철수', '김철수', '국민은행', '123456-78-901234'),
('테스트분류1', '이영희', '이영희', '신한은행', '987654-32-109876'),
('테스트분류2', '박민수', '박민수', '우리은행', '456789-12-345678'),
('테스트분류2', '최지영', '최지영', '하나은행', '789012-34-567890');
