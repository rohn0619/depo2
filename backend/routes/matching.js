const express = require('express');
const mysql = require('mysql2/promise');
const dbConfig = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// 매칭 회원 목록 조회 API
router.get('/', async (req, res) => {
    try {
        const { category, search, userRole, userCompany } = req.query;
        
        // 권한 체크
        if (!userRole || !['super', 'admin', 'user'].includes(userRole)) {
            return res.status(403).json({ error: '접근 권한이 없습니다.' });
        }
        
        const conn = await mysql.createConnection(dbConfig);
        let query = 'SELECT id, category, member_name, account_holder, bank_name, account_number, created_at FROM matching_members';
        let params = [];
        let conditions = [];
        
        // 일반 사용자는 자신의 분류만 조회
        if (userRole === 'user' && userCompany) {
            conditions.push('category = ?');
            params.push(userCompany);
        } else if (category) {
            // 슈퍼관리자와 관리자는 선택한 분류만 조회
            conditions.push('category = ?');
            params.push(category);
        }
        
        // 회원명 검색
        if (search) {
            conditions.push('member_name LIKE ?');
            params.push(`%${search}%`);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY created_at DESC';
        
        const [matchings] = await conn.query(query, params);
        await conn.end();
        
        res.json(matchings);
    } catch (error) {
        logger.business('매칭 회원 목록 조회', { category, search, userRole }, error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 매칭 회원 등록 API
router.post('/', async (req, res) => {
    try {
        const { category, member_name, account_holder, bank_name, account_number, userRole } = req.body;
        
        // 권한 체크
        if (!userRole || !['super', 'admin', 'user'].includes(userRole)) {
            return res.status(403).json({ error: '접근 권한이 없습니다.' });
        }
        
        // 필수 필드 검증
        if (!category || !member_name || !account_holder || !bank_name || !account_number) {
            return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
        }
        
        const conn = await mysql.createConnection(dbConfig);
        
        // 중복 검사 (같은 분류에서 같은 회원명)
        const [existing] = await conn.query(
            'SELECT id FROM matching_members WHERE category = ? AND member_name = ?',
            [category, member_name]
        );
        
        if (existing.length > 0) {
            await conn.end();
            return res.status(400).json({ error: '해당 분류에 이미 존재하는 회원명입니다.' });
        }
        
        // 매칭 회원 등록
        const [result] = await conn.query(
            'INSERT INTO matching_members (category, member_name, account_holder, bank_name, account_number) VALUES (?, ?, ?, ?, ?)',
            [category, member_name, account_holder, bank_name, account_number]
        );
        
        await conn.end();
        
        logger.business('매칭 회원 등록', { 
            category, 
            member_name, 
            account_holder, 
            bank_name, 
            userRole 
        });
        
        res.json({ 
            success: true, 
            message: '매칭 회원이 성공적으로 등록되었습니다.',
            matching: {
                id: result.insertId,
                category,
                member_name,
                account_holder,
                bank_name,
                account_number
            }
        });
    } catch (error) {
        logger.business('매칭 회원 등록', { category, member_name, userRole }, error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 매칭 회원 정보 수정 API
router.put('/:id', async (req, res) => {
    try {
        const { category, member_name, account_holder, bank_name, account_number, userRole } = req.body;
        const matchingId = req.params.id;
        
        // 권한 체크
        if (!userRole || !['super', 'admin', 'user'].includes(userRole)) {
            return res.status(403).json({ error: '접근 권한이 없습니다.' });
        }
        
        // 필수 필드 검증
        if (!category || !member_name || !account_holder || !bank_name || !account_number) {
            return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
        }
        
        const conn = await mysql.createConnection(dbConfig);
        
        // 매칭 회원 존재 여부 확인
        const [existing] = await conn.query('SELECT id FROM matching_members WHERE id = ?', [matchingId]);
        if (existing.length === 0) {
            await conn.end();
            return res.status(404).json({ error: '매칭 회원을 찾을 수 없습니다.' });
        }
        
        // 중복 검사 (같은 분류에서 같은 회원명, 자기 자신 제외)
        const [duplicate] = await conn.query(
            'SELECT id FROM matching_members WHERE category = ? AND member_name = ? AND id != ?',
            [category, member_name, matchingId]
        );
        
        if (duplicate.length > 0) {
            await conn.end();
            return res.status(400).json({ error: '해당 분류에 이미 존재하는 회원명입니다.' });
        }
        
        // 매칭 회원 정보 수정
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
            bank_name, 
            userRole 
        });
        
        res.json({ 
            success: true, 
            message: '매칭 회원 정보가 성공적으로 수정되었습니다.' 
        });
    } catch (error) {
        logger.business('매칭 회원 정보 수정', { matchingId, category, member_name, userRole }, error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 매칭 회원 삭제 API
router.delete('/:id', async (req, res) => {
    try {
        const { userRole } = req.query;
        const matchingId = req.params.id;
        
        // 권한 체크
        if (!userRole || !['super', 'admin', 'user'].includes(userRole)) {
            return res.status(403).json({ error: '접근 권한이 없습니다.' });
        }
        
        const conn = await mysql.createConnection(dbConfig);
        
        // 매칭 회원 존재 여부 확인
        const [existing] = await conn.query('SELECT id FROM matching_members WHERE id = ?', [matchingId]);
        if (existing.length === 0) {
            await conn.end();
            return res.status(404).json({ error: '매칭 회원을 찾을 수 없습니다.' });
        }
        
        // 매칭 회원 삭제
        await conn.query('DELETE FROM matching_members WHERE id = ?', [matchingId]);
        await conn.end();
        
        logger.business('매칭 회원 삭제', { matchingId, userRole });
        
        res.json({ 
            success: true, 
            message: '매칭 회원이 삭제되었습니다.' 
        });
    } catch (error) {
        logger.business('매칭 회원 삭제', { matchingId, userRole }, error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router;
