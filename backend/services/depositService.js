const mysql = require('mysql2/promise');
const dbConfig = require('../config/database');
const logger = require('../utils/logger');



async function createDeposit(depositData) {
    const conn = await mysql.createConnection(dbConfig);
    
    const { date, bank, amount, balance, sender, company, transaction_type, sms_raw, is_matching_member, requires_new_alert } = depositData;
    
    // transaction_type은 필수 필드 (입금: 1, 출금: 0)
    if (transaction_type === null || transaction_type === undefined) {
        throw new Error('transaction_type은 필수 필드입니다. (입금: 1, 출금: 0)');
    }
    
    const [result] = await conn.query(
        'INSERT INTO deposits (date, bank, amount, balance, sender, company, transaction_type, sms_raw, is_matching_member, requires_new_alert) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [date, bank, amount, balance, sender, company, transaction_type, sms_raw, is_matching_member || false, requires_new_alert || false]
    );
    
    await conn.end();
    return result.insertId;
}

async function getDeposits(filters = {}) {
    const conn = await mysql.createConnection(dbConfig);
    
    // 페이지네이션 파라미터
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const offset = (page - 1) * limit;
    
    let query = `
        SELECT d.id, 
               DATE_FORMAT(d.date, '%Y-%m-%d %H:%i:%s') as date,
               d.bank, d.amount, d.balance, d.transaction_type,
               d.sender, d.company, d.sms_raw, d.is_checked,
               d.created_at
        FROM deposits d
    `;
    let params = [];
    let whereConditions = [];
    
    // 일반 사용자는 자신의 분류와 일치하는 입금내역만 조회
    if (filters.role === 'user' && filters.company && filters.company.trim() !== '') {
        whereConditions.push('d.company = ?');
        params.push(filters.company);
    }
    
    // 정산 사용자는 자신의 분류와 일치하는 입금내역만 조회
    if (filters.role === 'settlement' && filters.company && filters.company.trim() !== '') {
        whereConditions.push('d.company = ?');
        params.push(filters.company);
    }
    
    // 필터링 조건 추가
    if (filters.search && filters.search.trim() !== '') {
        whereConditions.push('d.sender LIKE ?');
        params.push(`%${filters.search}%`);
    }
    
    if (filters.selectedCompany && filters.selectedCompany.trim() !== '') {
        whereConditions.push('d.company = ?');
        params.push(filters.selectedCompany);
    }
    
    if (filters.dateFrom && filters.dateFrom.trim() !== '') {
        whereConditions.push('DATE(d.date) >= ?');
        params.push(filters.dateFrom);
    }
    
    if (filters.dateTo && filters.dateTo.trim() !== '') {
        whereConditions.push('DATE(d.date) <= ?');
        params.push(filters.dateTo);
    }
    
    // WHERE 조건 추가
    if (whereConditions.length > 0) {
        query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    query += ' ORDER BY d.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    try {
        const [rows] = await conn.query(query, params);
        
        // 전체 개수 조회 (페이지네이션용)
        let countQuery = 'SELECT COUNT(*) as total FROM deposits d';
        let countParams = [];
        let countWhereConditions = [];
        
        if (filters.role === 'user' && filters.company && filters.company.trim() !== '') {
            countWhereConditions.push('d.company = ?');
            countParams.push(filters.company);
        }
        
        // 필터링 조건 추가 (개수 조회에도 동일하게 적용)
        if (filters.search && filters.search.trim() !== '') {
            countWhereConditions.push('d.sender LIKE ?');
            countParams.push(`%${filters.search}%`);
        }
        
        if (filters.selectedCompany && filters.selectedCompany.trim() !== '') {
            countWhereConditions.push('d.company = ?');
            countParams.push(filters.selectedCompany);
        }
        
        if (filters.dateFrom && filters.dateFrom.trim() !== '') {
            countWhereConditions.push('DATE(d.date) >= ?');
            countParams.push(filters.dateFrom);
        }
        
        if (filters.dateTo && filters.dateTo.trim() !== '') {
            countWhereConditions.push('DATE(d.date) <= ?');
            countParams.push(filters.dateTo);
        }
        
        if (countWhereConditions.length > 0) {
            countQuery += ' WHERE ' + countWhereConditions.join(' AND ');
        }
        
        const [countRows] = await conn.query(countQuery, countParams);
        const totalCount = countRows[0].total;
        
        await conn.end();
        
        // 분류별 사용자 정보 가져오기 (중복 제거를 위해)
        const conn2 = await mysql.createConnection(dbConfig);
        let userInfoQuery = `
            SELECT company, fee, company_name 
            FROM users 
            WHERE role != 'settlement' AND company IS NOT NULL AND company != ''
        `;
        
        // 정산 사용자 정보도 가져오기 (관리자/슈퍼관리자를 위해)
        let settlementUserQuery = `
            SELECT company, fee, company_name 
            FROM users 
            WHERE role = 'settlement' AND company IS NOT NULL AND company != ''
        `;
        
        let deposits;
        
        // 정산 사용자의 경우 해당 분류의 사용자 정보만 가져오기
        if (filters.role === 'settlement' && filters.company) {
            userInfoQuery += ' AND company = ?';
            const [userRows] = await conn2.query(userInfoQuery, [filters.company]);
            const [settlementRows] = await conn2.query(settlementUserQuery + ' AND company = ?', [filters.company]);
            await conn2.end();
            
            // 프론트 호환을 위해 데이터 포맷 변환 및 수수료 계산
            deposits = rows.map(row => {
                const userInfo = userRows.find(u => u.company === row.company);
                const fee = userInfo ? userInfo.fee : 0;
                // transaction_type은 필수 필드
                if (row.transaction_type === null || row.transaction_type === undefined) {
                    throw new Error(`입금내역 ID ${row.id}의 transaction_type이 설정되지 않았습니다.`);
                }
                
                // 출금의 경우 수수료 계산하지 않음
                const feeAmount = row.transaction_type === 1 ? Math.round((row.amount * fee) / 100) : 0;
                const netAmount = row.transaction_type === 1 ? row.amount - feeAmount : row.amount;
                
                // 정산 수수료 계산 (하나의 분류에 여러 정산 사용자가 있을 경우 합산)
                let settlementFee = 0;
                if (row.transaction_type === 1 && feeAmount > 0) {
                    const settlementUsersForCompany = settlementRows.filter(u => u.company === row.company);
                    settlementFee = settlementUsersForCompany.reduce((total, settlementUser) => {
                        return total + Math.round((feeAmount * settlementUser.fee) / 100);
                    }, 0);
                }
                
                return {
                    id: row.id,
                    date: row.date,
                    bank: row.bank,
                    amount: row.amount,
                    balance: row.balance,
                    transaction_type: row.transaction_type,
                    fee: row.transaction_type === 1 ? fee : 0,
                    fee_amount: feeAmount,
                    net_amount: netAmount,
                    settlement_fee: settlementFee,
                    sender: row.sender,
                    company: row.company,
                    company_name: userInfo ? userInfo.company_name : null,
                    sms_raw: row.sms_raw,
                    is_checked: row.is_checked,
                    created_at: row.created_at
                };
            });
        } else {
            // 일반 사용자나 관리자의 경우
            const [userRows] = await conn2.query(userInfoQuery);
            const [settlementRows] = await conn2.query(settlementUserQuery);
            await conn2.end();
            
            // 프론트 호환을 위해 데이터 포맷 변환 및 수수료 계산
            deposits = rows.map(row => {
                const userInfo = userRows.find(u => u.company === row.company);
                const fee = userInfo ? userInfo.fee : 0;
                
                // transaction_type은 필수 필드
                if (row.transaction_type === null || row.transaction_type === undefined) {
                    throw new Error(`입금내역 ID ${row.id}의 transaction_type이 설정되지 않았습니다.`);
                }
                
                // 출금의 경우 수수료 계산하지 않음
                const feeAmount = row.transaction_type === 1 ? Math.round((row.amount * fee) / 100) : 0;
                const netAmount = row.transaction_type === 1 ? row.amount - feeAmount : row.amount;
                
                // 정산 수수료 계산 (하나의 분류에 여러 정산 사용자가 있을 경우 합산)
                let settlementFee = 0;
                if (row.transaction_type === 1 && feeAmount > 0) {
                    const settlementUsersForCompany = settlementRows.filter(u => u.company === row.company);
                    settlementFee = settlementUsersForCompany.reduce((total, settlementUser) => {
                        return total + Math.round((feeAmount * settlementUser.fee) / 100);
                    }, 0);
                }
                
                return {
                    id: row.id,
                    date: row.date,
                    bank: row.bank,
                    amount: row.amount,
                    balance: row.balance,
                    transaction_type: row.transaction_type,
                    fee: row.transaction_type === 1 ? fee : 0,
                    fee_amount: feeAmount,
                    net_amount: netAmount,
                    settlement_fee: settlementFee,
                    sender: row.sender,
                    company: row.company,
                    company_name: userInfo ? userInfo.company_name : null,
                    sms_raw: row.sms_raw,
                    is_checked: row.is_checked,
                    created_at: row.created_at
                };
            });
        }
        
        // 페이지네이션 정보 포함하여 반환
        return {
            deposits,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit),
                hasNext: page < Math.ceil(totalCount / limit),
                hasPrev: page > 1
            }
        };
    } catch (error) {
        await conn.end();
        logger.dbQuery(query, params, error);
        throw error;
    }
}

