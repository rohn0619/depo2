/**
 * 문자열을 딕셔너리로 변환하는 메인 함수
 * @param {string} inputString 입력 문자열
 * @param {Array} approvedCompanies 승인된 company 목록 (선택사항)
 * @param {Function} checkMatchingMember 매칭 회원 체크 함수 (선택사항)
 * @returns {object} 파싱된 결과
 */
async function stringToDictionary(inputString, approvedCompanies = [], checkMatchingMember = null) {
    if (!inputString || typeof inputString !== 'string') {
        return {};
    }

    const result = {};
    const fullText = inputString; // 원본 문자열 유지 (줄바꿈 포함)

    // 은행명 추출
    const bankNames = [
        '한국투자', '농협', 'NH', '신협', '우리', '기업', 'IBK', '신한', '신한은행', '국민', '국민은행', 
        'KB', '새마을', '토스', '카카오', '케이', '케이뱅크', '카카오뱅크', '토스뱅크'
    ];
    
    // 우선순위 1: 대괄호로 감싸진 은행명 찾기
    const bracketBankPattern = /\[([^\]]+)\]/g;
    let bracketMatch;
    while ((bracketMatch = bracketBankPattern.exec(fullText)) !== null) {
        const bracketBank = bracketMatch[1];
        // 대괄호 안의 텍스트가 은행명 목록에 있는지 확인
        for (const bank of bankNames) {
            if (new RegExp(bank, 'i').test(bracketBank)) {
                result.bank = bank;
                break;
            }
        }
        if (result.bank) break; // 은행명을 찾았으면 중단
    }
    
    // 우선순위 2: 대괄호로 감싸진 은행명이 없으면 전체 텍스트에서 찾기
    if (!result.bank) {
    for (const bank of bankNames) {
        if (new RegExp(bank, 'i').test(fullText)) {
            result.bank = bank;
            break;
            }
        }
    }

    // Company명 추출 (DB에서 승인된 것만 사용)
    if (approvedCompanies && approvedCompanies.length > 0) {
        // 마지막 줄에서 분류값 찾기 (가장 정확한 방법)
        const lines = fullText.split('\n').filter(line => line.trim());
        const lastLine = lines[lines.length - 1];
        
        // 마지막 줄에서 승인된 company와 정확히 매칭
        for (const company of approvedCompanies) {
            if (new RegExp(`^${company.name}$`, 'i').test(lastLine.trim()) || 
                new RegExp(`^${company.name}\\s*$`, 'i').test(lastLine.trim())) {
                result.company = company.name;
                break;
            }
        }
        
        // 마지막 줄에서 부분 매칭 (예: ABS2에서 ABS 매칭)
        if (!result.company) {
            for (const company of approvedCompanies) {
                if (lastLine.trim().includes(company.name) || 
                    company.name.includes(lastLine.trim())) {
                    result.company = company.name;
                    break;
                }
            }
        }
        
        // 마지막 줄에서 찾지 못한 경우 전체 텍스트에서 검색
        if (!result.company) {
            for (const company of approvedCompanies) {
                if (new RegExp(company.name, 'i').test(fullText)) {
                    result.company = company.name;
                    break;
                }
            }
        }
    }

    // 날짜와 시간 추출 (확장된 형식 지원)
    const dateTimePatterns = [
        /(\d{4}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})/,  // 2025/07/04 17:15:32
        /(\d{2}\/\d{2})[ \[]*(\d{2}:\d{2})/,             // 07/04 15:18
        /(\d{2}\/\d{2})[ \[]*/                            // 07/04
    ];
    
    for (const pattern of dateTimePatterns) {
        const match = fullText.match(pattern);
        if (match) {
            if (match[2]) {
                result.datetime = `${match[1]} ${match[2]}`;
            } else {
                result.datetime = match[1];
            }
            break;
        }
    }
    
    // 날짜가 없을 때 오늘 날짜로 설정 (시간만 있는 경우)
    if (!result.datetime) {
        const timePattern = /(\d{2}:\d{2})/;
        const timeMatch = fullText.match(timePattern);
        if (timeMatch) {
            const now = new Date();
            const today = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
            result.datetime = `${today} ${timeMatch[1]}`;
        }
    }

    // 입금/출금 구분 및 금액 추출
    const isDeposit = /입금/.test(fullText);
    const isWithdrawal = /출금|이체|송금|인출/.test(fullText);
    
    if (isDeposit) {
        result.transaction_type = 'deposit';
        const amountPatterns = [
            /입금\s*([0-9,]+)원/,       // 입금10,000원, 입금 1000000원
            /입금\s+([0-9,]+)/,         // 입금     100,000
            /입금\s*\n([0-9,]+)/,       // 입금\n600,000
            /입금\s+([0-9,]+)원/,       // 입금 300,000원
            /([0-9,]+)원/               // 단순 금액원 형식 (입금이 별도 줄에 있는 경우)
        ];
        
        for (const pattern of amountPatterns) {
            const match = fullText.match(pattern);
            if (match) {
                result.amount = match[1].replace(/,/g, '');
                break;
            }
        }
    } else if (isWithdrawal) {
        result.transaction_type = 'withdrawal';
        const amountPatterns = [
            /출금\s*([0-9,]+)원/,       // 출금10,000원, 출금 1000000원
            /출금\s+([0-9,]+)/,         // 출금     100,000
            /출금\s*\n([0-9,]+)/,       // 출금\n600,000
            /출금\s+([0-9,]+)원/,       // 출금 300,000원
            /이체\s*([0-9,]+)원/,       // 이체10,000원
            /송금\s*([0-9,]+)원/,       // 송금10,000원
            /인출\s*([0-9,]+)원/,       // 인출10,000원
            /([0-9,]+)원/               // 단순 금액원 형식 (출금이 별도 줄에 있는 경우)
        ];
        
        for (const pattern of amountPatterns) {
            const match = fullText.match(pattern);
            if (match) {
                result.amount = match[1].replace(/,/g, '');
                break;
            }
        }
    } else {
        // 입금/출금 키워드가 없는 경우 파싱 불가능
        result.transaction_type = null;
        result.amount = null;
    }

    // 거래자명 추출 (입금/출금 공통)
    let senderName = null;
    
    // 출금 관련 패턴 (우선순위 높음)
    const withdrawalPatterns = [
        // KB은행 특정 패턴: 계좌번호 다음 줄의 상점명/회사명 (최우선)
        /\d{6}\*+\d{3}\n([가-힣A-Z0-9\s]+?)(?=\n출금|\n\d+|\n잔액|$)/,  // 247902**832\n범카츠고덕STV점
        /출금\s+[0-9,]+원\s+([가-힣\s]+?)(?=\s*잔액|$)/,  // 출금 2,870,000원 이신자 (잔액 앞까지)
        /출금\s+[0-9,]+\s+([가-힣\s]+?)(?=\s*잔액|$)/,    // 출금 2,870,000 이신자 (잔액 앞까지)
        /\d{2}:\d{2}\s+\d{3}-\*{4}-\d{4}-\d{2}\s+([가-힣\s()]+?)(?=\s*잔액|$)/,  // 15:27 352-****-7417-43 (주)재호 잔액
        /\n([가-힣\s]+)\n출금/,                          // 박인호\n출금
        /\n([가-힣\s]+)\n\d+/,                           // 박인호\n2,960,000
        /\n\s*([가-힣\s()]+(?:주식회사|\(주\)|\(유\)|\(합\)|\(사\)|\(회사\))?)\s*$/m,  // 줄 끝의 회사명/이름 (괄호 포함)
        /\n\s*([가-힣\s()]+(?:주식회사|\(주\)|\(유\)|\(합\)|\(사\)|\(회사\))?)\s*\n/,  // 줄 사이의 회사명/이름 (괄호 포함)
        /출금\s+[0-9,]+\s*\n\s*([가-힣\s()]+)/,        // 출금 금액 다음 줄의 이름 (괄호 포함)
        /이체출금\s*\n\s*[0-9,]+\s*원\s*\n\s*\(잔액[0-9,]+\)\s*\n\s*([가-힣\s]+)/,  // 이체출금\n2,700,000원\n(잔액507,500)\n하나은행 이신자
        /\n\s*([가-힣\s]+)\s*$/,  // 마지막 줄의 한글 이름 (하나은행 이신자)
    ];
    
    // 입금 관련 패턴
    const depositPatterns = [
        // 우선순위 1: KB은행 특정 패턴 (계좌번호 다음 줄의 입금자명)
        /\d{6}\*+\d{3}\n([가-힣A-Z0-9\s]+?)(?=\n입금|\n\d+|\n잔액|$)/,  // 247902**832\n노희창
        // 우선순위 2: 신한은행 특정 패턴 (입금 금액 다음 줄의 거래자명)
        /입금\s+[0-9,]+\s*\n\s*잔액\s*[0-9,]+\s*\n\s*([가-힣A-Z0-9\s]+?)(?=\n|$)/,  // 입금 1\n잔액 2,150,001\n 유피큐98
        // 우선순위 3: 새마을금고 특정 패턴 (이체입금 뒤의 실제 이름)
        /이체입금\s*\n\s*([가-힣\s()]+?)(?=\s*잔액|$)/,   // 이체입금\n시명길 (잔액 앞까지)
        /이체입금\s+([가-힣\s()]+?)(?=\s*잔액|$)/,        // 이체입금 시명길 (잔액 앞까지)
        /새마을금\s+([가-힣\s()]+?)(?=\s*아미|$)/,        // 새마을금 시명길 아미 (아미 앞까지)
        /새마을금\s+([가-힣\s()]+?)(?=\s*$)/,             // 새마을금 시명길 (줄 끝까지)
        // 우선순위 4: 계좌번호 뒤의 숫자-한글 조합 (020-이순일 형태)
        /\d{3}-\*{4}-\d{4}-\d{2}\s+(\d{3}-[가-힣]+)/,  // 352-****-7429-13 020-이순일
        // 우선순위 5: 계좌번호 뒤의 일반 한글 이름
        /\d{3}-\*{4}-\d{4}-\d{2}\s+([가-힣\s()]+)/,     // 352-****-4273-63 신동수 (괄호 포함)
        // 우선순위 5-1: 계좌번호 뒤의 영문+숫자 조합
        /\d{3}-\*{4}-\d{4}-\d{2}\s+([a-zA-Z0-9]+)/,     // 352-****-4273-63 otp8887
        // 우선순위 6: 입금 금액 뒤의 이름
        /입금\s+[0-9,]+원\s+([가-힣\s()]+?)(?=\s*잔액|$)/,  // 입금 1,500,000원 류진희 (잔액 앞까지)
        /입금\s+[0-9,]+\s+([가-힣\s()]+?)(?=\s*잔액|$)/,    // 입금 1500000 류진희 (잔액 앞까지)
        // 우선순위 7: 줄 끝의 이름 (마지막 줄 제외)
        /\n\s*([가-힣\s()]+)\s*$/m,                       //  박현옥, 김양곤(줄 끝) (괄호 포함)
        /\n([가-힣\s()]+)\n입금/,                        // ...\n김양곤\n입금 (괄호 포함)
        /\n([가-힣\s()]+)\n\d+$/,                        // 윤선중\n136001053762 (괄호 포함)
        /\n([가-힣\s()]+)\n\d+\n/,                       // 지현주\n100157160105\n (괄호 포함)
        /\d+\*+\d+\n([가-힣\s()]+)/,                     // 942902**347\n김양곤 (KB은행 형식) (괄호 포함)
        // 우선순위 8: 기타 숫자-한글 조합 (괄호 포함/미포함)
        /\d{3}-\d{3}-\d{4}-\d{2}\s+([0-9-가-힣\s()]+)/,  // 088-조휘서( 형태
        /\d{3}-\*{4}-\d{4}-\d{2}\s+([0-9-가-힣\s()]+)/,  // 352-****-7417-43 088-조휘서( 형태
        /[가-힣\s()]{2,10}(?=\s*\d{10,}|\s*$)/           // 기본 한글 이름 패턴 (괄호 포함, 길이 확장)
    ];
    
    // 거래 타입에 따라 패턴 선택
    const patterns = isWithdrawal ? [...withdrawalPatterns, ...depositPatterns] : depositPatterns;
    
    for (const pattern of patterns) {
        const match = fullText.match(pattern);
        if (match) {
            senderName = match[1] ? match[1].trim() : match[0];
            // 회사명이나 이름이 너무 짧거나 숫자만 있는 경우 제외
            if (senderName && senderName.length >= 2 && !/^\d+$/.test(senderName)) {
                // "잔액", "출금", "입금", "이체" 등의 단어가 포함된 경우 제거
                senderName = senderName.replace(/\s*(잔액|출금|입금|이체).*$/, '').trim();
                
                // 줄바꿈 문자 제거
                senderName = senderName.replace(/\n/g, ' ').trim();
                
                // 괄호 정리: 열린 괄호로 끝나는 경우 제거
                senderName = senderName.replace(/\(+$/, '').trim();
                
                // 은행명이나 카드사명이 포함된 경우 제거 (정확한 단어 매칭)
                const bankNames = ['시티', '신한', '국민', '농협', '우리', '기업', 'IBK', 'KB', '토스', '카카오', '케이', '새마을', '새마을금', '하나은행'];
                for (const bankName of bankNames) {
                    // 한글에 맞는 단어 경계를 사용한 매칭
                    const regex = new RegExp(`(^|\\s)${bankName}(\\s|$)`, 'g');
                    senderName = senderName.replace(regex, '$1$2').trim();
                }
                
                // 시스템 메타데이터 제거 (approvedCompanies에 없는 단일 단어들)
                if (approvedCompanies && approvedCompanies.length > 0) {
                    const words = senderName.split(/\s+/);
                    if (words.length > 1) {
                        const lastWord = words[words.length - 1];
                        // 마지막 단어가 approvedCompanies에 없고, 1-4글자인 경우 제거
                        const isApprovedCompany = approvedCompanies.some(company => 
                            company.name === lastWord || lastWord.includes(company.name)
                        );
                        if (!isApprovedCompany && lastWord.length <= 4) {
                            words.pop();
                            senderName = words.join(' ').trim();
                        }
                    }
                }
                
                // 020-이순일 형태에서 숫자 부분 제거 (우선순위 높음)
                if (/^\d{3}-[가-힣]+/.test(senderName)) {
                    const nameMatch = senderName.match(/^\d{3}-([가-힣]+)/);
                    if (nameMatch) {
                        senderName = nameMatch[1];
                    }
                }
                // 088-조휘서 형태에서 숫자 부분 제거
                else if (/^\d+-\d+-\d+-\d+\s+([가-힣]+)/.test(senderName)) {
                    const nameMatch = senderName.match(/^\d+-\d+-\d+-\d+\s+([가-힣]+)/);
                    if (nameMatch) {
                        senderName = nameMatch[1];
                    }
                }
                
                if (senderName && senderName.length >= 2) {
                    break;
                }
            }
        }
    }
    
    if (senderName) {
        result.sender_name = senderName;
    }
    
    // company 값이 있으면 거래자명에서 제거
    if (result.company && result.sender_name && result.sender_name.includes(result.company)) {
        result.sender_name = result.sender_name.replace(new RegExp(`\\s*${result.company}\\s*`, 'g'), '').trim();
    }

    // 매칭 회원 체크 (입금인 경우만)
    if (result.transaction_type === 'deposit' && result.company && result.sender_name && checkMatchingMember) {
        try {
            console.log('🔍 매칭 회원 체크 시작:', {
                company: result.company,
                sender_name: result.sender_name
            });
            
            // sender_name을 account_holder로 사용하여 매칭 회원 체크
            const isMatchingMember = await checkMatchingMember(result.company, result.sender_name);
            result.is_matching_member = isMatchingMember;
            
            console.log('✅ 매칭 회원 체크 결과:', {
                is_matching_member: isMatchingMember,
                requires_new_alert: !isMatchingMember
            });
            
            // 매칭 회원이 아닌 경우 새로운 알림음 플래그 설정
            if (!isMatchingMember) {
                result.requires_new_alert = true;
            }
        } catch (error) {
            console.error('매칭 회원 체크 오류:', error);
            result.is_matching_member = false;
            result.requires_new_alert = false;
        }
    } else {
        console.log('⚠️ 매칭 회원 체크 건너뜀:', {
            transaction_type: result.transaction_type,
            company: result.company,
            sender_name: result.sender_name,
            checkMatchingMember: !!checkMatchingMember
        });
        result.is_matching_member = false;
        result.requires_new_alert = false;
    }

    // 잔액 추출
    const balancePatterns = [
        /잔액\s*([0-9,]+)원/,           // 잔액3,710,000원, 잔액 1,250,000원
        /잔액\s*:\s*([0-9,]+)원/,       // 잔액: 1,250,000원
        /잔액\s+([0-9,]+)/,             // 잔액 500,000
        /잔액\s*([0-9,]+)/,             // 잔액560,000
        /\n([0-9,]+)\s*잔액/,           // 11,040,045 잔액
        /\n([0-9,]+)\n잔액/,            // 560,000\n잔액
    ];
    
    for (const pattern of balancePatterns) {
        const match = fullText.match(pattern);
        if (match) {
            result.balance = match[1].replace(/,/g, '');
            break;
        }
    }

    return result;
}

// 샘플 테스트 함수
function runSampleTests() {
    console.log('🧪 문자 파싱 테스트 시작...\n');
    
    const testCases = [
        {
            name: '농협 입금 테스트',
            input: '보낸사람 : 15882100\n농협 입금10,000원\n07/04 15:18 352-****-4273-63 신동수 잔액3,710,000원'
        },
        {
            name: '신한은행 입금 테스트',
            input: '신한은행\n입금 50,000원\n07/05 14:30\n김철수님\n잔액: 1,250,000원'
        },
        {
            name: '토스뱅크 입금 테스트',
            input: '토스뱅크\n07/06 09:15\n입금 25,000원\n박영희님\n잔액 500,000원'
        },
        {
            name: '카카오뱅크 입금 테스트',
            input: '카카오뱅크\n07/07 16:45\n입금 100,000원\n이민수님\n잔액 2,100,000원'
        },
        {
            name: '국민은행 출금 테스트',
            input: '국민은행\n출금 30,000원\n07/08 11:20\n이체\n잔액 800,000원'
        },
        {
            name: '우리은행 이체 테스트',
            input: '우리은행\n07/09 16:30\n이체 150,000원\n송금\n잔액 1,500,000원'
        },
        {
            name: '기업은행 인출 테스트',
            input: '기업은행\n07/10 09:45\n인출 200,000원\nATM\n잔액 2,200,000원'
        },
        {
            name: '신한은행 출금 테스트 (회사명)',
            input: '보낸사람 : 15778000()\n[Web발신]\n신한07/04 15:18\n110-496-922482\n출금   7,900,000\n잔액 11,040,045\n 주식회사 넥스\nbbb'
        },
        {
            name: '신협 출금 테스트 (이름)',
            input: '보낸사람 : 15666000()\n신협132*****2222 07/07 18:38 출금 2,870,000원 이신자 잔액540,000원\nccc'
        },
        {
            name: 'KB은행 출금 테스트 (별도 줄)',
            input: '보낸사람 : 16449999\n[KB]07/07 18:29\n945802**314\n박인호\n출금\n2,960,000\n잔액560,000\nccc'
        },
        {
            name: '농협 출금 테스트 (회사명)',
            input: '보낸사람 : 15882100\n[Web발신]\n농협 출금780,500원\n07/06 15:27 352-****-7417-43 (주)재호 잔액505,010원'
        },
        {
            name: '괄호가 열린 상태로 끝나는 입금자명 테스트',
            input: '보낸사람 : 15882100()\n[Web발신]\n농협 입금1,000,000원\n07/09 14:24 352-****-7417-43 088-조휘서( 잔액1,961,657원\n<아미>'
        },
        {
            name: '숫자-한글 조합 입금자명 테스트',
            input: '보낸사람 : 15882100()\n[Web발신]\n농협 입금500,000원\n07/09 15:30 352-****-7417-43 088-김철수 잔액2,000,000원'
        },
        {
            name: '020-이순일 형태 입금자명 테스트',
            input: '보낸사람 : 15882100\n농협 입금500,000원\n07/13 19:35 352-****-7429-13 020-이순일 잔액1,030,000원\n아미'
        },
        {
            name: '새마을금고 이체입금 테스트',
            input: '보낸사람 : 15445000\n[한국투자]05:31\n43****82-01\n이체입금\n400,000원\n(잔액419,500)\n새마을금 시명길\n아미'
        },
        {
            name: '한국투자 이체출금 테스트 (하나은행 이신자)',
            input: '보낸사람 : 15445000\n[한국투자]05:11\n43****83-01\n이체출금\n2,700,000원\n(잔액507,500)\n하나은행 이신자'
        },
        {
            name: '한국투자 이체출금 테스트 (하나은행 이신자 + 아미)',
            input: '보낸사람 : 15445000\n[한국투자]05:11\n43****83-01\n이체출금\n2,700,000원\n(잔액507,500)\n하나은행 이신자\n아미'
        },
        {
            name: '한국투자 이체출금 테스트 (하나은행 이신자 + 테이블)',
            input: '보낸사람 : 15445000\n[한국투자]05:11\n43****83-01\n이체출금\n2,700,000원\n(잔액507,500)\n하나은행 이신자\n테이블'
        },
        {
            name: '농협 입금 테스트 (윤신한)',
            input: '보낸사람 : 15882100\n농협 입금300,000원\n07/25 18:53 356-****-5583-73 윤신한 잔액1,320,000원'
        },
        {
            name: 'KB은행 출금 테스트 (농협주식회사이엘지유)',
            input: '보낸사람 : 16449999\n[Web발신]\n[KB]07/25 00:17\n468601**630\n농협주식회사이엘지유\n출금\n3,560,000\n잔액570,302'
        },
        {
            name: '농협 입금 테스트 (otp8887)',
            input: '보낸사람 : 15882100\n농협 입금1원\n07/22 18:46 352-****-4273-63 otp8887 잔액2,150,001원'
        }
    ];
    
    testCases.forEach((testCase, index) => {
        console.log(`📝 테스트 ${index + 1}: ${testCase.name}`);
        console.log('입력:', testCase.input);
        
        const result = stringToDictionary(testCase.input);
        console.log('결과:', result);
        console.log('---\n');
    });
    
    console.log('✅ 모든 테스트 완료!');
}

module.exports = {
    stringToDictionary,
    runSampleTests
};

// 테스트 실행
if (require.main === module) {
    runSampleTests();
} 