import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './UserManagement.css';
import logger from './utils/logger';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editModal, setEditModal] = useState({ open: false, user: null, company: '', company_name: '', fee: '', account: '', newPassword: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [createModal, setCreateModal] = useState({ 
    open: false, 
    username: '', 
    password: '', 
    role: 'user',
    company: '',
    company_name: '',
    fee: '',
    account: ''
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [approvedCompanies, setApprovedCompanies] = useState([]);

  useEffect(() => {
    // 현재 로그인한 사용자 정보 가져오기
    const user = JSON.parse(localStorage.getItem('user'));
    setCurrentUser(user);
    fetchUsers();
    fetchApprovedCompanies();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('user'));
      const response = await axios.get(`/api/users?role=${user?.role}`);
      setUsers(response.data);
      setError(null);
    } catch (err) {
      logger.apiError('GET', '/api/users', err);
      setError(err.response?.data?.error || '사용자 목록을 불러오지 못했습니다.');
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

  const handleCreateUser = async () => {
    const { username, password, role, company, company_name, fee, account } = createModal;
    
    if (!username || !password || !role || !company || !company_name) {
      alert('모든 필드를 입력해주세요.');
      return;
    }
    
    // 수수료 검증 (0-100% 범위)
    if (fee !== '' && (parseFloat(fee) < 0 || parseFloat(fee) > 100)) {
      alert('수수료는 0%에서 100% 사이의 값이어야 합니다.');
      return;
    }
    
    if (password.length < 6) {
      alert('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

        try {
      setCreateLoading(true);
      const user = JSON.parse(localStorage.getItem('user'));
      await axios.post('/api/users',
        { username, password, role, company, company_name, fee: fee || 0, account, userRole: user?.role }
      );
      
      alert('사용자가 성공적으로 생성되었습니다.');
      setCreateModal({ open: false, username: '', password: '', role: 'user', company: '', company_name: '', fee: '', account: '' });
      fetchUsers(); // 사용자 목록 새로고침
    } catch (err) {
      logger.userAction('사용자 생성', { username, role, company }, err);
      alert(err.response?.data?.error || '사용자 생성에 실패했습니다.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEditUser = async () => {
    if (!editModal.company) {
      alert('분류는 필수입니다.');
      return;
    }

    // 수수료 검증 (0-100% 범위)
    if (editModal.fee !== '' && (parseFloat(editModal.fee) < 0 || parseFloat(editModal.fee) > 100)) {
      alert('수수료는 0%에서 100% 사이의 값이어야 합니다.');
      return;
    }

    if (editModal.newPassword && editModal.newPassword.length < 6) {
      alert('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

        try {
      setEditLoading(true);
      const user = JSON.parse(localStorage.getItem('user'));
      const updateData = { company: editModal.company, company_name: editModal.company_name || editModal.company, fee: editModal.fee || 0, account: editModal.account, userRole: user?.role };
      if (editModal.newPassword) {
        updateData.newPassword = editModal.newPassword;
      }
      
      await axios.put(`/api/users/${editModal.user.id}`,
        updateData
      );
      
      alert('사용자 정보가 성공적으로 수정되었습니다.');
      setEditModal({ open: false, user: null, company: '', company_name: '', fee: '', account: '', newPassword: '' });
      fetchUsers(); // 사용자 목록 새로고침
    } catch (err) {
      logger.userAction('사용자 정보 수정', { userId: editModal.user.id, company: editModal.company }, err);
      alert(err.response?.data?.error || '사용자 정보 수정에 실패했습니다.');
    } finally {
      setEditLoading(false);
    }
  };

  // 사용자 삭제 함수
  const handleDeleteUser = async (user) => {
    const confirmMessage = `정말로 ${user.username} 사용자를 삭제하시겠습니까?\n\n⚠️ 주의: 이 사용자의 모든 입출금 내역도 함께 삭제됩니다.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      const currentUser = JSON.parse(localStorage.getItem('user'));
      const response = await axios.delete(`/api/users/${user.id}?userRole=${currentUser?.role}`);
      
      alert(`사용자가 삭제되었습니다.\n삭제된 입출금 내역: ${response.data.deletedDeposits}건`);
      fetchUsers(); // 사용자 목록 새로고침
    } catch (err) {
      logger.userAction('사용자 삭제', { userId: user.id }, err);
      alert(err.response?.data?.error || '사용자 삭제에 실패했습니다.');
    }
  };

  const openCreateModal = () => {
    setCreateModal({ open: true, username: '', password: '', role: 'user', company: '', company_name: '', fee: '', account: '' });
  };

  const closeCreateModal = () => {
    setCreateModal({ open: false, username: '', password: '', role: 'user', company: '', company_name: '', fee: '', account: '' });
  };

  const openEditModal = (user) => {
    setEditModal({ open: true, user, company: user.company, company_name: user.company_name || '', fee: user.fee || '', account: user.account || '', newPassword: '' });
  };

  const closeEditModal = () => {
    setEditModal({ open: false, user: null, company: '', company_name: '', fee: '', account: '', newPassword: '' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    // UTC 시간에 9시간을 더해서 한국시간으로 변환
    const koreanTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    return koreanTime.toLocaleString('ko-KR');
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'super': return '슈퍼 관리자';
      case 'admin': return '관리자';
      case 'user': return '일반 사용자';
      case 'settlement': return '정산';      default: return role;
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'super': return 'role-badge super';
      case 'admin': return 'role-badge admin';
      case 'settlement': return 'role-badge settlement';      case 'user': return 'role-badge user';
      default: return 'role-badge';
    }
  };

  if (loading) {
    return (
      <div className="user-management-container">
        <div className="loading">사용자 목록을 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-management-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="user-management-container">
      <div className="header-section">
        <div>
          <h2>사용자 관리</h2>
          <p className="description">
            {currentUser?.role === 'super' 
              ? '슈퍼 관리자는 모든 사용자를 관리할 수 있습니다.' 
              : '관리자는 일반 사용자를 관리할 수 있습니다.'}
          </p>
        </div>
        {['super', 'admin'].includes(currentUser?.role) && (
          <button className="create-user-btn" onClick={openCreateModal}>
            + 새 사용자 생성
          </button>
        )}
      </div>
      
      <div className="user-table-container">
        <table className="user-table">
          <thead>
            <tr>
              <th>번호</th>
              <th>아이디</th>
              <th>사용자명</th>
              <th>분류</th>
              <th>수수료</th>
              <th>계좌정보</th>
              <th>역할</th>
              <th>가입일</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={9} className="no-data">사용자가 없습니다.</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.username}</td>
                  <td>{user.company_name || user.company}</td>
                  <td>{user.company}</td>
                  <td>{user.fee ? `${user.fee}%` : '0%'}</td>
                  <td>{user.account || '-'}</td>
                  <td>
                    <span className={getRoleBadgeClass(user.role)}>
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td>{formatDate(user.created_at)}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="edit-user-btn"
                        onClick={() => openEditModal(user)}
                        disabled={user.role === 'super' || (currentUser?.role === 'admin' && user.role === 'super')}
                      >
                        수정
                      </button>
                      {/* 삭제 버튼: super는 user/admin만, admin은 user만 */}
                      {(['super', 'admin'].includes(currentUser?.role) && 
                        (currentUser?.role === 'super' || currentUser?.role === 'admin' && ['user', 'settlement'].includes(user.role))) && (
                        <button
                          className="delete-user-btn"
                          onClick={() => handleDeleteUser(user)}
                          disabled={user.role === 'super'}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 사용자 생성 모달 */}
      {createModal.open && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>새 사용자 생성</h3>
              <button className="modal-close" onClick={closeCreateModal}>×</button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label htmlFor="createUsername">아이디 *</label>
                <input
                  type="text"
                  id="createUsername"
                  value={createModal.username}
                  onChange={(e) => setCreateModal({...createModal, username: e.target.value})}
                  placeholder="아이디를 입력하세요"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="createPassword">비밀번호 *</label>
                <input
                  type="password"
                  id="createPassword"
                  value={createModal.password}
                  onChange={(e) => setCreateModal({...createModal, password: e.target.value})}
                  placeholder="비밀번호를 입력하세요 (최소 6자)"
                  minLength={6}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="createCompany">승인된 분류 *</label>
                <select
                  id="createCompany"
                  value={createModal.company}
                  onChange={(e) => setCreateModal({...createModal, company: e.target.value})}
                  required
                >
                  <option value="">분류를 선택하세요</option>
                  {approvedCompanies.map((company) => (
                    <option key={company.id} value={company.name}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="createCompanyName">사용자명</label>
                <input
                  type="text"
                  id="createCompanyName"
                  value={createModal.company_name}
                  onChange={(e) => setCreateModal({...createModal, company_name: e.target.value})}
                  placeholder="사용자명을 입력하세요"
                />
              </div>
              <div className="form-group">
                <label htmlFor="createFee">수수료 (%)</label>
                <input
                  type="number"
                  id="createFee"
                  value={createModal.fee}
                  onChange={(e) => setCreateModal({...createModal, fee: e.target.value})}
                  placeholder="0.00"
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
              <div className="form-group">
                <label htmlFor="createAccount">계좌정보</label>
                <input
                  type="text"
                  id="createAccount"
                  value={createModal.account}
                  onChange={(e) => setCreateModal({...createModal, account: e.target.value})}
                  placeholder="계좌정보를 입력하세요"
                  maxLength={100}
                />
              </div>
              <div className="form-group">
                <label htmlFor="createRole">역할 *</label>
                <select
                  id="createRole"
                  value={createModal.role}
                  onChange={(e) => setCreateModal({...createModal, role: e.target.value})}
                  required
                >
                  {currentUser?.role === 'super' && (
                    <option value="admin">관리자</option>
                  )}
                  <option value="user">일반 사용자</option>
                  <option value="settlement">정산</option>                </select>
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
                onClick={handleCreateUser}
                disabled={createLoading || !createModal.username || !createModal.password || !createModal.company}
              >
                {createLoading ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 사용자 정보 수정 모달 */}
      {editModal.open && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>사용자 정보 수정</h3>
              <button className="modal-close" onClick={closeEditModal}>×</button>
            </div>
            <div className="modal-content">
              <p>사용자: <strong>{editModal.user?.username}</strong></p>
              <div className="form-group">
                <label htmlFor="editCompany">승인된 분류 *</label>
                <select
                  id="editCompany"
                  value={editModal.company}
                  onChange={(e) => setEditModal({...editModal, company: e.target.value})}
                  required
                >
                  <option value="">분류를 선택하세요</option>
                  {approvedCompanies.map((company) => (
                    <option key={company.id} value={company.name}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="editCompanyName">사용자명</label>
                <input
                  type="text"
                  id="editCompanyName"
                  value={editModal.company_name}
                  onChange={(e) => setEditModal({...editModal, company_name: e.target.value})}
                  placeholder="사용자명을 입력하세요"
                />
              </div>
              <div className="form-group">
                <label htmlFor="editFee">수수료 (%)</label>
                <input
                  type="number"
                  id="editFee"
                  value={editModal.fee}
                  onChange={(e) => setEditModal({...editModal, fee: e.target.value})}
                  placeholder="0.00"
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
              <div className="form-group">
                <label htmlFor="editAccount">계좌정보</label>
                <input
                  type="text"
                  id="editAccount"
                  value={editModal.account}
                  onChange={(e) => setEditModal({...editModal, account: e.target.value})}
                  placeholder="계좌정보를 입력하세요"
                  maxLength={100}
                />
              </div>
              <div className="form-group">
                <label htmlFor="editPassword">새 비밀번호 (선택사항)</label>
                <input
                  type="password"
                  id="editPassword"
                  value={editModal.newPassword}
                  onChange={(e) => setEditModal({...editModal, newPassword: e.target.value})}
                  placeholder="변경하지 않으려면 비워두세요 (최소 6자)"
                  minLength={6}
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
                onClick={handleEditUser}
                disabled={editLoading || !editModal.company}
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

export default UserManagement; 