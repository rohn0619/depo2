const bcrypt = require('bcrypt');

async function generateHash(password) {
    try {
        const saltRounds = 10;
        const hash = await bcrypt.hash(password, saltRounds);
        console.log(`비밀번호: ${password}`);
        console.log(`해시: ${hash}`);
        return hash;
    } catch (error) {
        console.error('해시 생성 오류:', error);
    }
}

// 사용 예시
async function main() {
    console.log('=== 비밀번호 해시 생성기 ===\n');
    
    // 기본 관리자 계정
    await generateHash('admin123');
    console.log('');
    
    // 추가 사용자 계정들
    await generateHash('user123');
    console.log('');
    await generateHash('password123');
    console.log('');
    
    // 커스텀 비밀번호 입력 (명령행 인수)
    const customPassword = process.argv[2];
    if (customPassword) {
        console.log('=== 커스텀 비밀번호 ===');
        await generateHash(customPassword);
    }
}

// 스크립트 실행
if (require.main === module) {
    main();
}

module.exports = { generateHash }; 