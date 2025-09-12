const fs = require('fs');
const path = require('path');

// 로그 레벨 정의
const LOG_LEVELS = {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG'
};

// 현재 로그 레벨 (환경변수로 설정 가능)
const CURRENT_LOG_LEVEL = process.env.LOG_LEVEL || 'ERROR';

// 로그 레벨 우선순위
const LOG_LEVEL_PRIORITY = {
    ERROR: 4,
    WARN: 3,
    INFO: 2,
    DEBUG: 1
};

// 로그 디렉토리 생성
const LOG_DIR = path.join(__dirname, '../logs');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 로그 파일 경로
const getLogFilePath = (level) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;
    return path.join(LOG_DIR, `${level.toLowerCase()}-${today}.log`);
};

// 로그 포맷팅
const formatLog = (level, message, data = null, error = null) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        message,
        ...(data && { data }),
        ...(error && { 
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
                ...(error.code && { code: error.code }),
                ...(error.sqlMessage && { sqlMessage: error.sqlMessage }),
                ...(error.sqlState && { sqlState: error.sqlState })
            }
        })
    };
    
    return JSON.stringify(logEntry, null, 2);
};

// 로그 파일에 쓰기
const writeToFile = (level, content) => {
    try {
        const logFile = getLogFilePath(level);
        fs.appendFileSync(logFile, content + '\n', 'utf8');
    } catch (err) {
        console.error('로그 파일 쓰기 실패:', err);
    }
};

// 로그 출력 함수
const log = (level, message, data = null, error = null) => {
    // 로그 레벨 체크
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[CURRENT_LOG_LEVEL]) {
        return;
    }
    
    const logContent = formatLog(level, message, data, error);
    
    // 콘솔 출력 (에러와 경고만)
    if (level === 'ERROR' || level === 'WARN') {
        console.error(`[${level}] ${message}`, error || data || '');
    }
    
    // 파일에 저장
    writeToFile(level, logContent);
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
    apiRequest: (method, url, params = null, user = null) => {
        log('INFO', 'API 요청', {
            method,
            url,
            params,
            user: user ? { id: user.id, username: user.username, role: user.role } : null
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
    
    // 데이터베이스 쿼리 로깅 (에러 시에만)
    dbQuery: (query, params = null, error = null) => {
        if (error) {
            log('ERROR', '데이터베이스 쿼리 오류', {
                query,
                params
            }, error);
        }
    },
    
    // 비즈니스 로직 로깅
    business: (action, details = null, error = null) => {
        if (error) {
            log('ERROR', `비즈니스 로직 오류: ${action}`, details, error);
        }
    },
    
    // 인증/권한 로깅
    auth: (action, user = null, error = null) => {
        if (error) {
            log('ERROR', `인증/권한 오류: ${action}`, {
                user: user ? { id: user.id, username: user.username, role: user.role } : null
            }, error);
        }
    }
};

module.exports = logger; 