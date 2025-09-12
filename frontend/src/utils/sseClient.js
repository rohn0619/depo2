import logger from './logger';
import API_BASE_URL from '../config';

class SSEClient {
    constructor() {
        this.eventSource = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // 1초
        this.isConnected = false;
        this.onNewDeposit = null;
        this.onOneWonDeposit = null;
        this.onNewWithdrawal = null;
        this.onUncheckedCountUpdate = null;
        this.onConnectionChange = null;
        this.onMaintenanceMode = null;
    }

    // SSE 연결 시작
    connect(userId) {
        if (this.eventSource) {
            this.disconnect();
        }

        try {
            // 사용자 ID를 쿼리 파라미터로 전달
            const url = `${API_BASE_URL}/api/sse/connect?token=${encodeURIComponent(userId)}`;
            this.eventSource = new EventSource(url);

            this.setupEventListeners();
            logger.info('SSE 연결 시도', { url: url.replace(userId, '[USER_ID]') });
        } catch (error) {
            console.error('❌ SSE 연결 실패:', error);
            logger.error('SSE 연결 실패', error);
            this.scheduleReconnect();
        }
    }

    // 이벤트 리스너 설정
    setupEventListeners() {
        if (!this.eventSource) return;

        // 연결 성공
        this.eventSource.onopen = () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            logger.info('SSE 연결 성공');
            if (this.onConnectionChange) {
                this.onConnectionChange(true);
            }
        };

        // 메시지 수신 (일반 메시지)
        this.eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // 이벤트 타입에 따라 적절한 콜백 호출
                switch (data.type) {
                    case 'connection':
                        logger.info('SSE 연결 확인', data);
                        break;
                    case 'new_deposit':
                        logger.info('새 입금 내역 이벤트 수신', data);
                        if (this.onNewDeposit) {
                            this.onNewDeposit(data);
                        }
                        break;
                    case 'one_won_deposit':
                        logger.info('1원 입금 내역 이벤트 수신', data);
                        if (this.onOneWonDeposit) {
                            this.onOneWonDeposit(data);
                        }
                        break;
                    case 'new_withdrawal':
                        logger.info('새 출금 내역 이벤트 수신', data);
                        if (this.onNewWithdrawal) {
                            this.onNewWithdrawal(data);
                        }
                        break;
                    case 'unchecked_count_update':
                        logger.info('미확인 개수 업데이트 이벤트 수신', data);
                        if (this.onUncheckedCountUpdate) {
                            this.onUncheckedCountUpdate(data);
                        }
                        break;
                    case 'maintenance_mode_change':
                        logger.info('점검 모드 변경 이벤트 수신', data);
                        if (this.onMaintenanceMode) {
                            this.onMaintenanceMode(data);
                        }
                        break;
                    default:
                        logger.warn('알 수 없는 이벤트 타입', { type: data.type, data });
                }
            } catch (error) {
                console.error('❌ SSE 메시지 파싱 실패:', error, event.data);
                logger.error('SSE 메시지 파싱 실패', { event: event.data, error });
            }
        };

        // 연결 오류
        this.eventSource.onerror = (error) => {
            this.isConnected = false;
            logger.error('SSE 연결 오류', error);
            
            if (this.onConnectionChange) {
                this.onConnectionChange(false);
            }

            // 자동 재연결 시도
            this.scheduleReconnect();
        };
    }

    // 재연결 스케줄링
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error('SSE 최대 재연결 시도 횟수 초과');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 지수 백오프

        logger.info('SSE 재연결 시도 예약', { 
            attempt: this.reconnectAttempts, 
            delay 
        });

        setTimeout(() => {
            const token = localStorage.getItem('token');
            if (token) {
                this.connect(token);
            }
        }, delay);
    }

    // 연결 해제
    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        this.isConnected = false;
        this.reconnectAttempts = 0;
        
        if (this.onConnectionChange) {
            this.onConnectionChange(false);
        }
        
        logger.info('SSE 연결 해제');
    }

    // 새 입금 내역 콜백 설정
    setNewDepositCallback(callback) {
        this.onNewDeposit = callback;
    }

    // 1원 입금 내역 콜백 설정
    setOneWonDepositCallback(callback) {
        this.onOneWonDeposit = callback;
    }

    // 새 출금 내역 콜백 설정
    setNewWithdrawalCallback(callback) {
        this.onNewWithdrawal = callback;
    }

    // 미확인 개수 업데이트 콜백 설정
    setUncheckedCountUpdateCallback(callback) {
        this.onUncheckedCountUpdate = callback;
    }

    // 연결 상태 변경 콜백 설정
    setConnectionChangeCallback(callback) {
        this.onConnectionChange = callback;
    }

    // 점검 모드 변경 콜백 설정
    setMaintenanceModeCallback(callback) {
        this.onMaintenanceMode = callback;
    }

    // 연결 상태 확인
    getConnectionStatus() {
        return this.isConnected;
    }
}

// 싱글톤 인스턴스 생성
const sseClient = new SSEClient();

export default sseClient; 