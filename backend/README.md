# 🏦 은행 입금 문자 파서

한국 은행들의 입금 문자를 파싱하여 구조화된 데이터로 변환하는 애플리케이션입니다.

## 📁 프로젝트 구조

```
depo/
├── string_to_dict.js     # Node.js 백엔드 API 서버
├── string_to_dict.php    # PHP 버전 (참고용)
├── package.json          # 백엔드 의존성
└── frontend/             # React 프론트엔드
    ├── src/
    │   ├── App.js        # 메인 React 컴포넌트
    │   ├── App.css       # 스타일
    │   └── index.js      # React 진입점
    └── package.json      # 프론트엔드 의존성
```

## 🚀 실행 방법

### 1. 환경 설정

`.env` 파일을 생성하고 MySQL 연결 정보를 설정하세요:

```bash
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_username
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=your_database
JWT_SECRET=your-secret-key
```

### 2. 데이터베이스 설정

```bash
# MySQL에 접속
mysql -u your_username -p your_database

# 사용자 테이블 생성
source create_users_table.sql

# 입금내역 테이블 및 샘플 데이터 생성 (선택사항)
source create_sample_data.sql
```

### 3. 백엔드 서버 실행

```bash
# 백엔드 의존성 설치
npm install

# 백엔드 서버 시작 (포트 3001)
npm start
```

### 2. 프론트엔드 실행

```bash
# 프론트엔드 디렉토리로 이동
cd frontend

# 프론트엔드 의존성 설치
npm install

# React 개발 서버 시작 (포트 3000)
npm start
```

### 3. 접속

- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:3001/api/parse
- **헬스체크**: http://localhost:3001/api/health

## 🔧 API 사용법

### POST /api/parse

입금 문자를 파싱하여 구조화된 데이터를 반환합니다.

**요청 예시:**
```bash
curl -X POST http://localhost:3001/api/parse \
  -H "Content-Type: application/json" \
  -d '{
    "input_string": "보낸사람 : 15882100\n농협 입금10,000원\n07/04 15:18 352-****-4273-63 신동수 잔액3,710,000원"
  }'
```

**응답 예시:**
```json
{
  "bank": "농협",
  "datetime": "07/04 15:18",
  "amount": "10000",
  "sender_name": "신동수",
  "company": null
}
```

## 📊 지원하는 은행

- 농협 (NH)
- 신협
- 우리은행
- 기업은행 (IBK)
- 신한은행
- 국민은행 (KB)
- 새마을금고
- 토스뱅크
- 카카오뱅크
- 케이뱅크

## 🏢 지원하는 회사명

- mori114
- an-coinup00011, an-coinup00022, an-coinup00033
- inc-nara00010, inc-nara00020, inc-nara00030
- an-coinup-11
- coinpos365
- upcoin4989
- coin1147
- abscoin365

## 🧪 테스트

### 콘솔 테스트

```bash
# 샘플 테스트 실행
node -e "require('./string_to_dict.js').runSampleTests()"
```

### 웹 인터페이스

React 프론트엔드에서 제공하는 샘플 버튼을 사용하여 다양한 입금 문자 형식을 테스트할 수 있습니다.

## 🔐 인증 시스템

### 기본 계정
- **슈퍼 관리자**: `admin` / `admin123`
- **역할**: super (모든 기능 + 사용자 관리 접근 가능)
- **일반 관리자**: `manager` / `manager123`
- **역할**: admin (기본 기능만 접근 가능)

### 테스트용 일반 사용자 계정
```bash
# 테스트용 사용자 생성
mysql -u your_username -p your_database < create_test_users.sql
```

- **an-coinup-11 사용자**: `user_an_coinup_11` / `user123`
- **coinpos365 사용자**: `user_coinpos365` / `user123`
- **bizpay 사용자**: `user_bizpay` / `user123`
- **paynow 사용자**: `user_paynow` / `user123`
- **fastbank 사용자**: `user_fastbank` / `user123`

각 일반 사용자는 자신의 분류(`name`)와 일치하는 입금내역(`company`)만 조회할 수 있습니다.

### 비밀번호 해시 생성
```bash
# 기본 해시 생성
node generate_password_hash.js

# 커스텀 비밀번호 해시 생성
node generate_password_hash.js "your_password"
```

## 📝 주요 기능

- ✅ 다양한 은행 입금 문자 형식 지원
- ✅ 은행명, 날짜/시간, 입금액, 입금자명, 회사명 추출
- ✅ RESTful API 제공
- ✅ React 기반 웹 인터페이스
- ✅ 실시간 파싱 결과 표시
- ✅ 반응형 디자인
- ✅ 샘플 데이터 제공
- ✅ JWT 기반 인증 시스템
- ✅ 사용자 관리 (super/admin/user 역할)
- ✅ 안전한 비밀번호 암호화 (bcrypt)
- ✅ 역할 기반 입금내역 접근 제어
  - 슈퍼 관리자/관리자: 모든 입금내역 조회 가능
  - 일반 사용자: 자신의 분류와 일치하는 입금내역만 조회
- ✅ 입금내역 확인 상태 관리
  - 확인/미확인 상태 표시 및 변경
  - 관리자/사용자 권한에 따른 수정 가능

## 🔄 개발 환경

- **백엔드**: Node.js + Express
- **프론트엔드**: React + Axios
- **포트**: 백엔드 3001, 프론트엔드 3000 