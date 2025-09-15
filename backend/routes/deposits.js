const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const dbConfig = require('../config/database');
const depositService = require('../services/depositService');
const { stringToDictionary } = require('../utils/stringParser');
const logger = require('../utils/logger');

// 입금내역 조회 API (페이지네이션 + 필터링 지원)
router.get('/', async (req, res) => {
    try {
        const { role, company, page, limit, search, selectedCompany, dateFrom, dateTo, fee } = req.query;
        
        // 정산 사용자의 경우 추가 정보 전달
        const filters = { 
            role, 
            company, 
            page, 
            limit, 
            search, 
            selectedCompany, 
            dateFrom, 
            dateTo 
        };
        
        // 정산 사용자인 경우 수수료 정보 추가 및 자신의 분류만 조회
        if (role === 'settlement') {
            filters.userRole = 'settlement';
            filters.userSettlementFee = parseFloat(fee) || 0;
            // 정산 사용자는 자신의 분류만 조회
            filters.company = company;
            filters.selectedCompany = company;
        }
        
        const result = await depositService.getDeposits(filters);
        
        // 기존 API와의 호환성을 위해 배열 형태도 지원
        if (req.query.format === 'array') {
            res.json(result.deposits);
        } else {
            res.json(result);
        }
    } catch (e) {
        logger.business('입금내역 조회', { role, company, page, limit, search, selectedCompany, dateFrom, dateTo }, e);
        res.status(500).json({ deposits: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0, hasNext: false, hasPrev: false } });
    }
});

