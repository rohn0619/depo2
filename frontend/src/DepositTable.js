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
      const user = JSON.parse(localStorage.getItem('user'));
      
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
  }, [page, search, dateFrom, dateTo, selectedCompany]); // 필터링 조건이 변경될 때마다 데이터 다시 로드
  
  // 데이터 업데이트 트리거에 따른 데이터 업데이트
  useEffect(() => {
    if (dataUpdateTrigger > 0) {
      console.log('📊 입금내역 테이블 데이터 업데이트 (트리거)', dataUpdateTrigger);
      
      const user = JSON.parse(localStorage.getItem('user'));
      
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
  }, [dataUpdateTrigger, page, search, dateFrom, dateTo, selectedCompany]);

  // 분류값 목록 로딩
  useEffect(() => {
    const fetchCompanies = () => {
      const user = JSON.parse(localStorage.getItem('user'));
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
  }, []);

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
      const user = JSON.parse(localStorage.getItem('user'));
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
      const user = JSON.parse(localStorage.getItem('user'));
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
        {['admin', 'super'].includes(JSON.parse(localStorage.getItem('user'))?.role) && (
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
                <th>수수료</th>
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
                <tr><td colSpan={13} style={{ color: '#888' }}>검색 결과가 없습니다.</td></tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className={
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
                    <td>{row.transaction_type === 1 && row.fee_amount > 0 ? formatAmount(row.fee_amount) : '-'}</td>
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
            {Array.from({ length: serverTotalPages }, (_, i) => {
              const pageNum = i + 1;
              
              // 항상 표시할 페이지들
              if (pageNum === 1 || pageNum === serverTotalPages) {
                return (
                  <button
                    key={pageNum}
                    className={page === pageNum ? 'active' : 'pagination-btn'}
                    onClick={() => handlePageChange(pageNum)}
                    disabled={page === pageNum}
                  >
                    {pageNum}
                  </button>
                );
              }
              
              // 현재 페이지 주변 표시
              if (pageNum >= page - 1 && pageNum <= page + 1) {
                return (
                  <button
                    key={pageNum}
                    className={page === pageNum ? 'active' : 'pagination-btn'}
                    onClick={() => handlePageChange(pageNum)}
                    disabled={page === pageNum}
                  >
                    {pageNum}
                  </button>
                );
              }
              
              // 생략 표시
              if (pageNum === page - 2 || pageNum === page + 2) {
                return <span key={pageNum} className="pagination-ellipsis">...</span>;
              }
              
              return null;
            })}
            
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