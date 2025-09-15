// API 서버 URL 설정
export const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://demo-api.homeretech.com' // 실제 API 서버 도메인으로 변경
    : 'http://localhost:5001';

export default API_BASE_URL; 