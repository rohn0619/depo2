import React, { useState } from 'react';
import axios from 'axios';
import './App.css';
import logger from './utils/logger';

function MessageTest() {
  const [inputString, setInputString] = useState('');
  const [result, setResult] = useState(null);
  const [editableResult, setEditableResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [saved, setSaved] = useState(false);

  const samples = [
    "보낸사람 : 15882100\n농협 입금10,000원\n07/04 15:18 352-****-4273-63 신동수 잔액3,710,000원",
    "보낸사람 : 15778000()\n[Web발신]\n신한07/04 15:28\n110-496-922482\n입금     100,000\n잔액    870,045\n 박현옥",
    "보낸사람 : 16449999\n[KB]07/04 15:24\n942902**347\n김양곤\n입금\n600,000\n잔액1,320,000",
    "보낸사람 : 15778000()\n[Web발신]\n신한07/04 15:18\n110-496-922482\n출금   7,900,000\n잔액 11,040,045\n 주식회사 넥스\nbbb",
    "보낸사람 : 15666000()\n신협132*****2222 07/07 18:38 출금 2,870,000원 이신자 잔액540,000원\nccc",
    "보낸사람 : 16449999\n[KB]07/07 18:29\n945802**314\n박인호\n출금\n2,960,000\n잔액560,000\nccc"
  ];

  const loadSample = (index) => {
    setInputString(samples[index - 1]);
    setResult(null);
    setEditableResult(null);
    setError(null);
    setSaveStatus(null);
    setSaved(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!inputString.trim()) {
      setError('입력 문자열이 필요합니다.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setEditableResult(null);
    setSaveStatus(null);
    setSaved(false);

    try {
      const response = await axios.post('/api/parse', {
        input_string: inputString
      });
      setResult(response.data);
      setEditableResult(response.data);
    } catch (err) {
      logger.apiError('POST', '/api/parse', err);
      setError(err.response?.data?.message || '서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToDB = async () => {
    setSaveStatus('saving');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/deposits', 
        { sms: inputString, modified_data: editableResult },
        { 
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      setSaveStatus('success');
      setSaved(true);
    } catch (err) {
      logger.userAction('DB 저장', { sms: inputString.substring(0, 100), modified: editableResult }, err);
      setSaveStatus('error');
    }
  };

  const handleFieldChange = (field, value) => {
    setEditableResult(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatAmount = (amount) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  return (
    <div className="container">
      <h1>🏦 은행 입출금 문자 파서</h1>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="input_string">입출금 문자를 입력하세요:</label>
          <textarea
            id="input_string"
            value={inputString}
            onChange={(e) => setInputString(e.target.value)}
            placeholder="은행 입출금 문자를 여기에 붙여넣으세요..."
            rows="8"
          />
        </div>
        
        <div className="sample-buttons">
          {samples.map((_, index) => (
            <button
              key={index}
              type="button"
              className="sample-btn"
              onClick={() => loadSample(index + 1)}
            >
              샘플 {index + 1}
            </button>
          ))}
        </div>
        
        <button type="submit" disabled={loading} className="submit-btn">
          {loading ? '파싱 중...' : '파싱하기'}
        </button>
      </form>

      {error && (
        <div className="error">
          <h3>❌ 오류</h3>
          <p>{error}</p>
        </div>
      )}

      {result && editableResult && (
        <div className="result">
          <h3>📊 파싱 결과 (수정 가능)</h3>
          {Object.keys(result).length === 0 ? (
            <p>입출금 문자를 인식할 수 없습니다. 일반 문자열로 처리됩니다.</p>
          ) : (
            <>
              <div className="result-item">
                <span className="result-label">🏦 은행:</span>
                <input
                  type="text"
                  value={editableResult.bank || ''}
                  onChange={(e) => handleFieldChange('bank', e.target.value)}
                  className="result-input"
                  placeholder="은행명"
                />
              </div>
              <div className="result-item">
                <span className="result-label">📅 날짜/시간:</span>
                <input
                  type="text"
                  value={editableResult.datetime || ''}
                  onChange={(e) => handleFieldChange('datetime', e.target.value)}
                  className="result-input"
                  placeholder="YYYY-MM-DD HH:mm:ss"
                />
              </div>
              <div className="result-item">
                <span className="result-label">💳 거래구분:</span>
                <select
                  value={editableResult.transaction_type || ''}
                  onChange={(e) => handleFieldChange('transaction_type', e.target.value)}
                  className="result-input"
                >
                  <option value="">선택하세요</option>
                  <option value="deposit">입금</option>
                  <option value="withdrawal">출금</option>
                </select>
              </div>
              <div className="result-item">
                <span className="result-label">💰 금액:</span>
                <input
                  type="number"
                  value={editableResult.amount || ''}
                  onChange={(e) => handleFieldChange('amount', e.target.value)}
                  className="result-input"
                  placeholder="금액 (숫자만)"
                />
              </div>
              <div className="result-item">
                <span className="result-label">👤 거래자명:</span>
                <input
                  type="text"
                  value={editableResult.sender_name || ''}
                  onChange={(e) => handleFieldChange('sender_name', e.target.value)}
                  className="result-input"
                  placeholder="거래자명"
                />
              </div>
              <div className="result-item">
                <span className="result-label">🏢 분류:</span>
                <input
                  type="text"
                  value={editableResult.company || ''}
                  onChange={(e) => handleFieldChange('company', e.target.value)}
                  className="result-input"
                  placeholder="분류"
                />
              </div>
              <div className="result-item">
                <span className="result-label">💳 잔액:</span>
                <input
                  type="number"
                  value={editableResult.balance || ''}
                  onChange={(e) => handleFieldChange('balance', e.target.value)}
                  className="result-input"
                  placeholder="잔액 (숫자만)"
                />
              </div>
              
              <div className="json-output">
                <h4>수정된 JSON 결과:</h4>
                <pre>{JSON.stringify(editableResult, null, 2)}</pre>
              </div>
              
              <div style={{ marginTop: 24 }}>
                <button
                  className="submit-btn"
                  style={{ width: 'auto', background: saved ? '#6c757d' : '#007bff' }}
                  onClick={handleSaveToDB}
                  disabled={saved || saveStatus === 'saving'}
                >
                  {saveStatus === 'saving' ? '저장 중...' : saved ? '저장 완료' : 'DB에 저장하기'}
                </button>
                
                {saveStatus === 'success' && (
                  <span style={{ color: '#007bff', marginLeft: 16 }}>DB 저장 성공!</span>
                )}
                {saveStatus === 'error' && (
                  <span style={{ color: 'red', marginLeft: 16 }}>DB 저장 실패</span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default MessageTest; 