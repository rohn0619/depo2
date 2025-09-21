const mysql = require('mysql2/promise');
const dbConfig = require('../config/database');
const logger = require('../utils/logger');

/**
 * 매칭 회원 체크 함수
 * @param {string} category 분류
 * @param {string} accountHolder 예금주명
 * @returns {Promise<boolean>} 매칭 회원 여부
 */
async function checkMatchingMember(category, accountHolder) {
    if (!category || !accountHolder) {
        return false;
    }

    const conn = await mysql.createConnection(dbConfig);
    
    try {
        // 분류와 예금주명으로 매칭 회원 검색 (정확한 매칭 + 부분 매칭)
        const [rows] = await conn.query(
            'SELECT id FROM matching_members WHERE category = ? AND (account_holder = ? OR account_holder LIKE ? OR ? LIKE account_holder)',
            [category, accountHolder, `%${accountHolder}%`, `%${accountHolder}%`]
        );
        
        await conn.end();
        
        const isMatchingMember = rows.length > 0;
        
        logger.business('매칭 회원 체크', { 
            category, 
            accountHolder, 
            isMatchingMember 
        });
        
        return isMatchingMember;
    } catch (error) {
        await conn.end();
        logger.error('매칭 회원 체크 오류', { category, accountHolder, error });
        return false;
    }
}

module.exports = {
    checkMatchingMember
};
