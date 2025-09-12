require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3001;

// 미들웨어 설정
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

function requireEnv(name) {
    if (!process.env[name]) {
        throw new Error(`환경변수 ${name}가 설정되어 있지 않습니다. .env 파일을 확인하세요.`);
    }
    return process.env[name];
}

/**
 * 문자열 데이터를 받아서 dictionary(객체)로 변환하는 함수
 * @param {string} inputString 변환할 문자열 데이터
 * @returns {object} 변환된 객체
 */
function stringToDictionary(inputString) {
    // 입력값 검증
    if (!inputString || inputString.trim() === '') {
        return {};
    }
    
    // 은행 거래 내역 형태인지 확인
    if (inputString.includes('입금')) {
        return parseBankTransaction(inputString);
    }
    
    // 기본 문자열 처리 (기존 로직)
    const words = inputString.trim().split(' ');
    
    const dictionary = {};
    words.forEach(word => {
        const cleanWord = word.toLowerCase().replace(/[^a-zA-Z0-9가-힣]/g, '');
        
        if (cleanWord.length > 0) {
            dictionary[cleanWord] = cleanWord.length;
        }
    });
    
    return dictionary;
}

/**
 * 은행 거래 내역을 파싱하는 함수
 * @param {string} transactionString 은행 거래 내역 문자열
 * @returns {object} 파싱된 거래 정보 (은행, 날짜시간, 입금액, 입금자명, 분류)
 */
