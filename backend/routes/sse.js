const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const sseService = require('../services/sseService');
const logger = require('../utils/logger');

// SSE 연결 엔드포인트 (토큰을 쿼리 파라미터로 받음)
router.get('/connect', (req, res) => {
    try {
        // 쿼리 파라미터에서 토큰 추출 (사용자 식별용)
        const token = req.query.token;
        if (!token) {
            logger.warn('SSE 연결 시도 - 토큰 없음');
            return res.status(401).json({ error: '토큰이 필요합니다.' });
        }

        logger.info('SSE 연결 시도', { 
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            hasToken: !!token 
        });

        // 클라이언트 ID 생성 (토큰 + 타임스탬프)
        const clientId = `${token}_${Date.now()}`;
        
        // 임시 사용자 객체 생성 (기본 권한)
        const user = {
            id: token,
            username: `user_${token}`,
            role: 'user', // 기본 권한
            company: '' // 빈 문자열로 설정하여 모든 입금 내역 알림
        };
        
        logger.info('SSE 클라이언트 연결', { 
            clientId, 
            userId: user.id, 
            username: user.username,
            role: user.role 
        });
        
        // SSE 서비스에 클라이언트 추가
        sseService.addClient(clientId, res, user);
        
        // 클라이언트 연결 해제 시 정리
        req.on('close', () => {
            logger.info('SSE 클라이언트 연결 해제', { clientId });
            sseService.removeClient(clientId);
        });
        
        req.on('error', (error) => {
            logger.error('SSE 연결 오류', { clientId, error: error.message });
            sseService.removeClient(clientId);
        });
        
    } catch (error) {
        logger.error('SSE 연결 설정 실패', { error: error.message });
        res.status(500).json({ error: 'SSE 연결 설정에 실패했습니다.' });
    }
});

// SSE 상태 확인 엔드포인트 (관리자용)
router.get('/status', authenticateToken, (req, res) => {
    try {
        // 관리자만 접근 가능
        if (req.user.role !== 'admin' && req.user.role !== 'super') {
            return res.status(403).json({ error: '접근 권한이 없습니다.' });
        }
        
        const status = {
            connectedClients: sseService.getClientCount(),
            clients: sseService.getClientInfo(),
            timestamp: new Date().toISOString()
        };
        
        res.json(status);
    } catch (error) {
        logger.error('SSE 상태 조회 실패', { error: error.message });
        res.status(500).json({ error: 'SSE 상태 조회에 실패했습니다.' });
    }
});

module.exports = router; 