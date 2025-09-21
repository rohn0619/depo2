import axios from 'axios';
import logger from './logger';

class PollingClient {
    constructor() {
        this.pollingInterval = null;
        this.isPolling = false;
        this.lastCheckedId = null;
        this.pollingDelay = 5000; // 3초마다 체크
        this.processedDeposits = new Set(); // 처리된 입금 ID 추적
        
        // 콜백 함수들
        this.onNewDeposit = null;
        this.onOneWonDeposit = null;
        this.onNewWithdrawal = null;
        this.onNewMemberDeposit = null;
        this.onUncheckedCountUpdate = null;
    }

    // 폴링 시작
    async start() {
        if (this.isPolling) return;
        
        // 새로고침 후 재시작인지 확인
        const wasActive = localStorage.getItem('polling_active') === 'true';
        const isRestart = wasActive && !this.isPolling;
        
        // 항상 lastCheckedId를 초기화 (로그인 시 기존 내역 무시)
        await this.initializeLastCheckedId();
        
        this.isPolling = true;
        this.pollingInterval = setInterval(() => {
            this.checkNewDeposits();
        }, this.pollingDelay);
        
        // 폴링 상태를 localStorage에 저장
        localStorage.setItem('polling_active', 'true');
        
        // 콘솔에 직접 출력 (확실히 보이도록)
        console.log('🔄 폴링 시작', { 
            delay: this.pollingDelay,
            isRestart: isRestart,
            lastCheckedId: this.lastCheckedId,
            timestamp: new Date().toISOString()
        });
        
        logger.info('🔄 폴링 시작', { 
            delay: this.pollingDelay,
            isRestart: isRestart,
            lastCheckedId: this.lastCheckedId,
            timestamp: new Date().toISOString()
        });
    }

    // 현재 최신 입금내역 ID를 가져와서 lastCheckedId로 설정
    async initializeLastCheckedId() {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user) {
                logger.warn('사용자 정보 없음 - lastCheckedId 초기화 실패');
                return;
            }

            const params = new URLSearchParams({
                role: user.role || 'user',
                company: user.company || ''
            });

            const response = await axios.get(`/api/deposits?${params}`);
            const data = response.data;
            
            // 새로운 API 응답 구조 처리
            let deposits = [];
            if (data.deposits && data.pagination) {
                // 새로운 페이지네이션 API 응답
                deposits = data.deposits;
            } else if (Array.isArray(data)) {
                // 기존 API 응답 (배열 형태)
                deposits = data;
            }

