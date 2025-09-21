import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './MatchingManagement.css';
import logger from './utils/logger';
import API_BASE_URL from './config';

// axios 기본 설정
axios.defaults.baseURL = API_BASE_URL;

function MatchingManagement() {
  const [matchings, setMatchings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editModal, setEditModal] = useState({ 
    open: false, 
    matching: null, 
    category: '', 
    member_name: '', 
    account_holder: '', 
    bank_name: '', 
    account_number: '' 
  });
  const [editLoading, setEditLoading] = useState(false);
  const [createModal, setCreateModal] = useState({ 
    open: false, 
    category: '', 
    member_name: '', 
    account_holder: '', 
    bank_name: '', 
    account_number: '' 
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [approvedCompanies, setApprovedCompanies] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [excelUploadModal, setExcelUploadModal] = useState({ 
    open: false, 
    file: null, 
    uploading: false 
  });
  const [uploadResults, setUploadResults] = useState(null);

  useEffect(() => {
    // 현재 로그인한 사용자 정보 가져오기
    const user = JSON.parse(localStorage.getItem('user'));
    setCurrentUser(user);
    fetchMatchings();
    fetchApprovedCompanies();
  }, []);

  const fetchMatchings = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('user'));
      const params = new URLSearchParams();
      
      // 일반 사용자는 자신의 분류만, 슈퍼관리자와 관리자는 모든 분류
      if (user?.role === 'user') {
        params.append('category', user.company);
      } else if (categoryFilter) {
        params.append('category', categoryFilter);
      }
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      // 사용자 역할 정보도 함께 전송
      params.append('userRole', user?.role);
      if (user?.role === 'user') {
        params.append('userCompany', user.company);
      }
      
      const response = await axios.get(`/api/matching?${params}`);
      setMatchings(response.data);
      setError(null);
    } catch (err) {
      logger.apiError('GET', '/api/matching', err);
      setError(err.response?.data?.error || '매칭 회원 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovedCompanies = async () => {
    try {
      const response = await axios.get('/api/companies');
      setApprovedCompanies(response.data);
    } catch (err) {
      logger.apiError('GET', '/api/companies', err);
    }
  };

  const handleCreateMatching = async () => {
    const { category, member_name, account_holder, bank_name, account_number } = createModal;
    
    if (!category || !member_name || !account_holder || !bank_name || !account_number) {
      alert('모든 필드를 입력해주세요.');
      return;
    }
    
    try {
      setCreateLoading(true);
      const user = JSON.parse(localStorage.getItem('user'));
      await axios.post('/api/matching', {
        category,
        member_name,
        account_holder,
        bank_name,
        account_number,
        userRole: user?.role
      });
      
      alert('매칭 회원이 성공적으로 등록되었습니다.');
      setCreateModal({ 
        open: false, 
        category: '', 
        member_name: '', 
        account_holder: '', 
        bank_name: '', 
        account_number: '' 
      });
      fetchMatchings();
    } catch (err) {
      logger.userAction('매칭 회원 등록', { member_name, category }, err);
      alert(err.response?.data?.error || '매칭 회원 등록에 실패했습니다.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEditMatching = async () => {
    const { category, member_name, account_holder, bank_name, account_number } = editModal;
    
    if (!category || !member_name || !account_holder || !bank_name || !account_number) {
      alert('모든 필드를 입력해주세요.');
      return;
    }
    
    try {
      setEditLoading(true);
      const user = JSON.parse(localStorage.getItem('user'));
      await axios.put(`/api/matching/${editModal.matching.id}`, {
        category,
        member_name,
        account_holder,
        bank_name,
        account_number,
        userRole: user?.role
      });
      
      alert('매칭 회원 정보가 성공적으로 수정되었습니다.');
      setEditModal({ 
        open: false, 
        matching: null, 
        category: '', 
        member_name: '', 
        account_holder: '', 
        bank_name: '', 
        account_number: '' 
      });
      fetchMatchings();
    } catch (err) {
      logger.userAction('매칭 회원 정보 수정', { matchingId: editModal.matching.id, category }, err);
      alert(err.response?.data?.error || '매칭 회원 정보 수정에 실패했습니다.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteMatching = async (matching) => {
    const confirmMessage = `정말로 ${matching.member_name} 매칭 회원을 삭제하시겠습니까?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      const currentUser = JSON.parse(localStorage.getItem('user'));
      await axios.delete(`/api/matching/${matching.id}?userRole=${currentUser?.role}`);
      
      alert('매칭 회원이 삭제되었습니다.');
      fetchMatchings();
    } catch (err) {
      logger.userAction('매칭 회원 삭제', { matchingId: matching.id }, err);
      alert(err.response?.data?.error || '매칭 회원 삭제에 실패했습니다.');
    }
  };

  const openCreateModal = () => {
    setCreateModal({ 
      open: true, 
      category: currentUser?.role === 'user' ? currentUser.company : '', 
      member_name: '', 
      account_holder: '', 
      bank_name: '', 
      account_number: '' 
    });
  };

  const closeCreateModal = () => {
    setCreateModal({ 
      open: false, 
      category: '', 
      member_name: '', 
      account_holder: '', 
      bank_name: '', 
      account_number: '' 
    });
  };

  const openEditModal = (matching) => {
    setEditModal({ 
      open: true, 
      matching, 
      category: matching.category, 
      member_name: matching.member_name, 
      account_holder: matching.account_holder, 
      bank_name: matching.bank_name, 
      account_number: matching.account_number 
    });
  };

  const closeEditModal = () => {
    setEditModal({ 
      open: false, 
      matching: null, 
      category: '', 
      member_name: '', 
      account_holder: '', 
      bank_name: '', 
      account_number: '' 
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const koreanTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    return koreanTime.toLocaleString('ko-KR');
  };

  const handleSearch = () => {
    fetchMatchings();
  };

  const handleCategoryFilter = (category) => {
    setCategoryFilter(category);
    // 카테고리 변경 시 즉시 검색
    setTimeout(() => {
      fetchMatchings();
    }, 100);
  };

  // 엑셀 템플릿 다운로드 (프론트엔드에서 직접 생성)
  const downloadTemplate = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      
      // XLSX 라이브러리 import
      const XLSX = await import('xlsx');
      
      // 일반 사용자는 자신의 분류로 고정
      const category = (user?.role === 'user' && user?.company) ? user.company : '분류명';
      
      // 템플릿 데이터 생성
      const templateData = [
        ['분류', '회원명', '예금주명', '은행명', '계좌번호'],
        [category, '홍길동', '홍길동', '국민은행', '123456-78-901234']
      ];
      
      // 워크북 생성
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(templateData);
      
      // 컬럼 너비 설정
      worksheet['!cols'] = [
        { wch: 15 }, // 분류
        { wch: 20 }, // 회원명
        { wch: 20 }, // 예금주명
        { wch: 15 }, // 은행명
        { wch: 25 }  // 계좌번호
      ];
      
      XLSX.utils.book_append_sheet(workbook, worksheet, '매칭회원등록');
      
      // Excel 파일 생성
      const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
      
      // Blob 생성 및 다운로드
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', '매칭회원등록템플릿.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      alert('템플릿이 성공적으로 다운로드되었습니다.');
    } catch (err) {
      logger.apiError('템플릿 다운로드', err);
      alert(`템플릿 다운로드에 실패했습니다: ${err.message}`);
    }
  };

  // 엑셀 파일 업로드
  const handleExcelUpload = async () => {
    if (!excelUploadModal.file) {
      alert('엑셀 파일을 선택해주세요.');
      return;
    }

    try {
      setExcelUploadModal(prev => ({ ...prev, uploading: true }));
      
      const formData = new FormData();
      formData.append('excelFile', excelUploadModal.file);
      formData.append('userRole', currentUser?.role);
      if (currentUser?.role === 'user') {
        formData.append('userCompany', currentUser.company);
      }

      const response = await axios.post('/api/matching/bulk-upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setUploadResults(response.data);
      alert(response.data.message);
      
      if (response.data.results.success > 0) {
        fetchMatchings(); // 성공한 경우 목록 새로고침
      }
      
      setExcelUploadModal({ open: false, file: null, uploading: false });
    } catch (err) {
      logger.apiError('POST', '/api/matching/bulk-upload', err);
      
      if (err.response?.data?.details) {
        // 상세 에러 메시지가 있는 경우
        const errorMessage = err.response.data.details.slice(0, 10).join('\n');
        alert(`업로드 실패:\n${errorMessage}${err.response.data.details.length > 10 ? '\n...' : ''}`);
      } else {
        alert(err.response?.data?.error || '엑셀 파일 업로드에 실패했습니다.');
      }
      
      setExcelUploadModal(prev => ({ ...prev, uploading: false }));
    }
  };

  // 파일 선택 핸들러
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // 파일 확장자 검증
      const allowedExtensions = ['.xlsx', '.xls'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      
      if (!allowedExtensions.includes(fileExtension)) {
        alert('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.');
        return;
      }
      
      // 파일 크기 검증 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('파일 크기는 10MB를 초과할 수 없습니다.');
        return;
      }
      
      setExcelUploadModal(prev => ({ ...prev, file }));
    }
  };

  // 엑셀 업로드 모달 열기
  const openExcelUploadModal = () => {
    setExcelUploadModal({ open: true, file: null, uploading: false });
    setUploadResults(null);
  };

  // 엑셀 업로드 모달 닫기
  const closeExcelUploadModal = () => {
    setExcelUploadModal({ open: false, file: null, uploading: false });
    setUploadResults(null);
  };

  // 검색어나 카테고리 필터 변경 시 자동 검색
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchMatchings();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, categoryFilter]);

  if (loading) {
    return (
      <div className="matching-management-container">
        <div className="loading">매칭 회원 목록을 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="matching-management-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="matching-management-container">
      <div className="header-section">
        <div>
          <h2>매칭 관리</h2>
          <p className="description">
            {currentUser?.role === 'user' 
              ? '자신의 분류에 해당하는 매칭 회원을 관리할 수 있습니다.' 
              : '모든 분류의 매칭 회원을 관리할 수 있습니다.'}
          </p>
        </div>
        {['super', 'admin', 'user'].includes(currentUser?.role) && (
          <div className="action-buttons">
            <button className="create-matching-btn" onClick={openCreateModal}>
              + 새 매칭 회원 등록
            </button>
            <button className="excel-upload-btn" onClick={openExcelUploadModal}>
              📊 엑셀 대량 등록
            </button>
            <button className="template-download-btn" onClick={downloadTemplate}>
              📥 템플릿 다운로드
            </button>
          </div>
        )}
      </div>

      {/* 검색 및 필터 섹션 */}
      <div className="filter-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="회원명으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button onClick={handleSearch} className="search-btn">검색</button>
        </div>
        
        {['super', 'admin'].includes(currentUser?.role) && (
          <div className="category-filter">
            <select
              value={categoryFilter}
              onChange={(e) => handleCategoryFilter(e.target.value)}
              className="category-select"
            >
              <option value="">전체 분류</option>
              {approvedCompanies.map((company) => (
                <option key={company.id} value={company.name}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      
      <div className="matching-table-container">
        <table className="matching-table">
          <thead>
            <tr>
              <th>번호</th>
              <th>분류</th>
              <th>회원명</th>
              <th>예금주명</th>
              <th>은행명</th>
              <th>계좌번호</th>
              <th>등록일</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {matchings.length === 0 ? (
              <tr>
                <td colSpan={8} className="no-data">매칭 회원이 없습니다.</td>
              </tr>
            ) : (
              matchings.map((matching) => (
                <tr key={matching.id}>
                  <td>{matching.id}</td>
                  <td>{matching.category}</td>
                  <td>{matching.member_name}</td>
                  <td>{matching.account_holder}</td>
                  <td>{matching.bank_name}</td>
                  <td>{matching.account_number}</td>
                  <td>{formatDate(matching.created_at)}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="edit-matching-btn"
                        onClick={() => openEditModal(matching)}
                      >
                        수정
                      </button>
                      <button
                        className="delete-matching-btn"
                        onClick={() => handleDeleteMatching(matching)}
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 매칭 회원 등록 모달 */}
      {createModal.open && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>새 매칭 회원 등록</h3>
              <button className="modal-close" onClick={closeCreateModal}>×</button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label htmlFor="createCategory">분류 *</label>
                <select
                  id="createCategory"
                  value={createModal.category}
                  onChange={(e) => setCreateModal({...createModal, category: e.target.value})}
                  required
                >
                  <option value="">분류를 선택하세요</option>
                  {currentUser?.role === 'user' ? (
                    // 일반 사용자는 자신의 분류만 선택 가능
                    <option value={currentUser.company}>
                      {currentUser.company}
                    </option>
                  ) : (
                    // 슈퍼관리자와 관리자는 모든 분류 선택 가능
                    approvedCompanies.map((company) => (
                      <option key={company.id} value={company.name}>
                        {company.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="createMemberName">회원명 *</label>
                <input
                  type="text"
                  id="createMemberName"
                  value={createModal.member_name}
                  onChange={(e) => setCreateModal({...createModal, member_name: e.target.value})}
                  placeholder="회원명을 입력하세요"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="createAccountHolder">예금주명 *</label>
                <input
                  type="text"
                  id="createAccountHolder"
                  value={createModal.account_holder}
                  onChange={(e) => setCreateModal({...createModal, account_holder: e.target.value})}
                  placeholder="예금주명을 입력하세요"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="createBankName">은행명 *</label>
                <input
                  type="text"
                  id="createBankName"
                  value={createModal.bank_name}
                  onChange={(e) => setCreateModal({...createModal, bank_name: e.target.value})}
                  placeholder="은행명을 입력하세요"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="createAccountNumber">계좌번호 *</label>
                <input
                  type="text"
                  id="createAccountNumber"
                  value={createModal.account_number}
                  onChange={(e) => setCreateModal({...createModal, account_number: e.target.value})}
                  placeholder="계좌번호를 입력하세요"
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="cancel-btn" 
                onClick={closeCreateModal}
                disabled={createLoading}
              >
                취소
              </button>
              <button 
                className="confirm-btn" 
                onClick={handleCreateMatching}
                disabled={createLoading || !createModal.category || !createModal.member_name || !createModal.account_holder || !createModal.bank_name || !createModal.account_number}
              >
                {createLoading ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 매칭 회원 정보 수정 모달 */}
      {editModal.open && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>매칭 회원 정보 수정</h3>
              <button className="modal-close" onClick={closeEditModal}>×</button>
            </div>
            <div className="modal-content">
              <p>매칭 회원: <strong>{editModal.matching?.member_name}</strong></p>
              <div className="form-group">
                <label htmlFor="editCategory">분류 *</label>
                <select
                  id="editCategory"
                  value={editModal.category}
                  onChange={(e) => setEditModal({...editModal, category: e.target.value})}
                  required
                >
                  <option value="">분류를 선택하세요</option>
                  {currentUser?.role === 'user' ? (
                    // 일반 사용자는 자신의 분류만 선택 가능
                    <option value={currentUser.company}>
                      {currentUser.company}
                    </option>
                  ) : (
                    // 슈퍼관리자와 관리자는 모든 분류 선택 가능
                    approvedCompanies.map((company) => (
                      <option key={company.id} value={company.name}>
                        {company.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="editMemberName">회원명 *</label>
                <input
                  type="text"
                  id="editMemberName"
                  value={editModal.member_name}
                  onChange={(e) => setEditModal({...editModal, member_name: e.target.value})}
                  placeholder="회원명을 입력하세요"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="editAccountHolder">예금주명 *</label>
                <input
                  type="text"
                  id="editAccountHolder"
                  value={editModal.account_holder}
                  onChange={(e) => setEditModal({...editModal, account_holder: e.target.value})}
                  placeholder="예금주명을 입력하세요"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="editBankName">은행명 *</label>
                <input
                  type="text"
                  id="editBankName"
                  value={editModal.bank_name}
                  onChange={(e) => setEditModal({...editModal, bank_name: e.target.value})}
                  placeholder="은행명을 입력하세요"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="editAccountNumber">계좌번호 *</label>
                <input
                  type="text"
                  id="editAccountNumber"
                  value={editModal.account_number}
                  onChange={(e) => setEditModal({...editModal, account_number: e.target.value})}
                  placeholder="계좌번호를 입력하세요"
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="cancel-btn" 
                onClick={closeEditModal}
                disabled={editLoading}
              >
                취소
              </button>
              <button 
                className="confirm-btn" 
                onClick={handleEditMatching}
                disabled={editLoading || !editModal.category || !editModal.member_name || !editModal.account_holder || !editModal.bank_name || !editModal.account_number}
              >
                {editLoading ? '처리 중...' : '수정'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 엑셀 업로드 모달 */}
      {excelUploadModal.open && (
        <div className="modal-overlay">
          <div className="modal excel-upload-modal">
            <div className="modal-header">
              <h3>엑셀 대량 등록</h3>
              <button className="modal-close" onClick={closeExcelUploadModal}>×</button>
            </div>
            <div className="modal-content">
              <div className="upload-instructions">
                <h4>📋 업로드 가이드</h4>
                <ul>
                  <li>엑셀 파일은 .xlsx 또는 .xls 형식이어야 합니다.</li>
                  <li>파일 크기는 10MB를 초과할 수 없습니다.</li>
                  <li>첫 번째 행은 반드시 헤더여야 합니다: 분류, 회원명, 예금주명, 은행명, 계좌번호</li>
                  <li>모든 필드는 필수 입력 항목입니다.</li>
                </ul>
              </div>
              
              <div className="file-upload-section">
                <div className="file-input-wrapper">
                  <input
                    type="file"
                    id="excelFile"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="file-input"
                  />
                  <label htmlFor="excelFile" className="file-input-label">
                    {excelUploadModal.file ? excelUploadModal.file.name : '엑셀 파일 선택'}
                  </label>
                </div>
                
                {excelUploadModal.file && (
                  <div className="file-info">
                    <p>선택된 파일: {excelUploadModal.file.name}</p>
                    <p>파일 크기: {(excelUploadModal.file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                )}
              </div>

              {uploadResults && (
                <div className="upload-results">
                  <h4>📊 업로드 결과</h4>
                  <div className="results-summary">
                    <div className="result-item success">
                      <span className="result-label">성공:</span>
                      <span className="result-value">{uploadResults.results.success}건</span>
                    </div>
                    <div className="result-item failed">
                      <span className="result-label">실패:</span>
                      <span className="result-value">{uploadResults.results.failed}건</span>
                    </div>
                  </div>
                  
                  {uploadResults.results.errors.length > 0 && (
                    <div className="error-details">
                      <h5>❌ 실패 상세 내역</h5>
                      <div className="error-list">
                        {uploadResults.results.errors.slice(0, 10).map((error, index) => (
                          <div key={index} className="error-item">{error}</div>
                        ))}
                        {uploadResults.results.errors.length > 10 && (
                          <div className="error-item">... 및 {uploadResults.results.errors.length - 10}건 더</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="cancel-btn" 
                onClick={closeExcelUploadModal}
                disabled={excelUploadModal.uploading}
              >
                취소
              </button>
              <button 
                className="confirm-btn" 
                onClick={handleExcelUpload}
                disabled={excelUploadModal.uploading || !excelUploadModal.file}
              >
                {excelUploadModal.uploading ? '업로드 중...' : '업로드'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MatchingManagement;
