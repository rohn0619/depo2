const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const settlementService = require('../services/settlementService');
const logger = require('../utils/logger');

// 정산 대시보드 기본 통계 API - 인증 필요
router.get('/basic-stats', authenticateToken, async (req, res) => {
    try {
        const { period = 'today', company } = req.query;
        const stats = await settlementService.getBasicStats(req.user, period, company);
        res.json(stats);
    } catch (e) {
        logger.business('정산 기본 통계 조회', { period, company, user: req.user.username }, e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 정산 대시보드 출금 통계 API - 인증 필요
router.get('/withdrawal-stats', authenticateToken, async (req, res) => {
    try {
        const { period = 'today', company } = req.query;
        const stats = await settlementService.getWithdrawalStats(req.user, period, company);
        res.json(stats);
    } catch (e) {
        logger.business('정산 출금 통계 조회', { period, company, user: req.user.username }, e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 정산 대시보드 기간별 분석 API - 인증 필요
router.get('/period-analysis', authenticateToken, async (req, res) => {
    try {
        const { period = 'daily', days = 7, company } = req.query;
        
        const data = await settlementService.getPeriodAnalysis(req.user, period, days, company);
        
        res.json(data);
    } catch (e) {
        logger.business('정산 기간별 분석 조회', { period, days, company, user: req.user.username }, e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 정산 대시보드 입금자 분석 API - 인증 필요
router.get('/sender-analysis', authenticateToken, async (req, res) => {
    try {
        const { company, month } = req.query;
        const data = await settlementService.getSenderAnalysis(req.user, company, month);
        res.json(data);
    } catch (e) {
        logger.business('정산 입금자 분석 조회', { company: req.query.company || null, month: req.query.month || null, user: req.user.username }, e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 정산 대시보드 분류별 분석 API - 관리자 전용
router.get('/company-analysis', authenticateToken, async (req, res) => {
    try {
        const { month } = req.query;
        const data = await settlementService.getCompanyAnalysis(req.user, month);
        res.json(data);
    } catch (e) {
        logger.business('정산 분류별 분석 조회', { month: req.query.month || null, user: req.user.username }, e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 정산 대시보드 모든 분류 목록 API - 관리자 전용
router.get('/all-companies', authenticateToken, async (req, res) => {
    try {
        const data = await settlementService.getAllCompanies(req.user);
        res.json(data);
    } catch (e) {
        logger.business('정산 모든 분류 목록 조회', { user: req.user.username }, e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

module.exports = router; 