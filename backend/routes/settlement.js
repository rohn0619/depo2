const express = require('express');
const router = express.Router();
const settlementService = require('../services/settlementService');
const logger = require('../utils/logger');
const mysql = require('mysql2/promise');
const dbConfig = require('../config/database');

// 정산 대시보드 기본 통계 API - 인증 필요
router.get('/basic-stats', async (req, res) => {
    const { period = 'today', company } = req.query;
    
    
    try {
        const stats = await settlementService.getBasicStats({}, period, company);
        res.json(stats);
    } catch (e) {
        logger.business('정산 기본 통계 조회', { period, company }, e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 정산 대시보드 출금 통계 API - 인증 필요
router.get('/withdrawal-stats', async (req, res) => {
    try {
        const { period = 'today', company } = req.query;
        const stats = await settlementService.getWithdrawalStats({}, period, company);
        res.json(stats);
    } catch (e) {
        logger.business('정산 출금 통계 조회', { period, company }, e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 정산 대시보드 기간별 분석 API - 인증 필요
router.get('/period-analysis', async (req, res) => {
    try {
        const { period = 'daily', days = 7, company } = req.query;
        
        const data = await settlementService.getPeriodAnalysis({}, period, days, company);
        
        res.json(data);
    } catch (e) {
        logger.business('정산 기간별 분석 조회', { period, days, company }, e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 정산 대시보드 입금자 분석 API - 인증 필요
router.get('/sender-analysis', async (req, res) => {
    try {
        const { company, month } = req.query;
        const data = await settlementService.getSenderAnalysis({}, company, month);
        res.json(data);
    } catch (e) {
        logger.business('정산 입금자 분석 조회', { company: req.query.company || null, month: req.query.month || null }, e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 정산 대시보드 분류별 분석 API - 관리자 전용
router.get('/company-analysis', async (req, res) => {
    try {
        const { month } = req.query;
        const data = await settlementService.getCompanyAnalysis({}, month);
        res.json(data);
    } catch (e) {
        logger.business('정산 분류별 분석 조회', { month: req.query.month || null }, e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 정산 대시보드 모든 분류 목록 API - 관리자 전용
router.get('/all-companies', async (req, res) => {
    try {
        const data = await settlementService.getAllCompanies({});
        res.json(data);
    } catch (e) {
        logger.business('정산 모든 분류 목록 조회', {}, e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 정산 사용자 전용 대시보드 API
router.get('/settlement-dashboard', async (req, res) => {
    try {
        const { period = 'today', company, fee } = req.query;
        
        // 정산 사용자의 분류에 해당하는 입금 내역만 조회
        const conn = await mysql.createConnection(dbConfig);
        
        // 기본 통계 조회
        let dateFilter = '';
        switch (period) {
            case 'today':
                dateFilter = 'AND DATE(date) = CURDATE()';
                break;
            case 'week':
                dateFilter = 'AND date >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
                break;
            case 'month':
                dateFilter = 'AND date >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
                break;
            default:
                dateFilter = 'AND DATE(date) = CURDATE()';
        }
        
        // 정산 사용자의 수수료 비율
        const settlementFeeRate = parseFloat(fee) || 0;
        
        // 입금 통계 (transaction_type = 1)
        const depositQuery = `
            SELECT 
                COUNT(*) as count,
                SUM(amount) as total_amount,
                SUM(amount * (SELECT fee FROM users WHERE company = d.company AND role != 'settlement' LIMIT 1) / 100) as total_fee_amount
            FROM deposits d 
            WHERE company = ? AND transaction_type = 1 ${dateFilter}
        `;
        
        const [depositRows] = await conn.query(depositQuery, [company]);
        const depositStats = depositRows[0];
        
        // 정산 수수료 계산
        const settlementFeeAmount = Math.round((depositStats.total_fee_amount || 0) * settlementFeeRate / 100);
        
        // 출금 통계 (transaction_type = 0)
        const withdrawalQuery = `
            SELECT 
                COUNT(*) as count,
                SUM(amount) as total_amount
            FROM deposits d 
            WHERE company = ? AND transaction_type = 0 ${dateFilter}
        `;
        
        const [withdrawalRows] = await conn.query(withdrawalQuery, [company]);
        const withdrawalStats = withdrawalRows[0];
        
        await conn.end();
        
        res.json({
            period,
            settlement_fee_rate: settlementFeeRate,
            deposits: {
                count: depositStats.count || 0,
                total_amount: depositStats.total_amount || 0,
                total_fee_amount: depositStats.total_fee_amount || 0
            },
            withdrawals: {
                count: withdrawalStats.count || 0,
                total_amount: withdrawalStats.total_amount || 0
            },
            settlement: {
                fee_rate: settlementFeeRate,
                fee_amount: settlementFeeAmount
            }
        });
        
    } catch (e) {
        logger.business('정산 사용자 대시보드', { period, company, fee }, e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

module.exports = router; 