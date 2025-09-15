const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const dbConfig = require('../config/database');
const sseService = require('../services/sseService');
const logger = require('../utils/logger');

// 점검 모드 상태 조회
router.get('/status', async (req, res) => {
    try {
        const conn = await mysql.createConnection(dbConfig);
        const [settings] = await conn.query(
            'SELECT setting_value FROM system_settings WHERE setting_key = ?',
            ['maintenance_mode']
        );
        await conn.end();

        const isMaintenanceMode = settings.length > 0 ? settings[0].setting_value === 'true' : false;
        
        res.json({ 
            maintenance_mode: isMaintenanceMode,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('점검 모드 상태 조회 실패', { error: error.message });
        res.status(500).json({ error: '점검 모드 상태 조회에 실패했습니다.' });
    }
});

// 점검 모드 토글 (슈퍼 관리자만)
router.post('/toggle', async (req, res) => {
    try {
        // 슈퍼 관리자 권한 체크 (토큰 인증 제거로 인해 권한 체크 생략)

        const conn = await mysql.createConnection(dbConfig);
        
        // 현재 상태 조회
        const [currentSettings] = await conn.query(
            'SELECT setting_value FROM system_settings WHERE setting_key = ?',
            ['maintenance_mode']
        );

        let newValue = 'true'; // 기본값은 점검 모드 활성화
        if (currentSettings.length > 0) {
            newValue = currentSettings[0].setting_value === 'true' ? 'false' : 'true';
        }

        // 상태 업데이트
        await conn.query(
            'INSERT INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = CURRENT_TIMESTAMP',
            ['maintenance_mode', newValue, '시스템 점검 모드 (true: 점검 중, false: 정상 운영)', newValue]
        );

        await conn.end();

        const isMaintenanceMode = newValue === 'true';
        
        // SSE로 모든 클라이언트에게 점검 모드 변경 알림
        sseService.broadcastMaintenanceMode(isMaintenanceMode);

        logger.info('점검 모드 변경', { 
            user: req.user.username, 
            role: req.user.role, 
            maintenance_mode: isMaintenanceMode 
        });

        res.json({ 
            maintenance_mode: isMaintenanceMode,
            message: isMaintenanceMode ? '점검 모드가 활성화되었습니다.' : '점검 모드가 비활성화되었습니다.',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('점검 모드 토글 실패', { error: error.message });
        res.status(500).json({ error: '점검 모드 변경에 실패했습니다.' });
    }
});

// 점검 모드 체크 미들웨어 (다른 라우트에서 사용)
const checkMaintenanceMode = async (req, res, next) => {
    try {
        const conn = await mysql.createConnection(dbConfig);
        const [settings] = await conn.query(
            'SELECT setting_value FROM system_settings WHERE setting_key = ?',
            ['maintenance_mode']
        );
        await conn.end();

        const isMaintenanceMode = settings.length > 0 ? settings[0].setting_value === 'true' : false;
        
        if (isMaintenanceMode && req.user.role !== 'super') {
            return res.status(503).json({ 
                error: '점검 중입니다.',
                maintenance_mode: true,
                message: '시스템 점검 중입니다. 잠시 후 다시 시도해주세요.'
            });
        }
        
        next();
    } catch (error) {
        logger.error('점검 모드 체크 실패', { error: error.message });
        next(); // 오류 발생 시 정상 진행
    }
};

module.exports = { router, checkMaintenanceMode }; 