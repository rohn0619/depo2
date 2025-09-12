const express = require('express');
const router = express.Router();
const { stringToDictionary } = require('../utils/stringParser');
const mysql = require('mysql2/promise');
const dbConfig = require('../config/database');

// 문자 파싱 API
router.post('/', async (req, res) => {
    try {
        const inputString = req.body.input_string || req.body.text || '';
        
        if (!inputString.trim()) {
            return res.status(400).json({ 
                error: '입력 문자열이 필요합니다.',
                message: 'input_string 또는 text 필드를 포함해주세요.'
            });
        }
        
        // 승인된 company 목록 가져오기
        const conn = await mysql.createConnection(dbConfig);
        const [approvedCompanies] = await conn.query(
            'SELECT name FROM companies WHERE is_approved = 1'
        );
        await conn.end();
        
        const result = stringToDictionary(inputString, approvedCompanies);
        res.json(result);
    } catch (error) {
        console.error('파싱 오류:', error);
        res.status(500).json({ 
            error: '서버 오류가 발생했습니다.',
            message: error.message 
        });
    }
});

module.exports = router; 