function parseBankTransaction(transactionString) {
    const result = {
        bank: null,
        datetime: null,
        amount: null,
        sender_name: null,
        company: null
    };

    // 은행명 리스트 (확장)
    const bankNames = [
        '농협', 'NH', '신협', '우리', '기업', 'IBK', '신한', '신한은행', '국민', '국민은행', 
        'KB', '새마을', '토스', '카카오', '케이', '케이뱅크', '카카오뱅크', '토스뱅크'
    ];
    
    // Company명 리스트 (기준 + 샘플에서 발견된 것들)
    const companyNames = [
        'mori114', 'an-coinup00011', 'an-coinup00022', 'an-coinup00033', 
        'inc-nara00010', 'inc-nara00020', 'inc-nara00030',
        'an-coinup-11', 'coinpos365', 'upcoin4989', 'coin1147', 'abscoin365'
    ];
    
    // 은행명 추출 (리스트 기반)
    for (const bank of bankNames) {
        if (new RegExp(bank, 'i').test(transactionString)) {
            result.bank = bank;
            break;
        }
    }
    
    // Company명 추출 (리스트 기반)
    for (const company of companyNames) {
        if (new RegExp(company, 'i').test(transactionString)) {
            result.company = company;
            break;
        }
    }
    
    // 기존 패턴도 보조로 남겨둠
    if (!result.bank) {
        const bankPatterns = [
            /^([\w가-힣]+)\s*입금/,
            /\[([\w가-힣]+)\]/,
            /^([\w가-힣]+)\d{2}\/\d{2}/,
            /신협\d+\*+/
        ];
        
        for (const pattern of bankPatterns) {
            const match = transactionString.match(pattern);
            if (match) {
                result.bank = match[1].replace(/[\[\]]/g, '') || '신협';
                break;
            }
        }
        
        if (!result.bank && /신협/.test(transactionString)) {
            result.bank = '신협';
        }
    }

    // 날짜와 시간 추출 (확장된 형식 지원)
    const dateTimePatterns = [
        /(\d{4}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})/,  // 2025/07/04 17:15:32
        /(\d{2}\/\d{2})[ \[]*(\d{2}:\d{2})/,             // 07/04 15:18
        /(\d{2}\/\d{2})[ \[]*/                            // 07/04
    ];
    
    for (const pattern of dateTimePatterns) {
        const match = transactionString.match(pattern);
        if (match) {
            if (match[2]) {
                result.datetime = `${match[1]} ${match[2]}`;
            } else {
                result.datetime = match[1];
            }
            break;
        }
    }

    // 입금액 추출 (확장된 형식 지원)
    const amountPatterns = [
        /입금\s*([0-9,]+)원/,       // 입금10,000원, 입금 1000000원
        /입금\s+([0-9,]+)/,         // 입금     100,000
        /입금\s*\n([0-9,]+)/,       // 입금\n600,000
        /입금\s+([0-9,]+)원/        // 입금 300,000원
    ];
    
    for (const pattern of amountPatterns) {
        const match = transactionString.match(pattern);
        if (match) {
            result.amount = match[1].replace(/,/g, '');
            break;
        }
    }

    // 입금자명 추출 (확장된 형식 지원)
    const namePatterns = [
        /\d{3}-\*{4}-\d{4}-\d{2}\s+([가-힣]+)/,     // 352-****-4273-63 신동수
        /\n\s*([가-힣]+)\s*$/m,                       //  박현옥, 김양곤(줄 끝)
        /입금\s+[0-9,]+원\s+([가-힣]+)/,             // 입금 300,000원 김규성
        /\n([가-힣]+)\n입금/,                        // ...\n김양곤\n입금
        /\n([가-힣]+)\n\d+$/,                        // 윤선중\n136001053762
        /\n([가-힣]+)\n\d+\n/                        // 지현주\n100157160105\n
    ];
    
    for (const pattern of namePatterns) {
        const match = transactionString.match(pattern);
        if (match) {
            result.sender_name = match[1].trim();
            break;
        }
    }
    
    return result;
}

// 샘플 테스트 함수
function runSampleTests() {
    console.log('🏦 은행 입금 문자 파서 샘플 테스트\n');
    
    const samples = [
        "보낸사람 : 15882100\n농협 입금10,000원\n07/04 15:18 352-****-4273-63 신동수 잔액3,710,000원",
        "보낸사람 : 15778000()\n[Web발신]\n신한07/04 15:28\n110-496-922482\n입금     100,000\n잔액    870,045\n 박현옥",
        "보낸사람 : 16449999\n[KB]07/04 15:24\n942902**347\n김양곤\n입금\n600,000\n잔액1,320,000",
        "보낸사람 : 15666000\n신협132*****2222 07/04 16:15 입금 300,000원 김규성 잔액312,533원",
        "2025/07/04 17:15:32\n입금 1000000원\nan-coinup-11\n윤선중\n136001053762\n신협\n20250704",
        "[Web발신]\n2025/06/30 00:56:46\n입금 50000원\ncoinpos365\n지현주\n100157160105\n케이뱅크\n20250629",
        "[Web발신]\n2025/06/28 17:38:26\n입금 1500000원\nupcoin4989\n김영길\n39901001425\n신한은행\n20250628",
        "[Web발신]\n2025/06/21 15:23:06\n입금 200000원\ncoin1147\n박석호\n64710101500701\n국민은행\n20250621",
        "[Web발신]\n2025/06/20 19:49:28\n입금 100000원\nabscoin365\n한병주\n3021453469401\n농협\n20250620"
    ];

    samples.forEach((sample, index) => {
        console.log(`===== 샘플 ${index + 1} =====`);
        console.log('입력 문자열:');
        console.log(sample);
        console.log('\n[결과]');
        const result = stringToDictionary(sample);
        console.log(result);
        console.log(JSON.stringify(result, null, 2));
        console.log('\n');
    });
}

// JWT 토큰 검증 미들웨어
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: '액세스 토큰이 필요합니다.' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
        }
        req.user = user;
        next();
    });
};

