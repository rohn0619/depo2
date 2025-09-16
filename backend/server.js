// 환경 변수 로드 (최상단에 위치해야 함)
require('dotenv').config();

// 환경 변수 로딩 확인
console.log('='.repeat(60));
console.log('🔧 환경 변수 로딩 확인');
console.log('='.repeat(60));
console.log(`NODE_ENV: ${process.env.NODE_ENV || '설정되지 않음'}`);
console.log(`PORT: ${process.env.PORT || '기본값 3001'}`);
console.log(`DB_HOST: ${process.env.DB_HOST || '설정되지 않음'}`);
console.log(`DB_USER: ${process.env.DB_USER || '설정되지 않음'}`);
console.log(`DB_NAME: ${process.env.DB_NAME || '설정되지 않음'}`);
console.log(`DB_PORT: ${process.env.DB_PORT || '기본값 3306'}`);
console.log(`JWT_SECRET: ${process.env.JWT_SECRET ? '설정됨' : '설정되지 않음'}`);
console.log('='.repeat(60));

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const dbConfig = require('./config/database');
const logger = require('./utils/logger');

const app = express();
const port = process.env.PORT || 5001;

// 미들웨어 - CORS 설정
app.use(cors({
    origin: function (origin, callback) {
        // 개발 환경에서는 모든 origin 허용
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        
        // 프로덕션 환경에서 허용할 도메인들
        const allowedOrigins = [
            'https://demo.homeretech.com',
            'http://demo.homeretech.com'
        ];
        
        // origin이 없거나 허용된 도메인인 경우
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            logger.warn('CORS 차단된 origin', { origin });
            callback(new Error('CORS 정책에 의해 차단되었습니다.'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// OPTIONS 요청 처리
app.options('*', cors());

// 라우트
const parseRoutes = require('./routes/parse');
const depositRoutes = require('./routes/deposits');
const settlementRoutes = require('./routes/settlement');
const sseRoutes = require('./routes/sse');
const { router: maintenanceRoutes } = require('./routes/maintenance');

app.use('/api/parse', parseRoutes);
app.use('/api/deposits', depositRoutes);
app.use('/api/settlement', settlementRoutes);
app.use('/api/sse', sseRoutes);
app.use('/api/maintenance', maintenanceRoutes);





// 로그인 API
app.post('/api/login', async (req, res) => {
    logger.apiRequest('POST', '/api/login', { username: req.body.username }, null);
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: '사용자명과 비밀번호를 입력하세요.' });
        }
        
        const conn = await mysql.createConnection(dbConfig);
        
        const [users] = await conn.query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );
        
        if (users.length === 0) {
            await conn.end();
            return res.status(401).json({ error: '잘못된 사용자명 또는 비밀번호입니다.' });
        }
        
        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            await conn.end();
            return res.status(401).json({ error: '잘못된 사용자명 또는 비밀번호입니다.' });
        }

        // 점검 모드 체크 (슈퍼 관리자가 아닌 경우)
        if (user.role !== 'super') {
            const [settings] = await conn.query(
                'SELECT setting_value FROM system_settings WHERE setting_key = ?',
                ['maintenance_mode']
            );
            
            const isMaintenanceMode = settings.length > 0 ? settings[0].setting_value === 'true' : false;
            
            if (isMaintenanceMode) {
                await conn.end();
                return res.status(503).json({ 
                    error: '점검 중입니다.',
                    maintenance_mode: true,
                    message: '시스템 점검 중입니다. 잠시 후 다시 시도해주세요.'
                });
            }
        }
        
        await conn.end();
        
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                role: user.role,
                company: user.company
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                company: user.company,
                fee: user.fee || 0
            }
        });
    } catch (e) {
        logger.auth('로그인', { username: req.body.username }, e);
        res.status(500).json({ error: '로그인 오류', message: e.message });
    }
});

