import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import Login from './Login';
import MessageTest from './MessageTest';
import DepositTable from './DepositTable';
import UserManagement from './UserManagement';
import CompanyManagement from './CompanyManagement';
import Settlement from './Settlement';
import Manual from './Manual';
import Maintenance from './Maintenance';
import API_BASE_URL from './config';
import logger from './utils/logger';
import pollingClient from './utils/pollingClient';
import { useMaintenanceCheck, toggleMaintenanceMode } from './utils/maintenanceCheck';

function AppContent() {
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const token = localStorage.getItem('token');
    return !!token;
  });
  const [user, setUser] = useState(() => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isTogglingMaintenance, setIsTogglingMaintenance] = useState(false);
  const [dataUpdateTrigger, setDataUpdateTrigger] = useState(0); // 입금내역 데이터 업데이트 트리거
  const prevMaxId = useRef(0);
  const first = useRef(true);
  const currentPath = useRef(location.pathname);
  
  // 점검 모드 체크
  useMaintenanceCheck();

    // 일반 알림 음성 (입금/출금 공통)
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

  // 1원 입금 앰뷸런스 소리 (실제 효과음 파일 재생, 3.5초)
  const playSirenSound = () => {
      try {
          const audio = new Audio(process.env.PUBLIC_URL + '/siren.mp3');
          audio.volume = 1.0;
          audio.play();
          
          // 3.5초 후 자동 정지
          setTimeout(() => {
              audio.pause();
              audio.currentTime = 0;
          }, 3250);
          
      } catch (error) {
          console.error('앰뷸런스 소리 재생 실패:', error);
          // 폴백: 기존 TTS 사용
          if ('speechSynthesis' in window) {
              const utterance = new SpeechSynthesisUtterance('경고! 1원 입금이 감지되었습니다');
              utterance.lang = 'ko-KR';
              utterance.rate = 0.8;
              utterance.pitch = 1.2;
              utterance.volume = 1.0;
              speechSynthesis.speak(utterance);
          }
      }
  };

  // 로그인 처리 함수
  const handleLogin = async (loginData) => {
    setIsLoggedIn(true);
    setUser(loginData.user);
    
    console.log('🔐 로그인 성공, 폴링 시작 예정', { 
      user: loginData.user.username,
      timestamp: new Date().toISOString()
    });
    
    // 폴링 시작 (정산 사용자 제외)
    if (loginData.user?.role !== 'settlement') {
      await pollingClient.start();
    }
    
    // 로그인 시 미확인 개수를 가져와서 뱃지 설정 (정산 사용자 제외)
    if (loginData.user?.role !== 'settlement') {
      const token = loginData.token;
      const user = loginData.user;
      const params = new URLSearchParams({
        role: user?.role || 'user',
        company: user?.company || ''
      });
      
      fetch(`${API_BASE_URL}/api/deposits/unchecked-count?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => {
          setUnreadCount(data?.count || 0);
        })
        .catch(error => {
          logger.apiError('GET', '/api/deposits/unchecked-count', error);
          setUnreadCount(0);
        });
    }
    
    // 로그인 후에는 페이지 이동하지 않음 (폴링이 정상적으로 시작되도록)
  };

  // 로그아웃 처리 함수
  const handleLogout = () => {
    // 폴링 중지
    pollingClient.stop();
    
    // 모든 localStorage 데이터 초기화
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('polling_active');
    localStorage.removeItem('polling_restart_needed');
    localStorage.removeItem('deposits_last_checked_id');
    
    // 상태 초기화
    setIsLoggedIn(false);
    setUser(null);
    setUnreadCount(0);
    setDataUpdateTrigger(0);
    
    // 최초 페이지로 이동
    window.location.href = '/';
  };

  // 폴링 이벤트 핸들러 설정 (정산 사용자 제외)
  useEffect(() => {
    if (!isLoggedIn || user?.role === 'settlement') return;

    // 새 입금 내역 알림 핸들러
    pollingClient.setNewDepositCallback((data) => {
      logger.info('새 입금 내역 발견', data);
      
      // 음성 알림 재생 (모든 페이지에서)
      playVoiceNotification();
      
      // 입금내역 페이지에 있는 경우 데이터 업데이트 트리거 설정
      if (currentPath.current === '/deposits') {
        console.log('💰 입금내역 페이지에서 입금 알림 - 데이터 업데이트 트리거');
        setDataUpdateTrigger(prev => prev + 1);
      } else {
        // 다른 페이지에 있는 경우 뱃지 카운트 증가
        setUnreadCount(prev => prev + 1);
      }
    });

    // 1원 입금 알림 핸들러
    pollingClient.setOneWonDepositCallback((data) => {
      logger.info('1원 입금 발견', data);
      
      // 싸이렌 소리 재생
      playSirenSound();
      
      // 입금내역 페이지에 있는 경우 데이터 업데이트 트리거 설정
      if (currentPath.current === '/deposits') {
        console.log('🚨 입금내역 페이지에서 1원 입금 알림 - 데이터 업데이트 트리거');
        setDataUpdateTrigger(prev => prev + 1);
      } else {
        // 다른 페이지에 있는 경우 뱃지 카운트 증가
        setUnreadCount(prev => prev + 1);
      }
    });

    // 출금 알림 핸들러
    pollingClient.setNewWithdrawalCallback((data) => {
      logger.info('새 출금 내역 발견', data);
      
      // 일반 알림 음성 재생
      playVoiceNotification();
      
      // 입금내역 페이지에 있는 경우 데이터 업데이트 트리거 설정
      if (currentPath.current === '/deposits') {
        console.log('💸 입금내역 페이지에서 출금 알림 - 데이터 업데이트 트리거');
        setDataUpdateTrigger(prev => prev + 1);
      } else {
        // 다른 페이지에 있는 경우 뱃지 카운트 증가
        setUnreadCount(prev => prev + 1);
      }
    });

    // 미확인 개수 업데이트 핸들러
    pollingClient.setUncheckedCountUpdateCallback((data) => {
      logger.info('미확인 개수 업데이트', data);
      
      // 입금내역 페이지가 아닌 경우에만 뱃지 업데이트
      if (currentPath.current !== '/deposits') {
        setUnreadCount(data.count);
      }
    });

    // 새로고침 후 폴링 재시작 체크 (한 번만 실행)
    const shouldRestartPolling = localStorage.getItem('polling_restart_needed') === 'true';
    if (shouldRestartPolling && !pollingClient.isActive()) {
      console.log('🔄 폴링 재시작 (새로고침 후)');
      localStorage.removeItem('polling_restart_needed'); // 플래그 제거
      (async () => {
        await pollingClient.start();
      })();
    }

    return () => {
      // 컴포넌트 언마운트 시 콜백 제거
      pollingClient.setNewDepositCallback(null);
      pollingClient.setOneWonDepositCallback(null);
      pollingClient.setNewWithdrawalCallback(null);
      pollingClient.setUncheckedCountUpdateCallback(null);
    };
  }, [isLoggedIn]);

  // 현재 경로 업데이트
  useEffect(() => {
    currentPath.current = location.pathname;
    
    // 콘솔에 직접 출력
    console.log('🔄 페이지 경로 변경', { 
      path: location.pathname, 
      pollingActive: pollingClient.isActive(),
      timestamp: new Date().toISOString()
    });
    
    logger.info('페이지 경로 변경', { 
      path: location.pathname, 
      pollingActive: pollingClient.isActive(),
      timestamp: new Date().toISOString()
    });
  }, [location.pathname]);

  // 입금내역 메뉴 클릭 시 카운트 제거 및 lastCheckedId 업데이트
  const handleDepositsMenuClick = () => {
    setUnreadCount(0);
    
    // 현재 최신 데이터를 가져와서 lastCheckedId 업데이트
    const user = JSON.parse(localStorage.getItem('user'));
    const params = new URLSearchParams({
      role: user?.role || 'user',
      company: user?.company || ''
    });
    
    fetch(`${API_BASE_URL}/api/deposits?${params}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          const maxId = data[0].id;
          localStorage.setItem('deposits_last_checked_id', maxId);
        }
      })
      .catch(error => {
        logger.apiError('GET', '/api/deposits', error);
      });
  };

  // 점검 모드 토글 처리
  const handleMaintenanceToggle = async () => {
    if (isTogglingMaintenance) return;
    
    setIsTogglingMaintenance(true);
    try {
      const result = await toggleMaintenanceMode();
      setIsMaintenanceMode(result.maintenance_mode);
      logger.info('점검 모드 토글 성공', result);
    } catch (error) {
      logger.error('점검 모드 토글 실패', error);
      alert('점검 모드 변경에 실패했습니다: ' + error.message);
    } finally {
      setIsTogglingMaintenance(false);
    }
  };

  // 점검 모드 상태 확인
  useEffect(() => {
    const checkMaintenanceStatus = async () => {
      try {
        const response = await fetch('/api/maintenance/status');
        if (response.ok) {
          const data = await response.json();
          setIsMaintenanceMode(data.maintenance_mode);
        }
      } catch (error) {
        logger.error('점검 모드 상태 확인 실패', error);
      }
    };

    if (user?.role === 'super') {
      checkMaintenanceStatus();
    }
  }, [user?.role]);

  // 로그인 상태 확인
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user && !isLoggedIn) {
      console.log('🔄 페이지 새로고침 감지, 로그인 상태 복구');
      const userData = JSON.parse(user);
      setIsLoggedIn(true);
      setUser(userData);
    }
  }, []);
  
  // 새로고침 후 폴링 재시작 (로그인 상태와 관계없이)
  useEffect(() => {
    const pollingActive = localStorage.getItem('polling_active');
    const shouldRestartPolling = localStorage.getItem('polling_restart_needed') === 'true';
    
    if (isLoggedIn && pollingActive === 'true' && shouldRestartPolling && !pollingClient.isActive()) {
      console.log('🔄 폴링 재시작 (새로고침 후)');
      localStorage.removeItem('polling_restart_needed'); // 플래그 제거
      (async () => {
        await pollingClient.start();
      })();
    }
  }, [isLoggedIn]);
  
  // 페이지 로드 시 폴링 재시작 플래그 설정
  useEffect(() => {
    const pollingActive = localStorage.getItem('polling_active');
    if (pollingActive === 'true') {
      localStorage.setItem('polling_restart_needed', 'true');
    }
  }, []);

  // 로그인되지 않은 경우 로그인 페이지 표시
  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  // 점검 페이지인 경우 사이드바 없이 점검 페이지만 표시
  if (location.pathname === '/maintenance') {
    return <Maintenance />;
  }

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title">관리자 페이지</div>
          <div className="user-info">
            <span>{user?.name || '사용자'}</span>
            <button onClick={handleLogout} className="logout-button">로그아웃</button>
          </div>
        </div>
        <nav>
          <ul>
            {/* 정산 사용자는 입금 내역과 정산 페이지만 표시 */}
            {user?.role === 'settlement' ? (
              <>
                <li>
                  <NavLink to="/deposits" className={({ isActive }) => isActive ? 'active' : ''} onClick={handleDepositsMenuClick}>
                    입/출금 내역
                    {unreadCount > 0 && (
                      <span className="unread-badge">{unreadCount}</span>
                    )}
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/settlement" className={({ isActive }) => isActive ? 'active' : ''}>정산</NavLink>
                </li>
              </>
            ) : (
              <>
                <li>
                  <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>문자 테스트</NavLink>
                </li>
                <li>
                  <NavLink to="/deposits" className={({ isActive }) => isActive ? 'active' : ''} onClick={handleDepositsMenuClick}>
                    입/출금 내역
                    {unreadCount > 0 && (
                      <span className="unread-badge">{unreadCount}</span>
                    )}
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/settlement" className={({ isActive }) => isActive ? 'active' : ''}>정산</NavLink>
                </li>
                {user?.role !== 'user' && (
                  <li>
                    <NavLink to="/manual" className={({ isActive }) => isActive ? 'active' : ''}>📖 메뉴얼</NavLink>
                  </li>
                )}
                {['super', 'admin'].includes(user?.role) && (
                  <li>
                    <NavLink to="/users" className={({ isActive }) => isActive ? 'active' : ''}>사용자 관리</NavLink>
                    <NavLink to="/companies" className={({ isActive }) => isActive ? 'active' : ''}>분류 관리</NavLink>
                  </li>
                )}
              </>
            )}
          </ul>
        </nav>
        {user?.role === 'super' && (
          <div className="maintenance-toggle-item">
            <button 
              onClick={handleMaintenanceToggle}
              disabled={isTogglingMaintenance}
              className={`maintenance-toggle-button ${isMaintenanceMode ? 'active' : ''}`}
            >
              {isTogglingMaintenance ? '처리 중...' : (isMaintenanceMode ? '🔧 점검 모드 해제' : '🔧 점검 모드 활성화')}
            </button>
          </div>
        )}
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={user?.role === 'settlement' ? <Navigate to="/deposits" replace /> : <MessageTest />} />
          <Route path="/deposits" element={<DepositTable setUnreadCount={setUnreadCount} dataUpdateTrigger={dataUpdateTrigger} />} />
          <Route path="/settlement" element={<Settlement />} />
          <Route path="/manual" element={<Manual />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/companies" element={<CompanyManagement />} />
          <Route path="*" element={<Navigate to={user?.role === 'settlement' ? "/deposits" : "/"} replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App; 