// 로그인 API
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
        }
        
        const conn = await mysql.createConnection(dbConfig);
        const [users] = await conn.query('SELECT * FROM users WHERE username = ?', [username]);
        await conn.end();
        
        if (users.length === 0) {
            return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        }
        
        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        }
        
        const token = jwt.sign(
            { id: user.id, username: user.username, name: user.name, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('로그인 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 로그인 상태 확인 API
app.get('/api/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

// 사용자 목록 조회 API (super, admin 관리자만)
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        if (!['super', 'admin'].includes(req.user.role)) {
            return res.status(403).json({ error: '접근 권한이 없습니다.' });
        }
        
        const conn = await mysql.createConnection(dbConfig);
        let query = 'SELECT id, username, name, role, created_at FROM users';
        let params = [];
        
        // admin 역할은 super 관리자를 제외한 사용자만 조회
        if (req.user.role === 'admin') {
            query += ' WHERE role != "super"';
        }
        
        query += ' ORDER BY created_at DESC';
        const [users] = await conn.query(query, params);
        await conn.end();
        
        res.json(users);
    } catch (error) {
        console.error('사용자 목록 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 사용자 생성 API (super, admin 관리자만)
app.post('/api/users', authenticateToken, async (req, res) => {
    try {
        if (!['super', 'admin'].includes(req.user.role)) {
            return res.status(403).json({ error: '접근 권한이 없습니다.' });
        }
        
        const { username, password, name, role } = req.body;
        
        // 필수 필드 검증
        if (!username || !password || !name || !role) {
            return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
        }
        
        // 비밀번호 길이 검증
        if (password.length < 6) {
            return res.status(400).json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' });
        }
        
        // 역할 검증 - admin은 user만 생성 가능, super는 admin, user 생성 가능
        if (req.user.role === 'admin' && role !== 'user') {
            return res.status(400).json({ error: '일반 관리자는 일반 사용자만 생성할 수 있습니다.' });
        }
        
        if (!['admin', 'user'].includes(role)) {
            return res.status(400).json({ error: '유효하지 않은 역할입니다.' });
        }
        
        // 아이디 중복 검사
        const conn = await mysql.createConnection(dbConfig);
        const [existingUsers] = await conn.query('SELECT id FROM users WHERE username = ?', [username]);
        
        if (existingUsers.length > 0) {
            await conn.end();
            return res.status(400).json({ error: '이미 존재하는 아이디입니다.' });
        }
        
        // 사용자 생성
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await conn.query(
            'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, name, role]
        );
        
        await conn.end();
        
        res.json({ 
            success: true, 
            message: '사용자가 성공적으로 생성되었습니다.',
            user: {
                id: result.insertId,
                username,
                name,
                role
            }
        });
    } catch (error) {
        console.error('사용자 생성 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 사용자 정보 수정 API (super, admin 관리자만)
app.put('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        if (!['super', 'admin'].includes(req.user.role)) {
            return res.status(403).json({ error: '접근 권한이 없습니다.' });
        }
        
        const { name, newPassword } = req.body;
        const userId = req.params.id;
        
        if (!name) {
            return res.status(400).json({ error: '이름은 필수입니다.' });
        }
        
        if (newPassword && newPassword.length < 6) {
            return res.status(400).json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' });
        }
        
        const conn = await mysql.createConnection(dbConfig);
        
        // admin 역할은 super 관리자를 수정할 수 없음
        if (req.user.role === 'admin') {
            const [user] = await conn.query('SELECT role FROM users WHERE id = ?', [userId]);
            if (user.length === 0) {
                await conn.end();
                return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
            }
            if (user[0].role === 'super') {
                await conn.end();
                return res.status(403).json({ error: '슈퍼 관리자는 수정할 수 없습니다.' });
            }
        }
        
        let query = 'UPDATE users SET name = ?';
        let params = [name];
        
        // 비밀번호도 함께 업데이트
        if (newPassword) {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            query += ', password = ?';
            params.push(hashedPassword);
        }
        
        query += ' WHERE id = ?';
        params.push(userId);
        
        const [result] = await conn.query(query, params);
        await conn.end();
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }
        
        res.json({ success: true, message: '사용자 정보가 성공적으로 수정되었습니다.' });
    } catch (error) {
        console.error('사용자 정보 수정 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// API 라우트
app.post('/api/parse', (req, res) => {
    try {
        const inputString = req.body.input_string || req.body.text || '';
        
        if (!inputString.trim()) {
            return res.status(400).json({ 
                error: '입력 문자열이 필요합니다.',
                message: 'input_string 또는 text 필드를 포함해주세요.'
            });
        }
        
        const result = stringToDictionary(inputString);
        res.json(result);
    } catch (error) {
        console.error('파싱 오류:', error);
        res.status(500).json({ 
            error: '서버 오류가 발생했습니다.',
            message: error.message 
        });
    }
});

// 헬스체크 엔드포인트
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: '은행 입금 문자 파서 API가 정상 작동 중입니다.',
        timestamp: new Date().toISOString()
    });
});

// MySQL 연결 설정
const dbConfig = {
    host: requireEnv('MYSQL_HOST'),
    port: requireEnv('MYSQL_PORT'),
    user: requireEnv('MYSQL_USER'),
    password: requireEnv('MYSQL_PASSWORD'),
    database: requireEnv('MYSQL_DATABASE'),
    multipleStatements: true
};

// 입금내역 테이블 생성 함수
async function ensureDepositsTable() {
    const conn = await mysql.createConnection(dbConfig);
    
    // 입금내역 테이블 생성
    await conn.query(`
        CREATE TABLE IF NOT EXISTS deposits (
            id INT AUTO_INCREMENT PRIMARY KEY,
            date DATETIME NOT NULL,
            bank VARCHAR(32) NOT NULL,
            amount INT NOT NULL,
            sender VARCHAR(32) NOT NULL,
            company VARCHAR(64) NOT NULL,
            sms_raw TEXT NOT NULL,
            is_checked BOOLEAN DEFAULT FALSE
        )
    `);
    
    await conn.end();
}

// 입금내역 API (MySQL) - 인증 필요
app.get('/api/deposits', authenticateToken, async (req, res) => {
    try {
        await ensureDepositsTable();
        const conn = await mysql.createConnection(dbConfig);
        
        let query = 'SELECT * FROM deposits';
        let params = [];
        
        // 일반 사용자는 자신의 분류와 일치하는 입금내역만 조회
        if (req.user.role === 'user') {
            query += ' WHERE company = ?';
            params.push(req.user.name);
        }
        
        query += ' ORDER BY id DESC';
        const [rows] = await conn.query(query, params);
        await conn.end();
        
        // 프론트 호환을 위해 sender -> sender로, date는 YYYY-MM-DD HH:mm 형태로
        const result = rows.map(row => ({
            id: row.id,
            date: row.date ? row.date.toISOString().replace('T', ' ').slice(0, 16) : null,
            bank: row.bank,
            amount: row.amount,
            sender: row.sender,
            company: row.company,
            sms_raw: row.sms_raw,
            is_checked: row.is_checked,
            created_at: row.created_at ? row.created_at.toISOString().replace('T', ' ').slice(0, 19) : null
        }));
        res.json(result);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 문자 파싱 후 DB 저장 API - 인증 필요
app.post('/api/deposits', authenticateToken, async (req, res) => {
    try {
        const sms = req.body.sms;
        if (!sms || typeof sms !== 'string' || !sms.trim()) {
            console.error('[입력 에러] sms 필드 누락 또는 빈 값:', req.body);
            return res.status(400).json({ error: 'sms 필드에 문자열을 입력하세요.' });
        }
        const parsed = stringToDictionary(sms);
        let date = null, bank = null, amount = null, sender = null, company = null;
        let parseSuccess = false;
        if (parsed.bank && parsed.datetime && parsed.amount && parsed.sender_name) {
            // 날짜 변환 (YYYY-MM-DD HH:mm:ss)
            date = parsed.datetime.replace(/\//g, '-').trim();
            if (/^\d{2}-\d{2} \d{2}:\d{2}$/.test(date)) {
                const now = new Date();
                date = `${now.getFullYear()}-${date}:00`;
            }
            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(date)) {
                date += ':00';
            }
            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date)) {
                bank = parsed.bank;
                amount = parsed.amount;
                sender = parsed.sender_name;
                company = parsed.company || '';
                parseSuccess = true;
            } else {
                console.error('[날짜 변환 실패]', { 원본: parsed.datetime, 변환값: date });
            }
        } else {
            console.error('[파싱 실패]', { sms, parsed });
        }
        const conn = await mysql.createConnection(dbConfig);
        const [result] = await conn.query(
            'INSERT INTO deposits (date, bank, amount, sender, company, sms_raw) VALUES (?, ?, ?, ?, ?, ?)',
            [date, bank, amount, sender, company, sms]
        );
        await conn.end();
        res.json({ success: parseSuccess, id: result.insertId, parseSuccess });
    } catch (e) {
        console.error('[DB 오류]', {
            error: e,
            body: req.body
        });
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 미확인 입금내역 개수 조회 API - 인증 필요
app.get('/api/deposits/unchecked-count', authenticateToken, async (req, res) => {
    try {
        await ensureDepositsTable();
        const conn = await mysql.createConnection(dbConfig);
        
        let query = 'SELECT COUNT(*) as count FROM deposits WHERE is_checked = FALSE';
        let params = [];
        
        // 일반 사용자는 자신의 분류와 일치하는 입금내역만 조회
        if (req.user.role === 'user') {
            query += ' AND company = ?';
            params.push(req.user.name);
        }
        
        const [rows] = await conn.query(query, params);
        await conn.end();
        
        res.json({ count: rows[0].count });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 정산 대시보드 기본 통계 API - 인증 필요
app.get('/api/settlement/basic-stats', authenticateToken, async (req, res) => {
    try {
        const { period = 'today', company } = req.query;
        await ensureDepositsTable();
        const conn = await mysql.createConnection(dbConfig);
        
        let whereClause = '1=1';
        let params = [];
        
        // 일반 사용자는 자신의 분류만 조회
        if (req.user.role === 'user') {
            whereClause += ' AND company = ?';
            params.push(req.user.name);
        } else if (company && req.user.role !== 'user') {
            // 관리자는 특정 분류 필터링 가능
            whereClause += ' AND company = ?';
            params.push(company);
        }
        
        // 기간별 필터링
        let dateFilter = '';
        switch (period) {
            case 'today':
                dateFilter = 'AND DATE(date) = CURDATE()';
                break;
            case 'week':
                dateFilter = 'AND date >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
                break;
            case 'month':
                dateFilter = 'AND date >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
                break;
            default:
                dateFilter = 'AND DATE(date) = CURDATE()';
        }
        
        const query = `
            SELECT 
                COUNT(*) as count,
                SUM(amount) as total_amount
            FROM deposits 
            WHERE ${whereClause} ${dateFilter}
        `;
        
        const [rows] = await conn.query(query, params);
        await conn.end();
        
        res.json({
            count: rows[0].count || 0,
            total_amount: rows[0].total_amount || 0
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 정산 대시보드 기간별 분석 API - 인증 필요
app.get('/api/settlement/period-analysis', authenticateToken, async (req, res) => {
    try {
        const { period = 'daily', days = 7, company } = req.query;
        console.log('Period Analysis Request:', { period, days, company });
        await ensureDepositsTable();
        const conn = await mysql.createConnection(dbConfig);
        
        let whereClause = '1=1';
        let params = [];
        
        // 일반 사용자는 자신의 분류만 조회
        if (req.user.role === 'user') {
            whereClause += ' AND company = ?';
            params.push(req.user.name);
        } else if (company && req.user.role !== 'user') {
            // 관리자는 특정 분류 필터링 가능
            whereClause += ' AND company = ?';
            params.push(company);
        }
        
        let groupBy = '';
        let dateFormat = '';
        let orderBy = '';
        
        switch (period) {
            case 'daily':
                groupBy = 'DATE_FORMAT(date, "%Y-%m-%d")';
                dateFormat = '%Y-%m-%d';
                orderBy = 'DATE_FORMAT(date, "%Y-%m-%d")';
                break;
            case 'weekly':
                groupBy = 'DATE_FORMAT(date, "%Y-%u")';
                dateFormat = '%Y-%u';
                orderBy = 'DATE_FORMAT(date, "%Y-%u")';
                break;
            case 'monthly':
                groupBy = 'DATE_FORMAT(date, "%Y-%m")';
                dateFormat = '%Y-%m';
                orderBy = 'DATE_FORMAT(date, "%Y-%m")';
                break;
            default:
                groupBy = 'DATE_FORMAT(date, "%Y-%m-%d")';
                dateFormat = '%Y-%m-%d';
                orderBy = 'DATE_FORMAT(date, "%Y-%m-%d")';
        }
        
        let dateCondition = '';
        if (period === 'monthly') {
            // 월별은 올해년도만
            const currentYear = new Date().getFullYear();
            dateCondition = `AND date >= '${currentYear}-01-01' AND date < '${currentYear + 1}-01-01'`;
            console.log('Monthly date condition:', dateCondition);
            
            // 현재 연도에 데이터가 있는지 확인
            const yearCheckQuery = `SELECT COUNT(*) as count FROM deposits WHERE date >= '${currentYear}-01-01' AND date < '${currentYear + 1}-01-01'`;
            const [yearCheck] = await conn.query(yearCheckQuery);
            console.log(`Data count for ${currentYear}:`, yearCheck[0].count);
            
            // 현재 연도에 데이터가 없으면 빈 결과 반환
            if (yearCheck[0].count === 0) {
                console.log(`No data for ${currentYear}, returning empty result`);
                await conn.end();
                return res.json([]);
            }
        } else {
            // 일별, 주별은 지정된 일수만큼
            dateCondition = `AND date >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
        }
        
        const query = `
            SELECT 
                DATE_FORMAT(date, ?) as period,
                COUNT(*) as count,
                SUM(amount) as total_amount
            FROM deposits 
            WHERE ${whereClause} ${dateCondition}
            GROUP BY ${groupBy}
            ORDER BY ${orderBy} ASC
        `;
        
        // 파라미터 순서: dateFormat, company (이미 추가됨), days (월별이 아닌 경우)
        const finalParams = [dateFormat, ...params];
        if (period !== 'monthly') {
            finalParams.push(parseInt(days));
        }
        console.log('Query:', query);
        console.log('Params:', finalParams);
        const [rows] = await conn.query(query, finalParams);
        await conn.end();
        
        console.log(`Period: ${period}, Days: ${days}, Result count: ${rows.length}`);
        if (period === 'monthly') {
            console.log('Monthly results:', rows);
        }
        
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 정산 대시보드 입금자 분석 API - 인증 필요
app.get('/api/settlement/sender-analysis', authenticateToken, async (req, res) => {
    try {
        const { company, month } = req.query;
        await ensureDepositsTable();
        const conn = await mysql.createConnection(dbConfig);
        
        let whereClause = '1=1';
        let params = [];
        
        // 일반 사용자는 자신의 분류만 조회
        if (req.user.role === 'user') {
            whereClause += ' AND company = ?';
            params.push(req.user.name);
        } else if (company && req.user.role !== 'user') {
            // 관리자는 특정 분류 필터링 가능
            whereClause += ' AND company = ?';
            params.push(company);
        }
        
        // 월별 필터링 (올해년도 기준)
        if (month) {
            const currentYear = new Date().getFullYear();
            whereClause += ' AND DATE_FORMAT(date, "%Y-%m") = ?';
            params.push(`${currentYear}-${month.padStart(2, '0')}`);
        } else {
            // 월이 지정되지 않으면 올해년도 전체
            const currentYear = new Date().getFullYear();
            whereClause += ' AND date >= ? AND date < ?';
            params.push(`${currentYear}-01-01`, `${currentYear + 1}-01-01`);
        }
        
        // 상위 입금자 조회
        const topSendersQuery = `
            SELECT 
                sender,
                ${req.user.role !== 'user' ? 'company,' : ''}
                COUNT(*) as count,
                SUM(amount) as total_amount,
                AVG(amount) as avg_amount
            FROM deposits 
            WHERE ${whereClause}
            GROUP BY sender${req.user.role !== 'user' ? ', company' : ''}
            ORDER BY total_amount DESC
            LIMIT 10
        `;
        
        const [rows] = await conn.query(topSendersQuery, params);
        await conn.end();
        
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 정산 대시보드 분류별 분석 API - 관리자 전용
app.get('/api/settlement/company-analysis', authenticateToken, async (req, res) => {
    try {
        if (req.user.role === 'user') {
            return res.status(403).json({ error: '접근 권한이 없습니다.' });
        }
        
        const { company } = req.query;
        await ensureDepositsTable();
        const conn = await mysql.createConnection(dbConfig);
        
        let whereClause = '1=1';
        let params = [];
        
        // 올해년도 기준으로 필터링
        const currentYear = new Date().getFullYear();
        whereClause += ' AND date >= ? AND date < ?';
        params.push(`${currentYear}-01-01`, `${currentYear + 1}-01-01`);
        
        // 특정 분류 필터링 (선택사항)
        if (company) {
            whereClause += ' AND company = ?';
            params.push(company);
        }
        
        const query = `
            SELECT 
                company,
                COUNT(*) as count,
                SUM(amount) as total_amount,
                AVG(amount) as avg_amount
            FROM deposits 
            WHERE ${whereClause}
            GROUP BY company
            ORDER BY total_amount DESC
        `;
        
        console.log('Company analysis query:', query);
        console.log('Company analysis params:', params);
        
        const [rows] = await conn.query(query, params);
        await conn.end();
        
        console.log('Company analysis result:', rows);
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 정산 대시보드 모든 분류 목록 API - 관리자 전용
app.get('/api/settlement/all-companies', authenticateToken, async (req, res) => {
    try {
        if (req.user.role === 'user') {
            return res.status(403).json({ error: '접근 권한이 없습니다.' });
        }
        
        await ensureDepositsTable();
        const conn = await mysql.createConnection(dbConfig);
        
        // 올해년도 기준으로 필터링하되, 모든 분류를 반환
        const currentYear = new Date().getFullYear();
        
        const query = `
            SELECT DISTINCT company
            FROM deposits 
            WHERE date >= ? AND date < ? AND company IS NOT NULL AND company != ''
            ORDER BY company ASC
        `;
        
        const [rows] = await conn.query(query, [`${currentYear}-01-01`, `${currentYear + 1}-01-01`]);
        await conn.end();
        
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 입금내역 확인 상태 변경 API - 인증 필요
app.put('/api/deposits/:id/check', authenticateToken, async (req, res) => {
    try {
        const { is_checked } = req.body;
        const depositId = req.params.id;
        
        if (typeof is_checked !== 'boolean') {
            return res.status(400).json({ error: 'is_checked는 boolean 값이어야 합니다.' });
        }
        
        const conn = await mysql.createConnection(dbConfig);
        
        // 일반 사용자는 자신의 분류와 일치하는 입금내역만 수정 가능
        if (req.user.role === 'user') {
            const [deposit] = await conn.query('SELECT company FROM deposits WHERE id = ?', [depositId]);
            if (deposit.length === 0) {
                await conn.end();
                return res.status(404).json({ error: '입금내역을 찾을 수 없습니다.' });
            }
            if (deposit[0].company !== req.user.name) {
                await conn.end();
                return res.status(403).json({ error: '해당 입금내역을 수정할 권한이 없습니다.' });
            }
        }
        
        const [result] = await conn.query(
            'UPDATE deposits SET is_checked = ? WHERE id = ?',
            [is_checked, depositId]
        );
        await conn.end();
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: '입금내역을 찾을 수 없습니다.' });
        }
        
        res.json({ success: true, message: '확인 상태가 업데이트되었습니다.' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'DB 오류', message: e.message });
    }
});

// 서버 시작
app.listen(port, () => {
    console.log(`🏦 은행 입금 문자 파서 API가 http://localhost:${port} 에서 실행 중입니다.`);
    console.log(`API 엔드포인트: http://localhost:${port}/api/parse`);
    console.log(`헬스체크: http://localhost:${port}/api/health`);
    console.log('콘솔에서 샘플 테스트를 실행하려면: node -e "require(\'./string_to_dict.js\').runSampleTests()"');
});

// 모듈 내보내기 (테스트용)
module.exports = {
    stringToDictionary,
    parseBankTransaction,
    runSampleTests
}; 