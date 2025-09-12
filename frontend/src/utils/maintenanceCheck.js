import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import sseClient from './sseClient';
import logger from './logger';

// 점검 모드 상태를 전역으로 관리
let maintenanceMode = false;
let maintenanceCallbacks = new Set();

// 점검 모드 상태 업데이트 함수
const updateMaintenanceMode = (isMaintenance) => {
    maintenanceMode = isMaintenance;
    maintenanceCallbacks.forEach(callback => callback(isMaintenance));
};

// 점검 모드 체크 훅
export const useMaintenanceCheck = () => {
    const navigate = useNavigate();
    const userRef = useRef(null);
    const isInitialized = useRef(false);

    useEffect(() => {
        // 사용자 정보 가져오기
        const userStr = localStorage.getItem('user');
        userRef.current = userStr ? JSON.parse(userStr) : null;

        // 슈퍼 관리자가 아닌 경우에만 점검 모드 체크
        if (userRef.current?.role !== 'super') {
            // 초기 점검 모드 상태 확인
            if (!isInitialized.current) {
                checkMaintenanceStatus();
                isInitialized.current = true;
            }

            // SSE로 점검 모드 변경 감지
            sseClient.setMaintenanceModeCallback((data) => {
                logger.info('점검 모드 변경 감지', data);
                updateMaintenanceMode(data.maintenance_mode);
                
                if (data.maintenance_mode) {
                    // 점검 모드 활성화 시 즉시 로그아웃
                    handleMaintenanceMode();
                }
            });

            // 점검 모드 상태 변경 콜백 등록
            const maintenanceCallback = (isMaintenance) => {
                if (isMaintenance) {
                    handleMaintenanceMode();
                }
            };
            maintenanceCallbacks.add(maintenanceCallback);

            return () => {
                maintenanceCallbacks.delete(maintenanceCallback);
                sseClient.setMaintenanceModeCallback(null);
            };
        }
    }, [navigate]);

    // 점검 모드 상태 확인
    const checkMaintenanceStatus = async () => {
        try {
            const response = await fetch('/api/maintenance/status');
            if (response.ok) {
                const data = await response.json();
                updateMaintenanceMode(data.maintenance_mode);
                
                if (data.maintenance_mode) {
                    handleMaintenanceMode();
                }
            }
        } catch (error) {
            logger.error('점검 모드 상태 확인 실패', error);
        }
    };

    // 점검 모드 처리
    const handleMaintenanceMode = () => {
        // 로컬 스토리지 정리
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // SSE 연결 해제
        sseClient.disconnect();
        
        // 점검 페이지로 리다이렉트
        navigate('/maintenance');
    };

    return { maintenanceMode };
};

// 점검 모드 토글 함수 (슈퍼 관리자용)
export const toggleMaintenanceMode = async () => {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('토큰이 없습니다.');
        }

        const response = await fetch('/api/maintenance/toggle', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            logger.info('점검 모드 토글 성공', data);
            return data;
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || '점검 모드 변경에 실패했습니다.');
        }
    } catch (error) {
        logger.error('점검 모드 토글 실패', error);
        throw error;
    }
}; 