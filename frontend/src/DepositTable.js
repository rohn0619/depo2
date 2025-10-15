import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import logger from './utils/logger';

function formatAmount(amount) {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원';
}

const PAGE_SIZE = 50;

function DepositTable({ setUnreadCount, dataUpdateTrigger }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [companies, setCompanies] = useState([]);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState('');
  const [updatingCheck, setUpdatingCheck] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  
  // 사용자 정보
  const [user, setUser] = useState(() => {
    const userStr = localStorage.getItem('user');
    const userData = userStr ? JSON.parse(userStr) : null;
    return userData;
  });
  
  // 페이지네이션 상태 (서버 페이지네이션용)
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [serverTotalCount, setServerTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  // 1원 입금 감지 함수
  const isOneWonDeposit = (row) => {
    return row.amount === 1 && row.transaction_type === 1; // 1원이고 입금인 경우
  };

  // 1원 입금 시 싸이렌 소리
  const playSirenSound = () => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance('경고! 1원 입금이 감지되었습니다');
      utterance.lang = 'ko-KR';
      utterance.rate = 0.8;
      utterance.pitch = 1.2;
      utterance.volume = 1.0;
      speechSynthesis.speak(utterance);
    }
  };

  // 일반 음성 알림 (1원이 아닌 경우)
  const playVoiceNotification = () => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance('새로운 내역이 있습니다');
      utterance.lang = 'ko-KR';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;
      speechSynthesis.speak(utterance);
    }
  };

  // 데이터 로딩
  useEffect(() => {
    const fetchData = () => {
      const params = new URLSearchParams({
        role: user?.role || 'user',
        company: user?.company || '',
        page: page.toString(),
        limit: PAGE_SIZE.toString()
      });
      
      // 정산 사용자의 경우 fee 정보 추가
      if (user?.role === 'settlement' && user?.fee) {
        params.append('fee', user.fee.toString());
      }
      
      // 필터링 파라미터 추가
      if (search && search.trim() !== '') {
        params.append('search', search.trim());
      }
      if (selectedCompany && selectedCompany.trim() !== '') {
        params.append('selectedCompany', selectedCompany.trim());
      }
      if (dateFrom && dateFrom.trim() !== '') {
        params.append('dateFrom', dateFrom.trim());
      }
      if (dateTo && dateTo.trim() !== '') {
        params.append('dateTo', dateTo.trim());
      }
      
      axios.get(`/api/deposits?${params}`)
        .then(res => {
          // 새로운 API 응답 구조 처리
          if (res.data.deposits && res.data.pagination) {
            setData(res.data.deposits);
            setServerTotalPages(res.data.pagination.totalPages);
            setServerTotalCount(res.data.pagination.total);
            setHasNext(res.data.pagination.hasNext);
            setHasPrev(res.data.pagination.hasPrev);
          } else {
            // 기존 API 호환성 (배열 형태)
            setData(res.data);
            setServerTotalPages(1);
            setServerTotalCount(res.data.length);
            setHasNext(false);
            setHasPrev(false);
          }
          
          setLoading(false);
          
          // 데이터 로드 후 최신 ID를 localStorage에 저장
          if (res.data.deposits && res.data.deposits.length > 0) {
            const maxId = res.data.deposits[0].id;
            localStorage.setItem('deposits_last_checked_id', maxId);
          } else if (res.data && res.data.length > 0) {
            const maxId = res.data[0].id;
            localStorage.setItem('deposits_last_checked_id', maxId);
          }
        })
        .catch(err => {
          logger.apiError('GET', '/api/deposits', err);
          setError('입금내역을 불러오지 못했습니다.');
          setData([]); // 오류 시 빈 배열로 설정
          setLoading(false);
        });
    };
    
    // 초기 데이터 로딩
    fetchData();
  }, [page, search, dateFrom, dateTo, selectedCompany, user]); // 필터링 조건이 변경될 때마다 데이터 다시 로드
  
  // 데이터 업데이트 트리거에 따른 데이터 업데이트
  useEffect(() => {
    if (dataUpdateTrigger > 0) {
      
      const params = new URLSearchParams({
        role: user?.role || 'user',
        company: user?.company || '',
        page: page.toString(),
        limit: PAGE_SIZE.toString()
      });
      
      // 필터링 파라미터 추가
      if (search && search.trim() !== '') {
        params.append('search', search.trim());
      }
      if (selectedCompany && selectedCompany.trim() !== '') {
        params.append('selectedCompany', selectedCompany.trim());
      }
      if (dateFrom && dateFrom.trim() !== '') {
        params.append('dateFrom', dateFrom.trim());
      }
      if (dateTo && dateTo.trim() !== '') {
        params.append('dateTo', dateTo.trim());
      }
      
      // 정산 사용자는 자신의 분류만 조회
      if (user?.role === 'settlement') {
        params.set('selectedCompany', user.company);
      }
      
      axios.get(`/api/deposits?${params}`)
        .then(res => {
          // 새로운 API 응답 구조 처리
          if (res.data.deposits && res.data.pagination) {
            setData(res.data.deposits);
            setServerTotalPages(res.data.pagination.totalPages);
            setServerTotalCount(res.data.pagination.total);
            setHasNext(res.data.pagination.hasNext);
            setHasPrev(res.data.pagination.hasPrev);
          } else {
            // 기존 API 호환성 (배열 형태)
            setData(res.data);
            setServerTotalPages(1);
            setServerTotalCount(res.data.length);
            setHasNext(false);
            setHasPrev(false);
          }
          
          // 데이터 로드 후 최신 ID를 localStorage에 저장
          if (res.data.deposits && res.data.deposits.length > 0) {
            const maxId = res.data.deposits[0].id;
            localStorage.setItem('deposits_last_checked_id', maxId);
          } else if (res.data && res.data.length > 0) {
            const maxId = res.data[0].id;
            localStorage.setItem('deposits_last_checked_id', maxId);
          }
        })
        .catch(err => {
          logger.apiError('GET', '/api/deposits', err);
        });
    }
  }, [dataUpdateTrigger, page, search, dateFrom, dateTo, selectedCompany, user]);

  // 분류값 목록 로딩
  useEffect(() => {
    const fetchCompanies = () => {
      const params = new URLSearchParams({
        role: user?.role || 'user',
        company: user?.company || ''
      });
      
      axios.get(`/api/deposits/companies?${params}`)
        .then(res => {
          setCompanies(res.data);
        })
        .catch(err => {
          logger.apiError('GET', '/api/deposits/companies', err);
          setCompanies([]);
        });
    };
    fetchCompanies();
  }, [user]);

  // 입금내역 페이지 진입 시 뱃지 초기화
  useEffect(() => {
    setUnreadCount(0);
  }, []);



  // 날짜 형식 변환 (년도 제거, 초 제거)
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    // 2025-07-04 15:18:00 → 07-04 15:18
    return dateStr.substring(5, 16);
  };

  // 빈값이 있거나 입금액이 1원인 행인지 확인하는 함수
  const isProblematicRow = (row) => {
    // 빈값 체크 (null, undefined, 빈 문자열 모두 체크)
    const hasEmptyValue = !row.date || !row.bank || !row.amount || !row.sender || !row.company;
    
    // 입금액이 1원인지 체크
    const isOneWon = row.amount === 1;
    
    return hasEmptyValue || isOneWon;
  };

  // 입금액이 50만원인 행인지 확인하는 함수
  const isFiftyWonRow = (row) => {
    return row.amount === 500000;
  };

  // 서버 사이드 필터링 사용 - 클라이언트 필터링 제거
  // 필터링은 서버에서 처리되므로 클라이언트에서는 불필요

  // 페이지 이동 시 스크롤 상단
  const handlePageChange = (p) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 검색/날짜 변경 시 1페이지로
  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo, selectedCompany]);

  const openModal = (sms) => {
    setModalContent(sms);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setModalContent('');
  };

  // 확인 상태 변경 함수
  const handleCheckChange = async (id, currentChecked, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (updatingCheck === id) return; // 중복 클릭 방지
    
    setUpdatingCheck(id);
    try {
      const params = new URLSearchParams({
        role: user?.role || 'user',
        company: user?.company || ''
      });
      
      await axios.put(`/api/deposits/${id}/check?${params}`, 
        { is_checked: !currentChecked }
      );
      
      // 로컬 상태 업데이트
      setData(prevData => 
        prevData.map(item => 
          item.id === id ? { ...item, is_checked: !currentChecked } : item
        )
      );
      
      // 뱃지 업데이트를 위해 부모 컴포넌트에 알림
      if (setUnreadCount) {
        // 미확인 개수를 다시 계산
        const updatedData = data.map(item => 
          item.id === id ? { ...item, is_checked: !currentChecked } : item
        );
        const uncheckedCount = updatedData.filter(item => !item.is_checked).length;
        setUnreadCount(uncheckedCount);
      }
    } catch (err) {
      logger.userAction('확인 상태 변경', { id, currentChecked }, err);
      alert('확인 상태 변경에 실패했습니다.');
    } finally {
      setUpdatingCheck(null);
    }
  };

  // 삭제 함수
  const handleDelete = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!window.confirm('정말로 이 입금내역을 삭제하시겠습니까?')) {
      return;
    }
    
    if (deletingId === id) return; // 중복 클릭 방지
    
    setDeletingId(id);
    try {
      const params = new URLSearchParams({
        role: user?.role || 'user',
        company: user?.company || ''
      });
      
      await axios.delete(`/api/deposits/${id}?${params}`);
      
      // 로컬 상태에서 삭제
      setData(prevData => prevData.filter(item => item.id !== id));
      
      // 뱃지 업데이트를 위해 부모 컴포넌트에 알림
      if (setUnreadCount) {
        const updatedData = data.filter(item => item.id !== id);
        const uncheckedCount = updatedData.filter(item => !item.is_checked).length;
        setUnreadCount(uncheckedCount);
      }
      
      alert('입금내역이 삭제되었습니다.');
    } catch (err) {
      logger.userAction('입금내역 삭제', { id }, err);
      alert(err.response?.data?.message || '삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  // 엑셀 다운로드 함수
  const handleExcelDownload = async () => {
    if (downloadingExcel) return; // 중복 클릭 방지
    
    setDownloadingExcel(true);
    try {
      const params = new URLSearchParams({
        role: user?.role || 'user',
        company: user?.company || ''
      });
      
      // 정산 사용자의 경우 fee 정보 추가
      if (user?.role === 'settlement' && user?.fee) {
        params.append('fee', user.fee.toString());
      }
      
      // 현재 필터 조건 추가
      if (search && search.trim() !== '') {
        params.append('search', search.trim());
      }
      if (selectedCompany && selectedCompany.trim() !== '') {
        params.append('selectedCompany', selectedCompany.trim());
      }
      if (dateFrom && dateFrom.trim() !== '') {
        params.append('dateFrom', dateFrom.trim());
      }
      if (dateTo && dateTo.trim() !== '') {
        params.append('dateTo', dateTo.trim());
      }
      
      const response = await axios.get(`/api/deposits/export-excel?${params}`, {
        responseType: 'blob'
      });
      
      // 파일 다운로드
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Content-Disposition 헤더에서 파일명 추출
      const contentDisposition = response.headers['content-disposition'];
      let filename = '입출금내역.xlsx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = decodeURIComponent(filenameMatch[1].replace(/['"]/g, ''));
        }
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      logger.userAction('엑셀 다운로드', { search, selectedCompany, dateFrom, dateTo }, err);
      alert('엑셀 다운로드에 실패했습니다.');
    } finally {
      setDownloadingExcel(false);
    }
  };

  return (
    <div className="deposit-table-container">
      <h2>입/출금 내역</h2>
      <div className="deposit-table-searchbar">
        <div className="searchbar-left">
          <input
            type="text"
            placeholder="입금자명 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
          />
          <span className="date-range-sep">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
          />
        </div>
        {['admin', 'super'].includes(user?.role) && (
          <div className="searchbar-right">
            <select
              value={selectedCompany}
              onChange={e => setSelectedCompany(e.target.value)}
            >
              <option value="">전체 분류</option>
              {companies.map((company, index) => (
                <option key={index} value={company}>{company}</option>
              ))}
            </select>
          </div>
        )}
        {user?.role === 'settlement' && (
          <div className="searchbar-right">
            <span className="settlement-company-info">
              담당 분류: <strong>{user.company}</strong>
            </span>
          </div>
        )}
        <div className="searchbar-right">
          <button 
            className="excel-download-btn"
            onClick={handleExcelDownload}
            disabled={downloadingExcel}
            type="button"
          >
            {downloadingExcel ? '다운로드 중...' : '엑셀 다운로드'}
          </button>
        </div>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', color: '#888', padding: '40px 0' }}>로딩 중...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', color: 'red', padding: '40px 0' }}>{error}</div>
      ) : (
        <>
          <table className="deposit-table">
            <thead>
              <tr>
                <th>번호</th>
                <th>날짜</th>
                <th>은행</th>
                <th>구분</th>
                <th>금액</th>
                <th>잔액</th>
                {user?.role !== 'settlement' && <th>수수료</th>}
                {(user?.role === 'settlement' || user?.role === 'admin' || user?.role === 'super') && <th>정산수수료</th>}
                <th>입금자명</th>
                <th>분류</th>
                <th>사용자명</th>
                <th>확인</th>
                <th>원문</th>
                <th>삭제</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan={user?.role === 'settlement' ? 13 : (user?.role === 'admin' || user?.role === 'super') ? 14 : 13} style={{ color: '#888' }}>검색 결과가 없습니다.</td></tr>
              ) : (
                data.map((row, index) => (
                  <tr key={`${row.id}-${index}`} className={
                    isProblematicRow(row) ? 'problematic-row' : 
                    isFiftyWonRow(row) ? 'fifty-won-row' : ''
                  }>
                    <td>{row.id}</td>
                    <td>{formatDate(row.date)}</td>
                    <td>{row.bank}</td>
                    <td>
                      <span className={row.transaction_type === 1 ? 'transaction-deposit' : 'transaction-withdrawal'}>
                        {row.transaction_type === 1 ? '입금' : '출금'}
                      </span>
                    </td>
                    <td>{formatAmount(row.amount)}</td>
                    <td>{row.balance ? formatAmount(row.balance) : '-'}</td>
                    {user?.role !== 'settlement' && (
                      <td>{row.transaction_type === 1 && row.fee_amount > 0 ? formatAmount(row.fee_amount) : '-'}</td>
                    )}
                    {(user?.role === 'settlement' || user?.role === 'admin' || user?.role === 'super') && (
                      <td>
                        {(() => {
                          if (row.transaction_type === 1 && row.fee_amount > 0) {
                            // 정산 사용자의 경우 자신의 fee 사용
                            if (user?.role === 'settlement' && user?.fee) {
                              const settlementFee = Math.round((row.fee_amount * user.fee) / 100);
                              return formatAmount(settlementFee);
                            }
                            // 관리자/슈퍼관리자의 경우 해당 분류의 정산 사용자 fee 사용
                            else if ((user?.role === 'admin' || user?.role === 'super') && row.settlement_fee !== undefined) {
                              return formatAmount(row.settlement_fee || 0);
                            }
                          }
                          return (user?.role === 'settlement' || user?.role === 'admin' || user?.role === 'super') ? '0' : '-';
                        })()}
                      </td>
                    )}
                    <td>{row.sender}</td>
                    <td>{row.company}</td>
                    <td>{row.company_name || '-'}</td>
                    <td>
                      <button 
                        className={`check-btn ${row.is_checked ? 'checked' : 'unchecked'}`}
                        onClick={(e) => handleCheckChange(row.id, row.is_checked, e)}
                        disabled={updatingCheck === row.id}
                        type="button"
                      >
                        {updatingCheck === row.id ? '처리중' : (row.is_checked ? '확인' : '미확인')}
                      </button>
                    </td>
                    <td>
                      <button 
                        className="sms-raw-btn"
                        onClick={(e) => openModal(row.sms_raw)}
                        type="button"
                      >
                        원문
                      </button>
                    </td>
                    <td>
                      <button 
                        className="delete-btn"
                        onClick={(e) => handleDelete(row.id, e)}
                        disabled={deletingId === row.id}
                        type="button"
                      >
                        {deletingId === row.id ? '삭제 중...' : '삭제'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="pagination">
            {/* 이전 페이지 버튼 */}
            {hasPrev && (
              <button
                onClick={() => handlePageChange(page - 1)}
                className="pagination-btn"
              >
                이전
              </button>
            )}
            
            {/* 페이지 번호들 */}
            {(() => {
              const pages = [];
              let lastPageAdded = 0;
              
              // 첫 페이지 항상 표시
              if (serverTotalPages > 0) {
                pages.push(
                  <button
                    key={1}
                    className={page === 1 ? 'active' : 'pagination-btn'}
                    onClick={() => handlePageChange(1)}
                    disabled={page === 1}
                  >
                    1
                  </button>
                );
                lastPageAdded = 1;
              }
              
              // 현재 페이지 주변 표시
              for (let i = Math.max(2, page - 1); i <= Math.min(serverTotalPages - 1, page + 1); i++) {
                if (i > lastPageAdded + 1) {
                  pages.push(<span key={`ellipsis-${i}`} className="pagination-ellipsis">...</span>);
                }
                pages.push(
                  <button
                    key={i}
                    className={page === i ? 'active' : 'pagination-btn'}
                    onClick={() => handlePageChange(i)}
                    disabled={page === i}
                  >
                    {i}
                  </button>
                );
                lastPageAdded = i;
              }
              
              // 마지막 페이지 표시 (총 페이지가 1보다 클 때만)
              if (serverTotalPages > 1) {
                if (serverTotalPages > lastPageAdded + 1) {
                  pages.push(<span key="ellipsis-end" className="pagination-ellipsis">...</span>);
                }
                pages.push(
                  <button
                    key={serverTotalPages}
                    className={page === serverTotalPages ? 'active' : 'pagination-btn'}
                    onClick={() => handlePageChange(serverTotalPages)}
                    disabled={page === serverTotalPages}
                  >
                    {serverTotalPages}
                  </button>
                );
              }
              
              return pages;
            })()}
            
            {/* 다음 페이지 버튼 */}
            {hasNext && (
              <button
                onClick={() => handlePageChange(page + 1)}
                className="pagination-btn"
              >
                다음
              </button>
            )}
          </div>
          
          {/* 페이지네이션 정보 표시 */}
          <div style={{ textAlign: 'center', marginTop: '10px', color: '#666', fontSize: '14px' }}>
            총 {serverTotalCount}건 중 {(page - 1) * PAGE_SIZE + 1}~{Math.min(page * PAGE_SIZE, serverTotalCount)}건 표시
          </div>
          
          {modalOpen && (
            <div className="sms-raw-modal-overlay" onClick={closeModal}>
              <div className="sms-raw-modal" onClick={e => e.stopPropagation()}>
                <div className="sms-raw-modal-header">
                  <span>원문 메시지</span>
                  <button className="sms-raw-modal-close" onClick={closeModal}>×</button>
                </div>
                <pre className="sms-raw-modal-content">{modalContent}</pre>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default DepositTable; 