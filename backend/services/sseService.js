const logger = require('../utils/logger');

class SSEService {
    constructor() {
        this.clients = new Map(); // clientId -> { res, user, lastEventId }
        this.lastEventId = 0;
    }

    // 클라이언트 연결 추가
    addClient(clientId, res, user) {
        // SSE 헤더 설정
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
        });

        // 연결 유지를 위한 하트비트
        const heartbeat = setInterval(() => {
            if (res.writableEnded) {
                clearInterval(heartbeat);
                this.removeClient(clientId);
                return;
            }
            res.write(':\n\n'); // 주석 형태의 하트비트
        }, 30000); // 30초마다

        // 클라이언트 정보 저장
        this.clients.set(clientId, {
            res,
            user,
            lastEventId: this.lastEventId,
            heartbeat
        });

        // 연결 성공 이벤트 전송
        this.sendToClient(clientId, {
            type: 'connection',
            message: 'SSE 연결이 성공적으로 설정되었습니다.',
            timestamp: new Date().toISOString()
        });

        logger.info('SSE 클라이언트 연결', { clientId, user: user.username, role: user.role });
    }

    // 클라이언트 연결 제거
    removeClient(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            if (client.heartbeat) {
                clearInterval(client.heartbeat);
            }
            if (!client.res.writableEnded) {
                client.res.end();
            }
            this.clients.delete(clientId);
            logger.info('SSE 클라이언트 연결 해제', { clientId });
        }
    }

    // 특정 클라이언트에게 이벤트 전송
    sendToClient(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client || client.res.writableEnded) {
            this.removeClient(clientId);
            return false;
        }

        try {
            this.lastEventId++;
            const eventData = `id: ${this.lastEventId}\ndata: ${JSON.stringify(data)}\n\n`;
            client.res.write(eventData);
            client.lastEventId = this.lastEventId;
            return true;
        } catch (error) {
            logger.error('SSE 이벤트 전송 실패', { clientId, error: error.message });
            this.removeClient(clientId);
            return false;
        }
    }

    // 새로운 입금 내역 알림 전송
    broadcastNewDeposit(deposit) {
        const eventData = {
            type: 'new_deposit',
            deposit: {
                id: deposit.id,
                date: deposit.date,
                bank: deposit.bank,
                amount: deposit.amount,
                sender: deposit.sender,
                company: deposit.company
            },
            timestamp: new Date().toISOString()
        };

        let sentCount = 0;
        const clientsToRemove = [];

        for (const [clientId, client] of this.clients) {
            // 권한 체크
            if (this.shouldNotifyUser(client.user, deposit)) {
                if (this.sendToClient(clientId, eventData)) {
                    sentCount++;
                } else {
                    clientsToRemove.push(clientId);
                }
            }
        }

        // 연결이 끊어진 클라이언트들 정리
        clientsToRemove.forEach(clientId => this.removeClient(clientId));

        logger.info('새 입금 내역 알림 전송', { 
            depositId: deposit.id, 
            sentCount, 
            totalClients: this.clients.size 
        });
    }

    // 1원 입금 알림 전송
    broadcastOneWonDeposit(deposit) {
        const eventData = {
            type: 'one_won_deposit',
            deposit: {
                id: deposit.id,
                date: deposit.date,
                bank: deposit.bank,
                amount: deposit.amount,
                sender: deposit.sender,
                company: deposit.company
            },
            timestamp: new Date().toISOString()
        };

        let sentCount = 0;
        const clientsToRemove = [];

        for (const [clientId, client] of this.clients) {
            // 권한 체크
            if (this.shouldNotifyUser(client.user, deposit)) {
                if (this.sendToClient(clientId, eventData)) {
                    sentCount++;
                } else {
                    clientsToRemove.push(clientId);
                }
            }
        }

        // 연결이 끊어진 클라이언트들 정리
        clientsToRemove.forEach(clientId => this.removeClient(clientId));

        logger.info('1원 입금 알림 전송', { 
            depositId: deposit.id, 
            sentCount, 
            totalClients: this.clients.size 
        });
    }

    // 새로운 출금 내역 알림 전송
    broadcastNewWithdrawal(withdrawal) {
        const eventData = {
            type: 'new_withdrawal',
            withdrawal: {
                id: withdrawal.id,
                date: withdrawal.date,
                bank: withdrawal.bank,
                amount: withdrawal.amount,
                sender: withdrawal.sender,
                company: withdrawal.company
            },
            timestamp: new Date().toISOString()
        };

        let sentCount = 0;
        const clientsToRemove = [];

        for (const [clientId, client] of this.clients) {
            // 권한 체크
            if (this.shouldNotifyUser(client.user, withdrawal)) {
                if (this.sendToClient(clientId, eventData)) {
                    sentCount++;
                } else {
                    clientsToRemove.push(clientId);
                }
            }
        }

        // 연결이 끊어진 클라이언트들 정리
        clientsToRemove.forEach(clientId => this.removeClient(clientId));

        logger.info('새 출금 내역 알림 전송', { 
            withdrawalId: withdrawal.id, 
            sentCount, 
            totalClients: this.clients.size 
        });
    }

    // 미확인 개수 업데이트 알림 전송
    broadcastUncheckedCountUpdate(company, count) {
        const eventData = {
            type: 'unchecked_count_update',
            company,
            count,
            timestamp: new Date().toISOString()
        };

        let sentCount = 0;
        const clientsToRemove = [];

        for (const [clientId, client] of this.clients) {
            // 권한 체크
            if (this.shouldNotifyUserForCompany(client.user, company)) {
                if (this.sendToClient(clientId, eventData)) {
                    sentCount++;
                } else {
                    clientsToRemove.push(clientId);
                }
            }
        }

        // 연결이 끊어진 클라이언트들 정리
        clientsToRemove.forEach(clientId => this.removeClient(clientId));

        logger.info('미확인 개수 업데이트 알림 전송', { 
            company, 
            count, 
            sentCount 
        });
    }

    // 사용자에게 알림을 보낼지 결정하는 권한 체크
    shouldNotifyUser(user, deposit) {
        // 관리자는 모든 입금 내역 알림
        if (user.role === 'admin' || user.role === 'super') {
            return true;
        }
        
        // 일반 사용자는 자신의 company와 일치하는 것만 알림
        if (user.role === 'user') {
            // company가 빈 문자열이거나 일치하는 경우 알림
            return !user.company || user.company === deposit.company;
        }
        
        return false;
    }

    // 사용자에게 특정 company의 알림을 보낼지 결정하는 권한 체크
    shouldNotifyUserForCompany(user, company) {
        // 관리자는 모든 company 알림
        if (user.role === 'admin' || user.role === 'super') {
            return true;
        }
        
        // 일반 사용자는 자신의 company와 일치하는 것만 알림
        if (user.role === 'user') {
            return user.company === company;
        }
        
        return false;
    }

    // 연결된 클라이언트 수 반환
    getClientCount() {
        return this.clients.size;
    }

    // 연결된 클라이언트 정보 반환 (디버깅용)
    getClientInfo() {
        const info = [];
        for (const [clientId, client] of this.clients) {
            info.push({
                clientId,
                username: client.user.username,
                role: client.user.role,
                company: client.user.company,
                lastEventId: client.lastEventId
            });
        }
        return info;
    }

    // 점검 모드 변경 알림 전송
    broadcastMaintenanceMode(isMaintenanceMode) {
        const eventData = {
            type: 'maintenance_mode_change',
            maintenance_mode: isMaintenanceMode,
            message: isMaintenanceMode ? '시스템 점검 모드가 활성화되었습니다.' : '시스템 점검 모드가 비활성화되었습니다.',
            timestamp: new Date().toISOString()
        };

        let sentCount = 0;
        const clientsToRemove = [];

        for (const [clientId, client] of this.clients) {
            if (this.sendToClient(clientId, eventData)) {
                sentCount++;
            } else {
                clientsToRemove.push(clientId);
            }
        }

        // 연결이 끊어진 클라이언트들 정리
        clientsToRemove.forEach(clientId => this.removeClient(clientId));

        logger.info('점검 모드 변경 알림 전송', { 
            maintenance_mode: isMaintenanceMode, 
            sentCount, 
            totalClients: this.clients.size 
        });
    }
}

// 싱글톤 인스턴스 생성
const sseService = new SSEService();

module.exports = sseService; 