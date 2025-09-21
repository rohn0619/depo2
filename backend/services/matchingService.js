const mysql = require('mysql2/promise');
const dbConfig = require('../config/database');
const logger = require('../utils/logger');

// 매칭 회원 목록 조회
async function getMatchingMembers(filters = {}) {
    const conn = await mysql.createConnection(dbConfig);
    
    try {
        let query = `
            SELECT id, category, member_name, account_holder, bank_name, account_number, created_at
            FROM matching_members
        `;
        let params = [];
        let whereConditions = [];
        
        // 분류 필터
        if (filters.category) {
            whereConditions.push('category = ?');
            params.push(filters.category);
        }
        
        // 회원명 검색
        if (filters.search) {
            whereConditions.push('member_name LIKE ?');
            params.push(`%${filters.search}%`);
        }
        
        // 일반 사용자는 자신의 분류만 조회
        if (filters.role === 'user' && filters.userCompany) {
            whereConditions.push('category = ?');
            params.push(filters.userCompany);
        }
        
        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }
        
        query += ' ORDER BY created_at DESC';
        
        const [rows] = await conn.query(query, params);
        await conn.end();
        
        return rows;
    } catch (error) {
        await conn.end();
        logger.dbQuery(query, params, error);
        throw error;
    }
}

// 매칭 회원 등록
async function createMatchingMember(matchingData) {
    const conn = await mysql.createConnection(dbConfig);
    
    try {
        const { category, member_name, account_holder, bank_name, account_number } = matchingData;
        
        // 중복 검사 (같은 분류에서 같은 회원명)
        const [existing] = await conn.query(
            'SELECT id FROM matching_members WHERE category = ? AND member_name = ?',
            [category, member_name]
        );
        
        if (existing.length > 0) {
            await conn.end();
            throw new Error('해당 분류에 이미 존재하는 회원명입니다.');
        }
        
        const [result] = await conn.query(
            'INSERT INTO matching_members (category, member_name, account_holder, bank_name, account_number) VALUES (?, ?, ?, ?, ?)',
            [category, member_name, account_holder, bank_name, account_number]
        );
        
        await conn.end();
        
        logger.business('매칭 회원 등록', { 
            category, 
            member_name, 
            account_holder, 
            bank_name 
        });
        
        return result.insertId;
    } catch (error) {
        await conn.end();
        logger.business('매칭 회원 등록', matchingData, error);
        throw error;
    }
}

// 매칭 회원 정보 수정
async function updateMatchingMember(matchingId, matchingData) {
    const conn = await mysql.createConnection(dbConfig);
    
    try {
        const { category, member_name, account_holder, bank_name, account_number } = matchingData;
        
        // 매칭 회원 존재 여부 확인
        const [existing] = await conn.query('SELECT id FROM matching_members WHERE id = ?', [matchingId]);
        if (existing.length === 0) {
            await conn.end();
            throw new Error('매칭 회원을 찾을 수 없습니다.');
        }
        
        // 중복 검사 (같은 분류에서 같은 회원명, 자기 자신 제외)
        const [duplicate] = await conn.query(
            'SELECT id FROM matching_members WHERE category = ? AND member_name = ? AND id != ?',
            [category, member_name, matchingId]
        );
        
        if (duplicate.length > 0) {
            await conn.end();
            throw new Error('해당 분류에 이미 존재하는 회원명입니다.');
        }
        
        await conn.query(
            'UPDATE matching_members SET category = ?, member_name = ?, account_holder = ?, bank_name = ?, account_number = ? WHERE id = ?',
            [category, member_name, account_holder, bank_name, account_number, matchingId]
        );
        
        await conn.end();
        
        logger.business('매칭 회원 정보 수정', { 
            matchingId, 
            category, 
            member_name, 
            account_holder, 
            bank_name 
        });
        
        return true;
    } catch (error) {
        await conn.end();
        logger.business('매칭 회원 정보 수정', { matchingId, ...matchingData }, error);
        throw error;
    }
}

// 매칭 회원 삭제
async function deleteMatchingMember(matchingId) {
    const conn = await mysql.createConnection(dbConfig);
    
    try {
        // 매칭 회원 존재 여부 확인
        const [existing] = await conn.query('SELECT id FROM matching_members WHERE id = ?', [matchingId]);
        if (existing.length === 0) {
            await conn.end();
            throw new Error('매칭 회원을 찾을 수 없습니다.');
        }
        
        await conn.query('DELETE FROM matching_members WHERE id = ?', [matchingId]);
        await conn.end();
        
        logger.business('매칭 회원 삭제', { matchingId });
        
        return true;
    } catch (error) {
        await conn.end();
        logger.business('매칭 회원 삭제', { matchingId }, error);
        throw error;
    }
}

// 매칭 회원 상세 조회
async function getMatchingMemberById(matchingId) {
    const conn = await mysql.createConnection(dbConfig);
    
    try {
        const [rows] = await conn.query(
            'SELECT id, category, member_name, account_holder, bank_name, account_number, created_at FROM matching_members WHERE id = ?',
            [matchingId]
        );
        
        await conn.end();
        
        if (rows.length === 0) {
            throw new Error('매칭 회원을 찾을 수 없습니다.');
        }
        
        return rows[0];
    } catch (error) {
        await conn.end();
        logger.dbQuery('SELECT * FROM matching_members WHERE id = ?', [matchingId], error);
        throw error;
    }
}

// 분류별 매칭 회원 수 조회
async function getMatchingMemberCountByCategory(category) {
    const conn = await mysql.createConnection(dbConfig);
    
    try {
        const [rows] = await conn.query(
            'SELECT COUNT(*) as count FROM matching_members WHERE category = ?',
            [category]
        );
        
        await conn.end();
        
        return rows[0].count;
    } catch (error) {
        await conn.end();
        logger.dbQuery('SELECT COUNT(*) FROM matching_members WHERE category = ?', [category], error);
        throw error;
    }
}

module.exports = {
    getMatchingMembers,
    createMatchingMember,
    updateMatchingMember,
    deleteMatchingMember,
    getMatchingMemberById,
    getMatchingMemberCountByCategory
};