// 사용자 목록 조회 API (admin role 체크)
app.get('/api/users', async (req, res) => {
    try {
        // admin role 체크 (쿼리 파라미터로 받음)
        const userRole = req.query.role;
        if (!userRole || !['super', 'admin'].includes(userRole)) {
            return res.status(403).json({ error: '접근 권한이 없습니다.' });
        }
        
        const conn = await mysql.createConnection(dbConfig);
        let query = 'SELECT id, username, company, company_name, fee, role, account, created_at FROM users';
        let params = [];
        
        // admin 역할은 super 관리자를 제외한 사용자만 조회
        if (userRole === 'admin') {
            query += ' WHERE role != "super"';
        }
        
        query += ' ORDER BY created_at DESC';
        const [users] = await conn.query(query, params);
        await conn.end();
        
        res.json(users);
    } catch (error) {
        logger.business('사용자 목록 조회', { userRole }, error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 사용자 생성 API (admin role 체크)
app.post('/api/users', async (req, res) => {
    try {
        const { username, password, role, company, company_name, fee, userRole, account } = req.body;
        
        if (!userRole || !['super', 'admin'].includes(userRole)) {
            return res.status(403).json({ error: '접근 권한이 없습니다.' });
        }
        
        // 필수 필드 검증
        if (!username || !password || !company || !role) {
            return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
        }
        
        // 비밀번호 길이 검증
        if (password.length < 6) {
            return res.status(400).json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' });
        }
        
        // 역할 검증 - admin은 user만 생성 가능, super는 admin, user 생성 가능
        if (userRole === 'admin' && !['user', 'settlement'].includes(role)) {
            return res.status(400).json({ error: '일반 관리자는 일반 사용자만 생성할 수 있습니다.' });
        }
        
        if (!['admin', 'user', 'settlement'].includes(role)) {
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
            'INSERT INTO users (username, password, role, company, company_name, fee, account) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [username, hashedPassword, role, company, company_name, fee, account || null]
        );
        
        await conn.end();
        
        res.json({ 
            success: true, 
            message: '사용자가 성공적으로 생성되었습니다.',
            user: {
                id: result.insertId,
                username,
                role,
                company
            }
        });
    } catch (error) {
        logger.business('사용자 생성', { username, role, company, userRole }, error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 사용자 정보 수정 API (admin role 체크)
app.put('/api/users/:id', async (req, res) => {
    try {
        // admin role 체크 (요청 바디로 받음)
        const { company, company_name, fee, newPassword, userRole, account } = req.body;
        const userId = req.params.id;
        
        if (!userRole || !['super', 'admin'].includes(userRole)) {
            return res.status(403).json({ error: '접근 권한이 없습니다.' });
        }
        
        if (!company) {
            return res.status(400).json({ error: '분류는 필수입니다.' });
        }
        
        // 수수료 검증 (0-100% 범위)
        if (fee !== undefined && (fee < 0 || fee > 100)) {
            return res.status(400).json({ error: '수수료는 0%에서 100% 사이의 값이어야 합니다.' });
        }
        
        if (newPassword && newPassword.length < 6) {
            return res.status(400).json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' });
        }
        
        const conn = await mysql.createConnection(dbConfig);
        
        // admin 역할은 super 관리자를 수정할 수 없음
        if (userRole === 'admin') {
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
        
        let query = 'UPDATE users SET company = ?';
        let params = [company];
        
        // 사용자명 업데이트
        if (company_name !== undefined) {
            query += ', company_name = ?';
            params.push(company_name);
        }
        
        // 수수료 업데이트
        if (fee !== undefined) {
            query += ', fee = ?';
            params.push(fee);
        }
        
        // 계좌정보 업데이트
        if (account !== undefined) {
            query += ', account = ?';
            params.push(account);
        }
        
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
        logger.business('사용자 정보 수정', { userId, company, userRole }, error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 사용자 삭제 API (super, admin만)
app.delete('/api/users/:id', async (req, res) => {
    try {
        // 현재 로그인한 사용자 권한 체크
        const { userRole } = req.query;
        if (!userRole || !['super', 'admin'].includes(userRole)) {
            return res.status(403).json({ error: '접근 권한이 없습니다.' });
        }
        
        const userId = req.params.id;
        const conn = await mysql.createConnection(dbConfig);
        
        // 삭제 대상 사용자 정보 조회
        const [users] = await conn.query('SELECT role, company FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            await conn.end();
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }
        
        const targetRole = users[0].role;
        const targetCompany = users[0].company;
        
        // admin은 user만 삭제 가능, super는 모두 삭제 가능
        if (userRole === 'admin' && !['user', 'settlement'].includes(targetRole)) {
            await conn.end();
            return res.status(403).json({ error: '관리자는 일반 사용자만 삭제할 수 있습니다.' });
        }
        
        // 트랜잭션 시작
        await conn.beginTransaction();
        
        try {
            // 1. 해당 사용자의 입출금 내역 삭제
            const [depositResult] = await conn.query(
                'DELETE FROM deposits WHERE company = ?',
                [targetCompany]
            );
            
            // 2. 사용자 삭제
            const [userResult] = await conn.query('DELETE FROM users WHERE id = ?', [userId]);
            
            if (userResult.affectedRows === 0) {
                await conn.rollback();
                await conn.end();
                return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
            }
            
            // 트랜잭션 커밋
            await conn.commit();
            await conn.end();
            
            logger.business('사용자 삭제', { 
                userId, 
                userRole, 
                targetRole, 
                targetCompany, 
                deletedDeposits: depositResult.affectedRows 
            });
            
            res.json({ 
                success: true, 
                message: '사용자와 관련 입출금 내역이 삭제되었습니다.',
                deletedDeposits: depositResult.affectedRows
            });
            
        } catch (error) {
            // 트랜잭션 롤백
            await conn.rollback();
            await conn.end();
            throw error;
        }
        
    } catch (error) {
        logger.business('사용자 삭제', { userId: req.params.id }, error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// Company 목록 조회 API (승인된 것만)
app.get('/api/companies', async (req, res) => {
    try {
        const conn = await mysql.createConnection(dbConfig);
        const [companies] = await conn.query(
            'SELECT id, name, is_approved, created_at FROM companies WHERE is_approved = 1 ORDER BY name ASC'
        );
        await conn.end();
        
        res.json(companies);
    } catch (error) {
        logger.business('Company 목록 조회', null, error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// Company 목록 조회 API (관리자용 - 모든 것)
app.get('/api/companies/admin', async (req, res) => {
    try {
        const userRole = req.query.role;
        if (!userRole || !['super', 'admin'].includes(userRole)) {
            return res.status(403).json({ error: '접근 권한이 없습니다.' });
        }
        
        const conn = await mysql.createConnection(dbConfig);
        const [companies] = await conn.query(
            'SELECT id, name, is_approved, created_at FROM companies ORDER BY created_at DESC'
        );
        await conn.end();
        
        res.json(companies);
    } catch (error) {
        logger.business('Company 관리자 목록 조회', { userRole }, error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// Company 생성 API (일반 사용자용)
app.post('/api/companies', async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ error: '분류명을 입력해주세요.' });
        }
        
        const conn = await mysql.createConnection(dbConfig);
        
        // 중복 검사
        const [existing] = await conn.query('SELECT id FROM companies WHERE name = ?', [name.trim()]);
        if (existing.length > 0) {
            await conn.end();
            return res.status(400).json({ error: '이미 존재하는 분류명입니다.' });
        }
        
        // Company 생성 (기본적으로 미승인 상태)
        const [result] = await conn.query(
            'INSERT INTO companies (name, is_approved) VALUES (?, 0)',
            [name.trim()]
        );
        
        await conn.end();
        
        res.json({ 
            success: true, 
            message: '분류명이 제출되었습니다. 슈퍼 관리자의 승인을 기다려주세요.',
            company: {
                id: result.insertId,
                name: name.trim(),
                is_approved: 0
            }
        });
    } catch (error) {
        logger.business('Company 생성', { name }, error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// Company 승인/거부 API (슈퍼 관리자용)
app.put('/api/companies/:id/approve', async (req, res) => {
    try {
        const { userRole, is_approved } = req.body;
        const companyId = req.params.id;
        
        if (!userRole || userRole !== 'super') {
            return res.status(403).json({ error: '슈퍼 관리자만 승인할 수 있습니다.' });
        }
        
        if (typeof is_approved !== 'boolean') {
            return res.status(400).json({ error: '승인 상태는 boolean 값이어야 합니다.' });
        }
        
        const conn = await mysql.createConnection(dbConfig);
        
        // Company 존재 여부 확인
        const [company] = await conn.query('SELECT id FROM companies WHERE id = ?', [companyId]);
        if (company.length === 0) {
            await conn.end();
            return res.status(404).json({ error: '분류를 찾을 수 없습니다.' });
        }
        
        // 승인 상태 업데이트
        await conn.query('UPDATE companies SET is_approved = ? WHERE id = ?', [is_approved, companyId]);
        await conn.end();
        
        res.json({ 
            success: true, 
            message: is_approved ? '분류가 승인되었습니다.' : '분류가 거부되었습니다.'
        });
    } catch (error) {
        logger.business('Company 승인', { companyId, is_approved, userRole }, error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// Company 삭제 API (슈퍼 관리자용)
app.delete('/api/companies/:id', async (req, res) => {
    try {
        const userRole = req.query.role;
        if (!userRole || userRole !== 'super') {
            return res.status(403).json({ error: '슈퍼 관리자만 삭제할 수 있습니다.' });
        }
        
        const companyId = req.params.id;
        
        const conn = await mysql.createConnection(dbConfig);
        
        // Company 존재 여부 확인 및 분류명 가져오기
        const [company] = await conn.query('SELECT id, name FROM companies WHERE id = ?', [companyId]);
        if (company.length === 0) {
            await conn.end();
            return res.status(404).json({ error: '분류를 찾을 수 없습니다.' });
        }
        
        const companyName = company[0].name;
        
        // 해당 분류값을 가진 입출금 내역 개수 확인
        const [depositsCount] = await conn.query(
            'SELECT COUNT(*) as count FROM deposits WHERE company = ?', 
            [companyName]
        );
        
        // 해당 분류값을 가진 사용자 개수 확인
        const [usersCount] = await conn.query(
            'SELECT COUNT(*) as count FROM users WHERE company = ?', 
            [companyName]
        );
        
        const depositsToDelete = depositsCount[0].count;
        const usersToDelete = usersCount[0].count;
        
        // 디버깅을 위한 로그
        console.log(`분류 삭제 디버깅: companyName=${companyName}, depositsToDelete=${depositsToDelete}, usersToDelete=${usersToDelete}`);
        
        // 트랜잭션 시작
        await conn.beginTransaction();
        
        try {
            let actualDeletedDeposits = 0;
            let actualDeletedUsers = 0;
            
            // 1. 해당 분류값을 가진 입출금 내역 삭제
            if (depositsToDelete > 0) {
                const [depositResult] = await conn.query('DELETE FROM deposits WHERE company = ?', [companyName]);
                actualDeletedDeposits = depositResult.affectedRows;
                console.log(`입출금 내역 삭제 결과: ${actualDeletedDeposits}건 삭제됨`);
            }
            
            // 2. 해당 분류값을 가진 사용자 삭제
            if (usersToDelete > 0) {
                const [userResult] = await conn.query('DELETE FROM users WHERE company = ?', [companyName]);
                actualDeletedUsers = userResult.affectedRows;
                console.log(`사용자 삭제 결과: ${actualDeletedUsers}명 삭제됨`);
            }
            
            // 3. Company 삭제
            await conn.query('DELETE FROM companies WHERE id = ?', [companyId]);
            
            // 트랜잭션 커밋
            await conn.commit();
            
            let message = '분류가 삭제되었습니다.';
            if (actualDeletedDeposits > 0 && actualDeletedUsers > 0) {
                message = `분류가 삭제되었습니다. (관련 입출금 내역 ${actualDeletedDeposits}건, 사용자 ${actualDeletedUsers}명도 함께 삭제됨)`;
            } else if (actualDeletedDeposits > 0) {
                message = `분류가 삭제되었습니다. (관련 입출금 내역 ${actualDeletedDeposits}건도 함께 삭제됨)`;
            } else if (actualDeletedUsers > 0) {
                message = `분류가 삭제되었습니다. (관련 사용자 ${actualDeletedUsers}명도 함께 삭제됨)`;
            }
            
            res.json({ 
                success: true, 
                message: message,
                deletedDeposits: actualDeletedDeposits,
                deletedUsers: actualDeletedUsers
            });
            
        } catch (transactionError) {
            // 트랜잭션 롤백
            await conn.rollback();
            throw transactionError;
        }
        
        await conn.end();
        
    } catch (error) {
        logger.business('Company 삭제', { companyId, userRole }, error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 헬스체크 API
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        message: '🏦 은행 입금 문자 파서 API가 정상 작동 중입니다.'
    });
});

// 서버 시작
app.listen(port, '0.0.0.0', async () => {
    // 현재 시스템 시간 로그 출력
    const now = new Date();
    const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9 (한국시간)
    
    // 데이터베이스 연결 테스트
    console.log('='.repeat(60));
    console.log('🔍 데이터베이스 연결 테스트 시작...');
    console.log('='.repeat(60));
    
    try {
        console.log('📊 데이터베이스 설정 정보:');
        console.log(`   호스트: ${dbConfig.host}`);
        console.log(`   사용자: ${dbConfig.user}`);
        console.log(`   데이터베이스: ${dbConfig.database}`);
        console.log(`   포트: ${dbConfig.port}`);
        console.log(`   타임존: ${dbConfig.timezone}`);
        
        console.log('\n🔌 데이터베이스 연결 시도 중...');
        const conn = await mysql.createConnection(dbConfig);
        console.log('✅ 데이터베이스 연결 성공!');
        
        // 간단한 쿼리 테스트
        console.log('\n📋 데이터베이스 쿼리 테스트...');
        const [result] = await conn.query('SELECT 1 as test');
        console.log('✅ 쿼리 테스트 성공:', result);
        
        await conn.end();
        console.log('✅ 데이터베이스 연결 종료');
        
    } catch (error) {
        console.error('❌ 데이터베이스 연결 실패:', error.message);
        console.error('   에러 코드:', error.code);
        console.error('   에러 번호:', error.errno);
        console.error('   SQL 상태:', error.sqlState);
        console.error('   전체 에러:', error);
    }
    
    console.log('='.repeat(60));
    
    logger.info('서버 시작', {
        port,
        environment: process.env.NODE_ENV || 'development',
        envFileLoaded: !!process.env.NODE_ENV,
        apiServer: 'https://demo-api.homeretech.com',
        adminPage: 'https://demo.homeretech.com',
        apiEndpoint: 'https://demo-api.homeretech.com/api/parse',
        healthCheck: 'https://demo-api.homeretech.com/api/health',
        systemTime: {
            utc: now.toISOString(),
            local: now.toString(),
            kst: kstTime.toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
    });
    
    console.log('='.repeat(60));
    console.log(`🏦 은행 입금 문자 파서 API 서버 시작`);
    console.log('='.repeat(60));
    console.log(`포트: ${port}`);
    console.log(`환경: ${process.env.NODE_ENV || 'development'}`);
    console.log(`환경 변수 파일: ${process.env.NODE_ENV ? '로드됨' : '로드되지 않음'}`);
    console.log(`CORS: 모든 origin 허용 (임시 설정)`);
    console.log(`API 서버: https://demo-api.homeretech.com`);
    console.log(`관리자 페이지: https://demo.homeretech.com`);
    console.log(`API 엔드포인트: https://demo-api.homeretech.com/api/parse`);
    console.log(`헬스체크: https://demo-api.homeretech.com/api/health`);
    console.log('='.repeat(60));
    console.log('📅 시스템 시간 정보:');
    console.log(`   UTC: ${now.toISOString()}`);
    console.log(`   로컬: ${now.toString()}`);
    console.log(`   KST: ${kstTime.toISOString()}`);
    console.log(`   타임존: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    console.log('='.repeat(60));
    console.log('콘솔에서 샘플 테스트를 실행하려면: node -e "require(\'./utils/stringParser.js\').runSampleTests()"');
});

module.exports = app; 