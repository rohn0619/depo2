const express = require('express');
const mysql = require('mysql2/promise');
const multer = require('multer');
const XLSX = require('xlsx');
const dbConfig = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// multer 설정 (메모리 저장소 사용)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB 제한
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel' ||
            file.originalname.endsWith('.xlsx') ||
            file.originalname.endsWith('.xls')) {
            cb(null, true);
        } else {
            cb(new Error('엑셀 파일만 업로드 가능합니다.'), false);
        }
    }
});

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

// 엑셀 파일을 통한 대량 매칭 회원 등록 API
router.post('/bulk-upload', upload.single('excelFile'), async (req, res) => {
    try {
        const { userRole, userCompany } = req.body;
        
        // 권한 체크
        if (!userRole || !['super', 'admin', 'user'].includes(userRole)) {
            return res.status(403).json({ error: '접근 권한이 없습니다.' });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: '엑셀 파일을 선택해주세요.' });
        }
        
        // 엑셀 파일 파싱
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // 헤더 검증 (첫 번째 행이 헤더여야 함)
        if (jsonData.length < 2) {
            return res.status(400).json({ error: '엑셀 파일에 데이터가 없습니다.' });
        }
        
        const headers = jsonData[0];
        const expectedHeaders = ['분류', '회원명', '예금주명', '은행명', '계좌번호'];
        
        // 헤더 검증
        const missingHeaders = expectedHeaders.filter(header => !headers.includes(header));
        if (missingHeaders.length > 0) {
            return res.status(400).json({ 
                error: `필수 컬럼이 누락되었습니다: ${missingHeaders.join(', ')}` 
            });
        }
        
        // 헤더 인덱스 찾기
        const headerIndexes = {
            category: headers.indexOf('분류'),
            member_name: headers.indexOf('회원명'),
            account_holder: headers.indexOf('예금주명'),
            bank_name: headers.indexOf('은행명'),
            account_number: headers.indexOf('계좌번호')
        };
        
        // 데이터 검증 및 변환
        const validData = [];
        const errors = [];
        
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            const rowNumber = i + 1;
            
            // 빈 행 건너뛰기
            if (row.every(cell => !cell || cell.toString().trim() === '')) {
                continue;
            }
            
            const data = {
                category: row[headerIndexes.category]?.toString().trim(),
                member_name: row[headerIndexes.member_name]?.toString().trim(),
                account_holder: row[headerIndexes.account_holder]?.toString().trim(),
                bank_name: row[headerIndexes.bank_name]?.toString().trim(),
                account_number: row[headerIndexes.account_number]?.toString().trim()
            };
            
            // 필수 필드 검증
            const missingFields = [];
            if (!data.category) missingFields.push('분류');
            if (!data.member_name) missingFields.push('회원명');
            if (!data.account_holder) missingFields.push('예금주명');
            if (!data.bank_name) missingFields.push('은행명');
            if (!data.account_number) missingFields.push('계좌번호');
            
            if (missingFields.length > 0) {
                errors.push(`행 ${rowNumber}: 필수 필드가 누락되었습니다 - ${missingFields.join(', ')}`);
                continue;
            }
            
            // 일반 사용자는 자신의 분류만 등록 가능
            if (userRole === 'user' && data.category !== userCompany) {
                errors.push(`행 ${rowNumber}: 자신의 분류(${userCompany})만 등록 가능합니다.`);
                continue;
            }
            
            validData.push(data);
        }
        
        if (errors.length > 0) {
            return res.status(400).json({ 
                error: '데이터 검증 실패', 
                details: errors 
            });
        }
        
        if (validData.length === 0) {
            return res.status(400).json({ error: '유효한 데이터가 없습니다.' });
        }
        
        // 데이터베이스에 일괄 등록
        const conn = await mysql.createConnection(dbConfig);
        
        try {
            await conn.beginTransaction();
            
            const results = {
                success: 0,
                failed: 0,
                errors: []
            };
            
            for (const data of validData) {
                try {
                    // 중복 검사
                    const [existing] = await conn.query(
                        'SELECT id FROM matching_members WHERE category = ? AND member_name = ?',
                        [data.category, data.member_name]
                    );
                    
                    if (existing.length > 0) {
                        results.failed++;
                        results.errors.push(`${data.category} - ${data.member_name}: 이미 존재하는 회원명입니다.`);
                        continue;
                    }
                    
                    // 매칭 회원 등록
                    await conn.query(
                        'INSERT INTO matching_members (category, member_name, account_holder, bank_name, account_number) VALUES (?, ?, ?, ?, ?)',
                        [data.category, data.member_name, data.account_holder, data.bank_name, data.account_number]
                    );
                    
                    results.success++;
                } catch (error) {
                    results.failed++;
                    results.errors.push(`${data.category} - ${data.member_name}: ${error.message}`);
                }
            }
            
            await conn.commit();
            await conn.end();
            
            logger.business('대량 매칭 회원 등록', { 
                total: validData.length,
                success: results.success,
                failed: results.failed,
                userRole 
            });
            
            res.json({
                success: true,
                message: `총 ${validData.length}건 중 ${results.success}건이 성공적으로 등록되었습니다.`,
                results
            });
            
        } catch (error) {
            await conn.rollback();
            await conn.end();
            throw error;
        }
        
    } catch (error) {
        logger.business('대량 매칭 회원 등록', { userRole }, error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 엑셀 템플릿 다운로드 API
router.get('/template', async (req, res) => {
    try {
        const { userRole, userCompany } = req.query;
        
        // 권한 체크
        if (!userRole || !['super', 'admin', 'user'].includes(userRole)) {
            return res.status(403).json({ error: '접근 권한이 없습니다.' });
        }
        
        // 일반 사용자는 자신의 분류로 고정
        const category = (userRole === 'user' && userCompany) ? userCompany : '예시회사';
        
        // 간단한 Excel 파일 생성 (XLSX 라이브러리 사용)
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet([
            ['분류', '회원명', '예금주명', '은행명', '계좌번호'],
            [category, '홍길동', '홍길동', '국민은행', '123456-78-901234']
        ]);
        
        XLSX.utils.book_append_sheet(workbook, worksheet, '매칭회원등록');
        
        // 버퍼로 변환
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="매칭회원등록템플릿.xlsx"');
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);
        
    } catch (error) {
        logger.business('엑셀 템플릿 다운로드', { userRole }, error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router;