            if (deposits && deposits.length > 0) {
                // 가장 최신 입금내역의 ID를 lastCheckedId로 설정
                const maxId = Math.max(...deposits.map(d => d.id));
                this.lastCheckedId = maxId;
                
                console.log('📊 lastCheckedId 초기화 상세', { 
                    lastCheckedId: maxId,
                    totalDeposits: deposits.length,
                    userRole: user.role,
                    userCompany: user.company,
                    deposits: deposits.slice(0, 3).map(d => ({ id: d.id, amount: d.amount, sender: d.sender, company: d.company })),
                    timestamp: new Date().toISOString()
                });
                
                console.log('📊 lastCheckedId 초기화', { 
                    lastCheckedId: maxId,
                    totalDeposits: deposits.length,
                    deposits: deposits.slice(0, 3).map(d => ({ id: d.id, amount: d.amount, sender: d.sender })),
                    timestamp: new Date().toISOString()
                });
                
                logger.info('lastCheckedId 초기화', { 
                    lastCheckedId: maxId,
                    totalDeposits: deposits.length,
                    deposits: deposits.slice(0, 3).map(d => ({ id: d.id, amount: d.amount, sender: d.sender })),
                    timestamp: new Date().toISOString()
                });
            } else {
                logger.info('기존 입금내역 없음 - lastCheckedId를 0으로 설정');
                this.lastCheckedId = 0;
            }
        } catch (error) {
            logger.error('lastCheckedId 초기화 실패', error);
            // 오류 시 0으로 설정
            this.lastCheckedId = 0;
        }
    }

    // 폴링 중지
    stop() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.isPolling = false;
        
        // localStorage에서 폴링 상태 제거
        localStorage.removeItem('polling_active');
        
        console.log('⏹️ 폴링 중지', { timestamp: new Date().toISOString() });
        logger.info('⏹️ 폴링 중지', { timestamp: new Date().toISOString() });
    }

    // 새로운 입금내역 체크
    async checkNewDeposits() {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user) {
                logger.warn('사용자 정보 없음 - 폴링 중지');
                this.stop();
                return;
            }

            const params = new URLSearchParams({
                role: user.role || 'user',
                company: user.company || ''
            });

            if (this.lastCheckedId && this.lastCheckedId > 0) {
                params.append('lastCheckedId', this.lastCheckedId);
            }

            // 폴링 요청 로그
            console.log('📡 폴링 요청 시작', { 
                lastCheckedId: this.lastCheckedId,
                timestamp: new Date().toISOString()
            });
            
            logger.info('폴링 요청 시작', { 
                lastCheckedId: this.lastCheckedId,
                timestamp: new Date().toISOString()
            });

            const response = await axios.get(`/api/deposits/poll?${params}`);
            const data = response.data;

            // 폴링 응답 로그
            console.log('📥 폴링 응답 수신', { 
                newDepositsCount: data.newDeposits?.length || 0,
                uncheckedCount: data.uncheckedCount,
                timestamp: new Date().toISOString()
            });
            
            logger.info('폴링 응답 수신', { 
                newDepositsCount: data.newDeposits?.length || 0,
                uncheckedCount: data.uncheckedCount,
                timestamp: new Date().toISOString()
            });

            // 새로운 입금내역 처리
            if (data.newDeposits && data.newDeposits.length > 0) {
                logger.info('새로운 입금내역 발견', { 
                    count: data.newDeposits.length,
                    deposits: data.newDeposits.map(d => ({ id: d.id, amount: d.amount, sender: d.sender }))
                });
                
                data.newDeposits.forEach(deposit => {
                    this.processDeposit(deposit);
                });

                // 마지막 체크 ID 업데이트
                const maxId = Math.max(...data.newDeposits.map(d => d.id));
                this.lastCheckedId = maxId;
                logger.info('마지막 체크 ID 업데이트', { newLastCheckedId: maxId });
            } else {
                logger.info('새로운 입금내역 없음');
            }

            // 미확인 개수 업데이트
            if (this.onUncheckedCountUpdate) {
                this.onUncheckedCountUpdate({ count: data.uncheckedCount });
            }

        } catch (error) {
            console.error('❌ 폴링 요청 실패', {
                error: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                timestamp: new Date().toISOString()
            });
            logger.error('폴링 요청 실패', error);
        }
    }

    // 입금내역 처리
    processDeposit(deposit) {
        // 이미 처리된 입금인지 확인
        if (this.processedDeposits.has(deposit.id)) {
            console.log('⚠️ 이미 처리된 입금 건너뜀:', deposit.id);
            return;
        }
        
        // 처리된 입금 ID 추가
        this.processedDeposits.add(deposit.id);
        
        logger.info('입금내역 처리 시작', { 
            id: deposit.id, 
            amount: deposit.amount, 
            transaction_type: deposit.transaction_type,
            sender: deposit.sender 
        });

        // 1원 입금 체크
        if (deposit.amount === 1 && deposit.transaction_type === 1) {
            logger.info('🚨 1원 입금 발견!', { 
                id: deposit.id, 
                sender: deposit.sender, 
                timestamp: new Date().toISOString() 
            });
            if (this.onOneWonDeposit) {
                this.onOneWonDeposit({
                    type: 'one_won_deposit',
                    deposit: deposit
                });
            }
        }
        // 일반 입금
        else if (deposit.transaction_type === 1) {
            logger.info('💰 새 입금 발견!', { 
                id: deposit.id, 
                amount: deposit.amount, 
                sender: deposit.sender,
                is_matching_member: deposit.is_matching_member,
                requires_new_alert: deposit.requires_new_alert,
                timestamp: new Date().toISOString() 
            });
            
            // 매칭 회원 여부에 따라 다른 알림
            console.log('🔍 폴링 클라이언트에서 받은 데이터:', {
                id: deposit.id,
                is_matching_member: deposit.is_matching_member,
                requires_new_alert: deposit.requires_new_alert,
                sender: deposit.sender
            });
            
            if (deposit.is_matching_member === 1 || deposit.is_matching_member === true) {
                // 매칭 회원: 기존 "새로운 내역이 있습니다" 알림
                logger.info('💰 매칭 회원 입금 발견!', { 
                    id: deposit.id, 
                    amount: deposit.amount, 
                    sender: deposit.sender,
                    timestamp: new Date().toISOString() 
                });
                if (this.onNewDeposit) {
                    this.onNewDeposit({
                        type: 'new_deposit',
                        deposit: deposit
                    });
                }
            } else {
                // 비매칭 회원: 다른 알림
                logger.info('🆕 새로운 회원 입금 발견!', { 
                    id: deposit.id, 
                    amount: deposit.amount, 
                    sender: deposit.sender,
                    is_matching_member: deposit.is_matching_member,
                    timestamp: new Date().toISOString() 
                });
                if (this.onNewMemberDeposit) {
                    this.onNewMemberDeposit({
                        type: 'new_member_deposit',
                        deposit: deposit
                    });
                }
            }
        }
        // 출금
        else if (deposit.transaction_type === 0) {
            logger.info('💸 새 출금 발견!', { 
                id: deposit.id, 
                amount: deposit.amount, 
                sender: deposit.sender,
                timestamp: new Date().toISOString() 
            });
            if (this.onNewWithdrawal) {
                this.onNewWithdrawal({
                    type: 'new_withdrawal',
                    deposit: deposit
                });
            }
        }
    }

    // 콜백 설정
    setNewDepositCallback(callback) {
        this.onNewDeposit = callback;
    }

    setOneWonDepositCallback(callback) {
        this.onOneWonDeposit = callback;
    }

    setNewWithdrawalCallback(callback) {
        this.onNewWithdrawal = callback;
    }

    setNewMemberDepositCallback(callback) {
        this.onNewMemberDeposit = callback;
    }

    setUncheckedCountUpdateCallback(callback) {
        this.onUncheckedCountUpdate = callback;
    }

    // 마지막 체크 ID 설정
    setLastCheckedId(id) {
        this.lastCheckedId = id;
        logger.info('마지막 체크 ID 설정', { id });
    }

    // 폴링 상태 확인
    isActive() {
        const status = this.isPolling;
        console.log('🔍 폴링 상태 확인', { 
            isActive: status, 
            timestamp: new Date().toISOString() 
        });
        return status;
    }

    // 폴링 상태 상세 정보
    getStatus() {
        return {
            isPolling: this.isPolling,
            lastCheckedId: this.lastCheckedId,
            pollingDelay: this.pollingDelay,
            timestamp: new Date().toISOString()
        };
    }

    // 폴링 상태 로그 출력 (디버깅용)
    logStatus() {
        const status = this.getStatus();
        logger.info('📊 폴링 상태', status);
        return status;
    }
}

// 싱글톤 인스턴스 생성
const pollingClient = new PollingClient();

// 전역에서 폴링 상태 확인 가능하도록 설정 (개발용)
if (typeof window !== 'undefined') {
    window.pollingClient = pollingClient;
    window.checkPollingStatus = () => {
        pollingClient.logStatus();
    };
}

export default pollingClient; 