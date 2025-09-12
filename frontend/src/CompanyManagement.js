import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './CompanyManagement.css';
import logger from './utils/logger';

function CompanyManagement() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createModal, setCreateModal] = useState({ open: false, name: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    setCurrentUser(user);
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('user'));
      const url = ['super', 'admin'].includes(user?.role) 
        ? `/api/companies/admin?role=${user?.role}`
        : '/api/companies';
      
      const response = await axios.get(url);
      setCompanies(response.data);
      setError(null);
    } catch (err) {
      logger.apiError('GET', '/api/companies/admin', err);
      setError(err.response?.data?.error || '분류 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async () => {
    const { name } = createModal;
    
    if (!name || !name.trim()) {
      alert('분류명을 입력해주세요.');
      return;
    }

    try {
      setCreateLoading(true);
      await axios.post('/api/companies', { name: name.trim() });
      
      alert('분류명이 제출되었습니다. 슈퍼 관리자의 승인을 기다려주세요.');
      setCreateModal({ open: false, name: '' });
      fetchCompanies(); // 목록 새로고침
    } catch (err) {
      logger.userAction('분류 생성', { name }, err);
      alert(err.response?.data?.error || '분류 생성에 실패했습니다.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleApproveCompany = async (id, isApproved) => {
    if (!window.confirm(`정말로 이 분류를 ${isApproved ? '승인' : '거부'}하시겠습니까?`)) {
      return;
    }

    try {
      const user = JSON.parse(localStorage.getItem('user'));
      await axios.put(`/api/companies/${id}/approve`, {
        userRole: user?.role,
        is_approved: isApproved
      });
      
      alert(`분류가 ${isApproved ? '승인' : '거부'}되었습니다.`);
      fetchCompanies(); // 목록 새로고침
    } catch (err) {
      logger.userAction('분류 승인/거부', { id, isApproved }, err);
      alert(err.response?.data?.error || '분류 승인에 실패했습니다.');
    }
  };

  const handleDeleteCompany = async (id) => {
    if (!window.confirm('정말로 이 분류를 삭제하시겠습니까?')) {
      return;
    }

    try {
      const user = JSON.parse(localStorage.getItem('user'));
      await axios.delete(`/api/companies/${id}?role=${user?.role}`);
      
      alert('분류가 삭제되었습니다.');
      fetchCompanies(); // 목록 새로고침
    } catch (err) {
      logger.userAction('분류 삭제', { id }, err);
      alert(err.response?.data?.error || '분류 삭제에 실패했습니다.');
    }
  };

  const openCreateModal = () => {
    setCreateModal({ open: true, name: '' });
  };

  const closeCreateModal = () => {
    setCreateModal({ open: false, name: '' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    // UTC 시간에 9시간을 더해서 한국시간으로 변환
    const koreanTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    return koreanTime.toLocaleString('ko-KR');
  };

  const getStatusBadgeClass = (isApproved) => {
    return isApproved ? 'status-badge approved' : 'status-badge pending';
  };

  const getStatusLabel = (isApproved) => {
    return isApproved ? '승인됨' : '승인 대기';
  };

  if (loading) {
    return (
      <div className="company-management-container">
        <div className="loading">분류 목록을 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="company-management-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="company-management-container">
      <div className="header-section">
        <div>
          <h2>분류 관리</h2>
          <p className="description">
            {currentUser?.role === 'super' 
              ? '슈퍼 관리자는 모든 분류를 관리하고 승인할 수 있습니다.' 
              : currentUser?.role === 'admin'
              ? '관리자는 분류 목록을 확인할 수 있습니다.'
              : '일반 사용자는 새로운 분류를 제안할 수 있습니다.'}
          </p>
        </div>
        {currentUser?.role !== 'super' && (
          <button className="create-company-btn" onClick={openCreateModal}>
            + 새 분류 제안
          </button>
        )}
      </div>
      
      <div className="company-table-container">
        <table className="company-table">
          <thead>
            <tr>
              <th>번호</th>
              <th>분류명</th>
              <th>상태</th>
              <th>등록일</th>
              {currentUser?.role === 'super' && <th>관리</th>}
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 ? (
              <tr>
                <td colSpan={currentUser?.role === 'super' ? 5 : 4} className="no-data">
                  분류가 없습니다.
                </td>
              </tr>
            ) : (
              companies.map((company) => (
                <tr key={company.id}>
                  <td>{company.id}</td>
                  <td>{company.name}</td>
                  <td>
                    <span className={getStatusBadgeClass(company.is_approved)}>
                      {getStatusLabel(company.is_approved)}
                    </span>
                  </td>
                  <td>{formatDate(company.created_at)}</td>
                  {currentUser?.role === 'super' && (
                    <td>
                      <div className="action-buttons">
                        {!company.is_approved && (
                          <button
                            className="approve-btn"
                            onClick={() => handleApproveCompany(company.id, true)}
                          >
                            승인
                          </button>
                        )}
                        {company.is_approved && (
                          <button
                            className="reject-btn"
                            onClick={() => handleApproveCompany(company.id, false)}
                          >
                            거부
                          </button>
                        )}
                        <button
                          className="delete-btn"
                          onClick={() => handleDeleteCompany(company.id)}
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 분류 생성 모달 */}
      {createModal.open && (
        <div className="modal-overlay" onClick={closeCreateModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>새 분류 제안</h3>
              <button className="modal-close" onClick={closeCreateModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>분류명</label>
                <input
                  type="text"
                  value={createModal.name}
                  onChange={e => setCreateModal({ ...createModal, name: e.target.value })}
                  placeholder="분류명을 입력하세요"
                  disabled={createLoading}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-cancel" 
                onClick={closeCreateModal}
                disabled={createLoading}
              >
                취소
              </button>
              <button 
                className="btn-confirm" 
                onClick={handleCreateCompany}
                disabled={createLoading}
              >
                {createLoading ? '처리 중...' : '제안하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanyManagement; 