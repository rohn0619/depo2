const mysql = require('mysql2/promise');
const dbConfig = require('../config/database');
const logger = require('../utils/logger');

// 서버 시간 기준 날짜 계산 헬퍼 함수들 (로컬 시간 사용)
function getServerDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; // YYYY-MM-DD
}

function getServerDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`; // YYYY-MM-DD HH:mm:ss
}

function getServerDateSubtract(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; // YYYY-MM-DD
}

async function getBasicStats(user, period, company = null, settlementFee = null) {
    const conn = await mysql.createConnection(dbConfig);
    
    let whereClause = '1=1';
    let params = [];
    
    // 일반 사용자는 자신의 분류만 조회
    if (user.role === 'user') {
        whereClause += ' AND d.company = ?';
        params.push(user.company);
    } else if (company) {
        // 관리자나 정산 사용자는 특정 분류 필터링 가능
        whereClause += ' AND d.company = ?';
        params.push(company);
    }
    
    // 기간별 필터링 (서버 시간 기준)
    let dateFilter = '';
    switch (period) {
        case 'yesterday':
            dateFilter = `AND LEFT(date, 10) = ?`;
            params.push(getServerDateSubtract(1));
            break;
        case 'today':
            dateFilter = `AND LEFT(date, 10) = ?`;
            params.push(getServerDate());
            break;
        case 'week':
            dateFilter = `AND date >= ?`;
            params.push(getServerDateSubtract(7) + ' 00:00:00');
            break;
        case 'month':
            dateFilter = `AND date >= ?`;
            params.push(getServerDateSubtract(30) + ' 00:00:00');
            break;
        default:
            dateFilter = `AND LEFT(date, 10) = ?`;
            params.push(getServerDate());
    }
    
    const query = `
        SELECT 
            COUNT(*) as count,
            SUM(d.amount) as total_amount,
            ROUND(SUM(CASE 
                WHEN u.fee IS NOT NULL AND u.fee > 0 
                THEN d.amount * u.fee / 100 
                ELSE 0 
            END)) as total_fee,
            ROUND(SUM(
                CASE 
                    WHEN u.fee IS NOT NULL AND u.fee > 0 THEN
                        (d.amount * u.fee / 100) * (
                            SELECT COALESCE(SUM(s.fee), 0) / 100
                            FROM users s 
                            WHERE s.company = d.company AND s.role = 'settlement'
                        )
                    ELSE 0 
                END
            )) as settlement_fee
        FROM deposits d
        LEFT JOIN users u ON d.company = u.company AND u.role != 'settlement'
        WHERE ${whereClause} ${dateFilter} AND d.transaction_type = 1
    `;
    
    // 정산 수수료는 서브쿼리로 계산하므로 외부 파라미터 불필요
    const finalParams = [...params];
    
    try {
        
        const [rows] = await conn.query(query, finalParams);
        await conn.end();
        
        return {
            count: rows[0].count || 0,
            total_amount: rows[0].total_amount || 0,
            total_fee: rows[0].total_fee || 0,
            settlement_fee: rows[0].settlement_fee || 0
        };
    } catch (error) {
        await conn.end();
        logger.dbQuery(query, params, error);
        throw error;
    }
}

async function getWithdrawalStats(user, period, company = null) {
    const conn = await mysql.createConnection(dbConfig);
    
    let whereClause = '1=1';
    let params = [];
    
    // 일반 사용자는 자신의 분류만 조회
    if (user.role === 'user') {
        whereClause += ' AND company = ?';
        params.push(user.company);
    } else if (company && user.role !== 'user') {
        // 관리자는 특정 분류 필터링 가능
        whereClause += ' AND company = ?';
        params.push(company);
    }
    
    // 기간별 필터링 (서버 시간 기준)
    let dateFilter = '';
    switch (period) {
        case 'yesterday':
            dateFilter = `AND LEFT(date, 10) = ?`;
            params.push(getServerDateSubtract(1));
            break;
        case 'today':
            dateFilter = `AND LEFT(date, 10) = ?`;
            params.push(getServerDate());
            break;
        case 'week':
            dateFilter = `AND date >= ?`;
            params.push(getServerDateSubtract(7) + ' 00:00:00');
            break;
        case 'month':
            dateFilter = `AND date >= ?`;
            params.push(getServerDateSubtract(30) + ' 00:00:00');
            break;
        default:
            dateFilter = `AND LEFT(date, 10) = ?`;
            params.push(getServerDate());
    }
    
    const query = `
        SELECT 
            COUNT(*) as count,
            SUM(amount) as total_amount
        FROM deposits 
        WHERE ${whereClause} ${dateFilter} AND transaction_type = 0
    `;
    
    try {
        const [rows] = await conn.query(query, params);
        await conn.end();
        
        return {
            count: rows[0].count || 0,
            total_amount: rows[0].total_amount || 0
        };
    } catch (error) {
        await conn.end();
        logger.dbQuery(query, params, error);
        throw error;
    }
}

async function getPeriodAnalysis(user, period, days, company = null) {
    const conn = await mysql.createConnection(dbConfig);
    
    let whereClause = '1=1';
    let params = [];
    
    // 일반 사용자는 자신의 분류만 조회
    if (user.role === 'user') {
        whereClause += ' AND company = ?';
        params.push(user.company);
    } else if (company && user.role !== 'user') {
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
        
        // 현재 연도에 데이터가 있는지 확인
        const yearCheckQuery = `SELECT COUNT(*) as count FROM deposits WHERE date >= '${currentYear}-01-01' AND date < '${currentYear + 1}-01-01'`;
        const [yearCheck] = await conn.query(yearCheckQuery);
        
        // 현재 연도에 데이터가 없으면 빈 결과 반환
        if (yearCheck[0].count === 0) {
            await conn.end();
            return [];
        }
    } else {
        // 일별, 주별은 지정된 일수만큼 (서버 시간 기준)
        dateCondition = `AND date >= ?`;
        params.push(getServerDateSubtract(parseInt(days)) + ' 00:00:00');
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
    
    // 파라미터 순서: dateFormat, company (이미 추가됨), days는 이미 params에 추가됨
    const finalParams = [dateFormat, ...params];
    
    try {
        const [rows] = await conn.query(query, finalParams);
        await conn.end();
        return rows;
    } catch (error) {
        await conn.end();
        logger.dbQuery(query, finalParams, error);
        throw error;
    }
}

async function getSenderAnalysis(user, company = null, month = null) {
    const conn = await mysql.createConnection(dbConfig);
    
    let whereClause = '1=1';
    let params = [];
    
    // 일반 사용자는 자신의 분류만 조회
    if (user.role === 'user') {
        whereClause += ' AND d.company = ?';
        params.push(user.company);
    } else if (company && user.role !== 'user') {
        // 관리자는 특정 분류 필터링 가능
        whereClause += ' AND d.company = ?';
        params.push(company);
    }
    
    // 월별 필터링 (올해년도 기준)
    if (month && month.toString().trim() !== '') {
        const currentYear = new Date().getFullYear();
        whereClause += ' AND DATE_FORMAT(d.date, "%Y-%m") = ?';
        params.push(`${currentYear}-${month.toString().padStart(2, '0')}`);
    } else {
        // 월이 지정되지 않으면 올해년도 전체
        const currentYear = new Date().getFullYear();
        whereClause += ' AND d.date >= ? AND d.date < ?';
        params.push(`${currentYear}-01-01`, `${currentYear + 1}-01-01`);
    }
    
    // 상위 입금자 조회 (입금 건만 집계) - 최적화된 쿼리
    const topSendersQuery = `
        SELECT 
            d.sender,
            ${user.role !== 'user' ? 'd.company,' : ''}
            u.company_name,
            COUNT(*) as count,
            SUM(d.amount) as total_amount,
            AVG(d.amount) as avg_amount
        FROM (
            SELECT sender, company, amount
            FROM deposits 
            WHERE ${whereClause.replace(/d\./g, '')} AND transaction_type = 1
        ) d
        LEFT JOIN users u ON d.company = u.company AND u.role != 'settlement'
        GROUP BY d.sender${user.role !== 'user' ? ', d.company' : ''}, u.company_name
        ORDER BY total_amount DESC
        LIMIT 10
    `;
    
    try {
        // 쿼리 타임아웃 설정 (30초)
        conn.config.queryTimeout = 30000;
        const [rows] = await conn.query(topSendersQuery, params);
        await conn.end();
        return rows;
    } catch (error) {
        await conn.end();
        logger.dbQuery(topSendersQuery, params, error);
        throw error;
    }
}

async function getCompanyAnalysis(user, month = null) {
    if (user.role === 'user') {
        throw new Error('접근 권한이 없습니다.');
    }
    
    const conn = await mysql.createConnection(dbConfig);
    
    let whereClause = '1=1';
    let params = [];
    
    // 월별 필터링 (올해년도 기준)
    if (month && month.toString().trim() !== '') {
        const currentYear = new Date().getFullYear();
        whereClause += ' AND DATE_FORMAT(date, "%Y-%m") = ?';
        params.push(`${currentYear}-${month.toString().padStart(2, '0')}`);
    } else {
        // 월이 지정되지 않으면 올해년도 전체
        const currentYear = new Date().getFullYear();
        whereClause += ' AND date >= ? AND date < ?';
        params.push(`${currentYear}-01-01`, `${currentYear + 1}-01-01`);
    }
    
    const query = `
        SELECT 
            d.company,
            u.company_name,
            COUNT(CASE WHEN d.transaction_type = 1 THEN 1 END) as deposit_count,
            SUM(CASE WHEN d.transaction_type = 1 THEN d.amount ELSE 0 END) as total_deposit,
            ROUND(SUM(CASE 
                WHEN d.transaction_type = 1 AND u.fee IS NOT NULL AND u.fee > 0 
                THEN d.amount * u.fee / 100 
                ELSE 0 
            END)) as total_fee,
            ROUND(SUM(
                CASE 
                    WHEN d.transaction_type = 1 AND u.fee IS NOT NULL AND u.fee > 0 THEN
                        (d.amount * u.fee / 100) * (
                            SELECT COALESCE(SUM(s.fee), 0) / 100
                            FROM users s 
                            WHERE s.company = d.company AND s.role = 'settlement'
                        )
                    ELSE 0 
                END
            )) as total_settlement_fee,
            COUNT(CASE WHEN d.transaction_type = 0 THEN 1 END) as withdrawal_count,
            SUM(CASE WHEN d.transaction_type = 0 THEN d.amount ELSE 0 END) as total_withdrawal
        FROM deposits d
        LEFT JOIN users u ON d.company = u.company AND u.role != 'settlement'
        WHERE ${whereClause}
        GROUP BY d.company, u.company_name
        ORDER BY total_deposit DESC
    `;
    
    try {
        const [rows] = await conn.query(query, params);
        await conn.end();
        return rows;
    } catch (error) {
        await conn.end();
        logger.dbQuery(query, params, error);
        throw error;
    }
}

async function getAllCompanies(user) {
    if (user.role === 'user') {
        throw new Error('접근 권한이 없습니다.');
    }
    
    const conn = await mysql.createConnection(dbConfig);
    
    // 올해년도 기준으로 필터링하되, 모든 분류를 반환
    const currentYear = new Date().getFullYear();
    
    const query = `
        SELECT DISTINCT company
        FROM deposits 
        WHERE date >= ? AND date < ? AND company IS NOT NULL AND company != ''
        ORDER BY company ASC
    `;
    
    try {
        const [rows] = await conn.query(query, [`${currentYear}-01-01`, `${currentYear + 1}-01-01`]);
        await conn.end();
        return rows;
    } catch (error) {
        await conn.end();
        logger.dbQuery(query, [`${currentYear}-01-01`, `${currentYear + 1}-01-01`], error);
        throw error;
    }
}

module.exports = {
    getBasicStats,
    getWithdrawalStats,
    getPeriodAnalysis,
    getSenderAnalysis,
    getCompanyAnalysis,
    getAllCompanies
}; 