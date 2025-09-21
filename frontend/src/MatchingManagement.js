import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './MatchingManagement.css';
import logger from './utils/logger';

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
          <button className="create-matching-btn" onClick={openCreateModal}>
            + 새 매칭 회원 등록
          </button>
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
    </div>
  );
}

export default MatchingManagement;