// 문자 파싱 후 DB 저장 API
router.post('/', async (req, res) => {
    try {
        const sms = req.body.sms;
        const modifiedData = req.body.modified_data;
        
        if (!sms || typeof sms !== 'string' || !sms.trim()) {
            logger.business('SMS 파싱 입력 검증 실패', { body: req.body }, new Error('sms 필드 누락 또는 빈 값'));
            return res.status(400).json({ error: 'sms 필드에 문자열을 입력하세요.' });
        }
        
        // 승인된 company 목록 가져오기
        const conn = await mysql.createConnection(dbConfig);
        const [approvedCompanies] = await conn.query(
            'SELECT name FROM companies WHERE is_approved = 1'
        );
        await conn.end();
        
        // 수정된 데이터가 있으면 그것을 사용, 없으면 파싱
        let parsed;
        if (modifiedData && typeof modifiedData === 'object') {
            parsed = modifiedData;
            logger.info('수정된 데이터 사용', { modifiedData });
        } else {
            parsed = stringToDictionary(sms, approvedCompanies);
            logger.info('파싱된 데이터 사용', { parsed });
        }
        let date = null, bank = null, amount = null, balance = null, sender = null, company = null, transaction_type = 1;
        let parseSuccess = false;
        
        if (parsed.bank && parsed.datetime && parsed.amount && parsed.sender_name && parsed.transaction_type !== null) {
            // 날짜 변환 (원본 시간 유지)
            date = parsed.datetime.replace(/\//g, '-').trim();
            if (/^\d{2}-\d{2} \d{2}:\d{2}$/.test(date)) {
                // MM-DD HH:mm 형식인 경우 현재 년도 추가 (시간은 원본 유지)
                const now = new Date();
                date = `${now.getFullYear()}-${date}:00`;
            } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(date)) {
                // YYYY-MM-DD HH:mm 형식인 경우 초 추가
                date += ':00';
            }
            
            // 최종 검증
            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date)) {
                bank = parsed.bank;
                amount = parsed.amount;
                balance = parsed.balance;
                sender = parsed.sender_name;
                company = parsed.company || '';
                // transaction_type 설정 (입금: 1, 출금: 0)
                transaction_type = parsed.transaction_type === 'withdrawal' ? 0 : 1;
                parseSuccess = true;
            } else {
                logger.business('SMS 날짜 변환 실패', { 
                    original: parsed.datetime, 
                    converted: date 
                }, new Error('날짜 형식 변환 실패'));
            }
        } else {
            logger.business('SMS 파싱 실패', { 
                sms, 
                parsed,
                missingFields: {
                    bank: !parsed.bank,
                    datetime: !parsed.datetime,
                    amount: !parsed.amount,
                    sender_name: !parsed.sender_name,
                    transaction_type: !parsed.transaction_type
                }
            }, new Error('필수 필드 누락'));
        }
        
        const depositId = await depositService.createDeposit({
            date, bank, amount, balance, sender, company, transaction_type, sms_raw: sms
        });
        
        // 폴링을 통해서만 알림 전송하므로 SSE 알림 제거
        if (parseSuccess) {
            logger.info('입금내역 저장 완료 - 폴링을 통한 알림 대기', { 
                depositId, 
                transaction_type, 
                amount, 
                sender, 
                company 
            });
        } else {
            logger.info('알림 전송 제외', { 
                depositId, 
                parseSuccess, 
                transaction_type, 
                reason: '파싱 실패'
            });
        }
        
        res.json({ success: parseSuccess, id: depositId, parseSuccess });
    } catch (e) {
        logger.business('SMS 파싱 및 저장', { sms: sms.substring(0, 100) }, e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 미확인 입금내역 개수 조회 API
router.get('/unchecked-count', async (req, res) => {
    try {
        const { role, company } = req.query;
        const count = await depositService.getUncheckedCount({ role, company });
        res.json({ count });
    } catch (e) {
        logger.business('미확인 입금내역 개수 조회', { role, company }, e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 입금내역 확인 상태 변경 API
router.put('/:id/check', async (req, res) => {
    try {
        const { is_checked } = req.body;
        const { role, company } = req.query;
        const depositId = req.params.id;
        
        if (typeof is_checked !== 'boolean') {
            return res.status(400).json({ error: 'is_checked는 boolean 값이어야 합니다.' });
        }
        
        await depositService.updateDepositCheckStatus(depositId, is_checked, { role, company });
        res.json({ success: true, message: '확인 상태가 업데이트되었습니다.' });
    } catch (e) {
        logger.business('입금내역 확인 상태 변경', { depositId, is_checked, role, company }, e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 입금내역 삭제 API
router.delete('/:id', async (req, res) => {
    try {
        const { role, company } = req.query;
        const depositId = req.params.id;
        
        await depositService.deleteDeposit(depositId, { role, company });
        res.json({ success: true, message: '입금내역이 삭제되었습니다.' });
    } catch (e) {
        logger.business('입금내역 삭제', { depositId, role, company }, e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 고유한 분류값 목록 조회 API
router.get('/companies', async (req, res) => {
    try {
        const conn = await mysql.createConnection(dbConfig);
        const [companies] = await conn.query(
            'SELECT DISTINCT company FROM deposits WHERE company IS NOT NULL AND company != "" ORDER BY company'
        );
        await conn.end();
        
        const companyList = companies.map(row => row.company);
        res.json(companyList);
    } catch (e) {
        logger.business('분류값 목록 조회', null, e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 외부 API 문자 수신 및 자동 저장 API (인증 불필요)
router.post('/receive-sms', async (req, res) => {
    try {
        // JSON과 form-urlencoded 모두 지원
        const sms = req.body.sms || req.body.message || req.body.text || req.body.content || '';
        
        if (!sms || typeof sms !== 'string' || !sms.trim()) {
            logger.business('외부 API SMS 입력 검증 실패', { body: req.body }, new Error('sms 필드 누락 또는 빈 값'));
            return res.status(400).json({ error: 'sms 필드에 문자열을 입력하세요.' });
        }
        
        // 입금 또는 출금 키워드 확인
        if (!sms.includes('입금') && !sms.includes('출금') && !sms.includes('이체') && !sms.includes('송금') && !sms.includes('인출')) {
            return res.json({ 
                success: true, 
                skipped: true,
                reason: '입금/출금 키워드가 없어서 처리하지 않습니다.',
                message: '입금/출금 관련 문자가 아닙니다.'
            });
        }
        
        // 승인된 company 목록 가져오기
        const conn = await mysql.createConnection(dbConfig);
        const [approvedCompanies] = await conn.query(
            'SELECT name FROM companies WHERE is_approved = 1'
        );
        await conn.end();
        
        const parsed = stringToDictionary(sms, approvedCompanies);
        
        let date = null, bank = null, amount = null, balance = null, sender = null, company = null, transaction_type = 1;
        let parseSuccess = false;
        
        if (parsed.bank && parsed.datetime && parsed.amount && parsed.sender_name && parsed.transaction_type !== null) {
            // 날짜 변환 (원본 시간 유지)
            date = parsed.datetime.replace(/\//g, '-').trim();
            
            if (/^\d{2}-\d{2} \d{2}:\d{2}$/.test(date)) {
                // MM-DD HH:mm 형식인 경우 현재 년도 추가 (시간은 원본 유지)
                const now = new Date();
                date = `${now.getFullYear()}-${date}:00`;
            } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(date)) {
                // YYYY-MM-DD HH:mm 형식인 경우 초 추가
                date += ':00';
            }
            
            // 최종 검증
            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date)) {
                bank = parsed.bank;
                amount = parsed.amount;
                balance = parsed.balance;
                sender = parsed.sender_name;
                company = parsed.company || '';
                // transaction_type 설정 (입금: 1, 출금: 0)
                transaction_type = parsed.transaction_type === 'withdrawal' ? 0 : 1;
                parseSuccess = true;
            } else {
                logger.business('외부 API SMS 날짜 변환 실패', { 
                    original: parsed.datetime, 
                    converted: date 
                }, new Error('날짜 형식 변환 실패'));
            }
        } else {
            logger.business('외부 API SMS 파싱 실패', { 
                sms: sms.substring(0, 100), 
                parsed,
                missingFields: {
                    bank: !parsed.bank,
                    datetime: !parsed.datetime,
                    amount: !parsed.amount,
                    sender_name: !parsed.sender_name,
                    transaction_type: !parsed.transaction_type
                }
            }, new Error('필수 필드 누락'));
        }
        
        const depositId = await depositService.createDeposit({
            date, bank, amount, balance, sender, company, transaction_type, sms_raw: sms
        });
        
        // 폴링을 통해서만 알림 전송하므로 SSE 알림 제거
        if (parseSuccess) {
            logger.info('외부 API 입금내역 저장 완료 - 폴링을 통한 알림 대기', { 
                depositId, 
                transaction_type, 
                amount, 
                sender, 
                company 
            });
        }
        
        const response = { 
            success: true, 
            id: depositId, 
            parseSuccess,
            parsed: parseSuccess ? { bank, amount, sender, company, date } : null
        };
        
        res.json(response);
        
    } catch (e) {
        logger.business('외부 API SMS 수신 및 처리', { 
            body: req.body,
            sms: req.body.sms ? req.body.sms.substring(0, 100) : null
        }, e);
        res.status(500).json({ error: '서버 오류', message: e.message });
    }
});

// 폴링용 새로운 입금내역 체크 API
router.get('/poll', async (req, res) => {
    try {
        const { role, company, lastCheckedId } = req.query;
        
        // 마지막 체크 ID가 없으면 최근 1분간의 입금내역 반환
        let query = `
            SELECT d.id, 
                   DATE_FORMAT(d.date, '%Y-%m-%d %H:%i:%s') as date,
                   d.bank, d.amount, d.balance, d.transaction_type,
                   d.sender, d.company, d.sms_raw, d.is_checked,
                   d.created_at, u.fee, u.company_name
            FROM deposits d 
            LEFT JOIN users u ON d.company = u.company
        `;
        let params = [];
        
        if (lastCheckedId && lastCheckedId > 0) {
            // 마지막 체크 ID 이후의 새로운 입금내역
            query += ' WHERE d.id > ?';
            params.push(lastCheckedId);
        } else {
            // lastCheckedId가 없거나 0이면 빈 결과 반환 (기존 내역 무시)
            query += ' WHERE 1 = 0';
        }
        
        // 일반 사용자는 자신의 분류와 일치하는 입금내역만 조회
        if (role === 'user' && company && company.trim() !== '') {
            query += lastCheckedId && lastCheckedId > 0 ? ' AND d.company = ?' : ' AND d.company = ?';
            params.push(company);
        }
        
        query += ' ORDER BY d.id DESC';
        
        const conn = await mysql.createConnection(dbConfig);
        const [rows] = await conn.query(query, params);
        await conn.end();
        
        // 프론트엔드 호환을 위해 데이터 포맷 변환
        const deposits = rows.map(row => {
            const fee = row.fee || 0;
            const feeAmount = row.transaction_type === 1 ? Math.round((row.amount * fee) / 100) : 0;
            const netAmount = row.transaction_type === 1 ? row.amount - feeAmount : row.amount;
            
            return {
                id: row.id,
                date: row.date,
                bank: row.bank,
                amount: row.amount,
                balance: row.balance,
                transaction_type: row.transaction_type,
                fee: row.transaction_type === 1 ? fee : 0,
                fee_amount: feeAmount,
                net_amount: netAmount,
                sender: row.sender,
                company: row.company,
                company_name: row.company_name,
                sms_raw: row.sms_raw,
                is_checked: row.is_checked,
                created_at: row.created_at
            };
        });
        
        // 미확인 개수도 함께 반환
        let uncheckedQuery = 'SELECT COUNT(*) as count FROM deposits WHERE is_checked = FALSE';
        let uncheckedParams = [];
        
        if (role === 'user' && company && company.trim() !== '') {
            uncheckedQuery += ' AND company = ?';
            uncheckedParams.push(company);
        }
        
        const conn2 = await mysql.createConnection(dbConfig);
        const [uncheckedRows] = await conn2.query(uncheckedQuery, uncheckedParams);
        await conn2.end();
        
        res.json({
            newDeposits: deposits,
            uncheckedCount: uncheckedRows[0].count,
            timestamp: new Date().toISOString()
        });
        
    } catch (e) {
        logger.business('폴링 입금내역 조회', { role, company, lastCheckedId }, e);
        res.status(500).json({ 
            newDeposits: [], 
            uncheckedCount: 0, 
            error: '조회 실패' 
        });
    }
});

module.exports = router; 