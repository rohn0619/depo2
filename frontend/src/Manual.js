import React, { useState, useEffect } from 'react';
import './Manual.css';

function Manual() {
  const [currentUser, setCurrentUser] = useState(null);
  const [pdfModal, setPdfModal] = useState({ open: false, url: '', title: '' });

  useEffect(() => {
    // 현재 로그인한 사용자 정보 가져오기
    const user = JSON.parse(localStorage.getItem('user'));
    setCurrentUser(user);
  }, []);

  const openPdf = (pdfPath, title) => {
    setPdfModal({ open: true, url: pdfPath, title });
  };

  const closePdf = () => {
    setPdfModal({ open: false, url: '', title: '' });
  };

  return (
    <div className="manual-container">
      <div className="manual-header">
        <h2>📖 사용 메뉴얼</h2>
        <div className="manual-notice">
          <h3>⚠️ 주의사항</h3>
          <p>
            은행마다 문자 형식이 전부 다릅니다.<br />
            또한 은행들은 한번씩 문자 형식을 바꿉니다.<br />
            따라서 문자가 인식이 안되는 현상이 발생하면 문의해주시되 문자도 함께 전달주세요.
          </p>
        </div>
      </div>

      <div className="manual-content">
        <div className="manual-section">
          <h3>🏦 지원하는 은행</h3>
          <div className="bank-list">
            농협 (NH) • 신협 • 우리은행 • 기업은행 (IBK) • 신한은행 • 국민은행 (KB) • 새마을금고 • 토스뱅크 • 카카오뱅크 • 케이뱅크
          </div>
        </div>

        <div className="manual-section">
          <h3>📚 가이드 문서</h3>
          <div className="guide-buttons">
            <button 
              className="guide-btn app-guide"
              onClick={() => openPdf('/guide/앱셋팅가이드.pdf', '앱 설정 가이드')}
            >
              <span className="guide-icon">📱</span>
              <div className="guide-text">
                <h4>앱 설정 가이드</h4>
                <p>모든 사용자가 확인할 수 있는 앱 사용법 가이드</p>
              </div>
            </button>
            
            {['super', 'admin'].includes(currentUser?.role) && (
              <button 
                className="guide-btn admin-guide"
                onClick={() => openPdf('/guide/관리자 페이지 가이드.pdf', '관리자 페이지 가이드')}
              >
                <span className="guide-icon">⚙️</span>
                <div className="guide-text">
                  <h4>관리자 페이지 가이드</h4>
                  <p>관리자만 확인할 수 있는 관리 기능 가이드</p>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PDF 뷰어 모달 */}
      {pdfModal.open && (
        <div className="pdf-modal-overlay" onClick={closePdf}>
          <div className="pdf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pdf-modal-header">
              <h3>{pdfModal.title}</h3>
              <button className="pdf-modal-close" onClick={closePdf}>×</button>
            </div>
            <div className="pdf-modal-content">
              <iframe
                src={`${pdfModal.url}#toolbar=1&navpanes=1&scrollbar=1`}
                title={pdfModal.title}
                width="100%"
                height="100%"
                frameBorder="0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Manual; 