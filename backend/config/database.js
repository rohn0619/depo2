const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    multipleStatements: true,
    queueLimit: 0,
    timezone: '+09:00' // 한국 시간대 설정
};

module.exports = dbConfig; 