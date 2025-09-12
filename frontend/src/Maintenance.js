import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Maintenance.css';
import logger from './utils/logger';

function Maintenance() {
    const navigate = useNavigate();
    const [isChecking, setIsChecking] = useState(false);
    const [lastCheck, setLastCheck] = useState(null);

    // 점검 모드 상태 확인
    const checkMaintenanceStatus = async () => {
        setIsChecking(true);
        try {
            const response = await fetch('/api/maintenance/status');
            const data = await response.json();
            setLastCheck(new Date());
            
            // 점검 모드가 비활성화되면 로그인 페이지로 이동
            if (!data.maintenance_mode) {
                logger.info('점검 모드 해제됨, 로그인 페이지로 이동');
                navigate('/');
            }
        } catch (error) {
            logger.error('점검 모드 상태 확인 실패', error);
        } finally {
            setIsChecking(false);
        }
    };

    // 주기적으로 점검 모드 상태 확인 (30초마다)
    useEffect(() => {
        checkMaintenanceStatus();
        
        const interval = setInterval(checkMaintenanceStatus, 30000);
        
        return () => clearInterval(interval);
    }, [navigate]);

    return (
        <div className="maintenance-container">
            <div className="maintenance-content">
                <div className="maintenance-icon">🔧</div>
                <h1>시스템 점검 중</h1>
                <p className="maintenance-message">
                    현재 시스템 점검을 진행하고 있습니다.<br />
                    잠시 후 다시 시도해주세요.
                </p>
                
                <div className="maintenance-status">
                    <button 
                        onClick={checkMaintenanceStatus}
                        disabled={isChecking}
                        className="check-status-button"
                    >
                        {isChecking ? '확인 중...' : '상태 확인'}
                    </button>
                    
                    {lastCheck && (
                        <p className="last-check">
                            마지막 확인: {lastCheck.toLocaleTimeString()}
                        </p>
                    )}
                </div>
                
                <div className="maintenance-info">
                    <p>점검 완료 후 자동으로 로그인 페이지로 이동됩니다.</p>
                    <p>문의사항이 있으시면 관리자에게 연락해주세요.</p>
                </div>
            </div>
        </div>
    );
}

export default Maintenance; 