async function getUncheckedCount(filters = {}) {
    const conn = await mysql.createConnection(dbConfig);
    
    let query = 'SELECT COUNT(*) as count FROM deposits WHERE is_checked = FALSE';
    let params = [];
    
    // 일반 사용자는 자신의 분류와 일치하는 입금내역만 조회
    if (filters.role === 'user' && filters.company && filters.company.trim() !== '') {
        query += ' AND company = ?';
        params.push(filters.company);
    }
    
    try {
        const [rows] = await conn.query(query, params);
        await conn.end();
        return rows[0].count;
    } catch (error) {
        await conn.end();
        logger.dbQuery(query, params, error);
        throw error;
    }
}

async function updateDepositCheckStatus(depositId, isChecked, filters = {}) {
    const conn = await mysql.createConnection(dbConfig);
    
    try {
        // 일반 사용자는 자신의 분류와 일치하는 입금내역만 수정 가능
        if (filters.role === 'user' && filters.company) {
            const [deposit] = await conn.query('SELECT company FROM deposits WHERE id = ?', [depositId]);
            if (deposit.length === 0) {
                await conn.end();
                throw new Error('입금내역을 찾을 수 없습니다.');
            }
            if (deposit[0].company !== filters.company) {
                await conn.end();
                throw new Error('해당 입금내역을 수정할 권한이 없습니다.');
            }
        }
        
        const [result] = await conn.query(
            'UPDATE deposits SET is_checked = ? WHERE id = ?',
            [isChecked, depositId]
        );
        
        await conn.end();
        
        if (result.affectedRows === 0) {
            throw new Error('입금내역을 찾을 수 없습니다.');
        }
        
        return true;
    } catch (error) {
        await conn.end();
        logger.dbQuery('UPDATE deposits SET is_checked = ? WHERE id = ?', [isChecked, depositId], error);
        throw error;
    }
}

async function deleteDeposit(depositId, filters = {}) {
    const conn = await mysql.createConnection(dbConfig);
    
    try {
        // 일반 사용자는 자신의 분류와 일치하는 입금내역만 삭제 가능
        if (filters.role === 'user' && filters.company) {
            const [deposit] = await conn.query('SELECT company FROM deposits WHERE id = ?', [depositId]);
            if (deposit.length === 0) {
                await conn.end();
                throw new Error('입금내역을 찾을 수 없습니다.');
            }
            if (deposit[0].company !== filters.company) {
                await conn.end();
                throw new Error('해당 입금내역을 삭제할 권한이 없습니다.');
            }
        }
        
        const [result] = await conn.query(
            'DELETE FROM deposits WHERE id = ?',
            [depositId]
        );
        
        await conn.end();
        
        if (result.affectedRows === 0) {
            throw new Error('입금내역을 찾을 수 없습니다.');
        }
        
        return true;
    } catch (error) {
        await conn.end();
        logger.dbQuery('DELETE FROM deposits WHERE id = ?', [depositId], error);
        throw error;
    }
}

module.exports = {
    createDeposit,
    getDeposits,
    getUncheckedCount,
    updateDepositCheckStatus,
    deleteDeposit
}; 