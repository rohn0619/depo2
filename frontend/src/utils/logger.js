// 프론트엔드 로거 유틸리티

// 로그 레벨 정의
const LOG_LEVELS = {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG'
};

// 현재 로그 레벨 (개발 환경에서는 DEBUG, 프로덕션에서는 ERROR만)
const CURRENT_LOG_LEVEL = process.env.NODE_ENV === 'production' ? 'ERROR' : 'INFO';

// 로그 레벨 우선순위
const LOG_LEVEL_PRIORITY = {
    ERROR: 4,
    WARN: 3,
    INFO: 2,
    DEBUG: 1
};

// 로그 포맷팅
const formatLog = (level, message, data = null, error = null) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        message,
        url: window.location.href,
        userAgent: navigator.userAgent,
        ...(data && { data }),
        ...(error && { 
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        })
    };
    
    return JSON.stringify(logEntry, null, 2);
};

// 로그 출력 함수
const log = (level, message, data = null, error = null) => {
    // 로그 레벨 체크
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[CURRENT_LOG_LEVEL]) {
        return;
    }
    
    const logContent = formatLog(level, message, data, error);
    
    // 콘솔 출력 (개발 환경에서는 모든 레벨, 프로덕션에서는 에러와 경고만)
    if (process.env.NODE_ENV !== 'production' || level === 'ERROR' || level === 'WARN') {
        if (level === 'ERROR') {
            console.error(`[${level}] ${message}`, error || data || '');
        } else if (level === 'WARN') {
            console.warn(`[${level}] ${message}`, data || '');
        } else {
            console.log(`[${level}] ${message}`, data || '');
        }
    }
    
    // 개발 환경에서는 로컬 스토리지에 저장 (최근 100개)
    if (process.env.NODE_ENV !== 'production') {
        try {
            const logs = JSON.parse(localStorage.getItem('app_logs') || '[]');
            logs.push(JSON.parse(logContent));
            
            // 최근 100개만 유지
            if (logs.length > 100) {
                logs.splice(0, logs.length - 100);
            }
            
            localStorage.setItem('app_logs', JSON.stringify(logs));
        } catch (err) {
            console.error('로그 저장 실패:', err);
        }
    }
};

// 로거 객체
const logger = {
    error: (message, data = null, error = null) => {
        log('ERROR', message, data, error);
    },
    
    warn: (message, data = null, error = null) => {
        log('WARN', message, data, error);
    },
    
    info: (message, data = null) => {
        log('INFO', message, data);
    },
    
    debug: (message, data = null) => {
        log('DEBUG', message, data);
    },
    
    // API 요청 로깅
    apiRequest: (method, url, params = null) => {
        log('INFO', 'API 요청', {
            method,
            url,
            params
        });
    },
    
    // API 응답 로깅
    apiResponse: (method, url, statusCode, responseTime = null) => {
        log('INFO', 'API 응답', {
            method,
            url,
            statusCode,
            responseTime
        });
    },
    
    // API 에러 로깅
    apiError: (method, url, error, response = null) => {
        log('ERROR', 'API 요청 실패', {
            method,
            url,
            response: response ? {
                status: response.status,
                statusText: response.statusText,
                data: response.data
            } : null
        }, error);
    },
    
    // 사용자 액션 로깅
    userAction: (action, details = null, error = null) => {
        if (error) {
            log('ERROR', `사용자 액션 오류: ${action}`, details, error);
        }
    },
    
    // 컴포넌트 에러 로깅
    componentError: (componentName, error, props = null) => {
        log('ERROR', `컴포넌트 오류: ${componentName}`, { props }, error);
    },
    
    // 폴링 에러 로깅
    pollingError: (action, error) => {
        log('ERROR', `폴링 오류: ${action}`, null, error);
    },
    
    // 로그 조회 (개발용)
    getLogs: () => {
        if (process.env.NODE_ENV !== 'production') {
            try {
                return JSON.parse(localStorage.getItem('app_logs') || '[]');
            } catch (err) {
                return [];
            }
        }
        return [];
    },
    
    // 로그 초기화 (개발용)
    clearLogs: () => {
        if (process.env.NODE_ENV !== 'production') {
            localStorage.removeItem('app_logs');
        }
    }
};

export default logger; 