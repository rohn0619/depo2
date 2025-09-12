import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Settlement.css';
import logger from './utils/logger';

function Settlement() {
  const [user, setUser] = useState(null);
  const [basicStats, setBasicStats] = useState({
    today: { count: 0, total_amount: 0 },
    yesterday: { count: 0, total_amount: 0 },
    week: { count: 0, total_amount: 0 },
    month: { count: 0, total_amount: 0 }
  });
  const [withdrawalStats, setWithdrawalStats] = useState({
    today: { count: 0, total_amount: 0 },
    yesterday: { count: 0, total_amount: 0 },
    week: { count: 0, total_amount: 0 },
    month: { count: 0, total_amount: 0 }
  });
  const [dailyAnalysis, setDailyAnalysis] = useState([]);
  const [weeklyAnalysis, setWeeklyAnalysis] = useState([]);
  const [monthlyAnalysis, setMonthlyAnalysis] = useState([]);
  const [senderAnalysis, setSenderAnalysis] = useState([]);
  const [companyAnalysis, setCompanyAnalysis] = useState([]);
  const [allCompanies, setAllCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedCompanyMonth, setSelectedCompanyMonth] = useState('');
  const scrollPositionRef = useRef(0);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'));
    setUser(userData);
    
    // 관리자만 모든 분류 목록을 가져옴
    if (userData?.role !== 'user') {
      fetchAllCompanies();
    }
    
    fetchData();
    fetchPeriodAnalysis();
  }, []);

  useEffect(() => {
    // 현재 스크롤 위치 저장
    scrollPositionRef.current = window.scrollY;
    setIsUpdating(true);
    fetchData();
    fetchPeriodAnalysis();
  }, [selectedCompany, selectedMonth, selectedCompanyMonth, user]);

  // 필터 변경 시 스크롤 위치 유지
  useEffect(() => {
    if (scrollPositionRef.current > 0 && !isUpdating) {
      // 다음 렌더링 사이클에서 스크롤 위치 복원
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPositionRef.current);
      });
    }
  }, [basicStats, dailyAnalysis, weeklyAnalysis, monthlyAnalysis, senderAnalysis, companyAnalysis, isUpdating]);

  const fetchAllCompanies = async () => {
    try {
      const token = localStorage.getItem('token');
      const currentUser = JSON.parse(localStorage.getItem('user'));
      
      // 관리자만 모든 분류 목록을 가져옴
      if (currentUser?.role === 'user') {
        return;
      }
      
      // 모든 분류 목록 가져오기 (필터 적용 없이)
      const allCompaniesResponse = await axios.get('/api/settlement/all-companies', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setAllCompanies(allCompaniesResponse.data);
    } catch (err) {
      logger.apiError('GET', '/api/settlement/all-companies', err);
    }
  };

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const currentUser = JSON.parse(localStorage.getItem('user'));
      
      // 기본 통계 데이터 가져오기 (분류 필터 적용)
      const [yesterdayStats, todayStats, weekStats, monthStats, yesterdayWithdrawalStats, todayWithdrawalStats, weekWithdrawalStats, monthWithdrawalStats] = await Promise.all([
        axios.get(`/api/settlement/basic-stats?period=yesterday${selectedCompany ? `&company=${selectedCompany}` : ''}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`/api/settlement/basic-stats?period=today${selectedCompany ? `&company=${selectedCompany}` : ''}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`/api/settlement/basic-stats?period=week${selectedCompany ? `&company=${selectedCompany}` : ''}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`/api/settlement/basic-stats?period=month${selectedCompany ? `&company=${selectedCompany}` : ''}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`/api/settlement/withdrawal-stats?period=yesterday${selectedCompany ? `&company=${selectedCompany}` : ''}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`/api/settlement/withdrawal-stats?period=today${selectedCompany ? `&company=${selectedCompany}` : ''}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`/api/settlement/withdrawal-stats?period=week${selectedCompany ? `&company=${selectedCompany}` : ''}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`/api/settlement/withdrawal-stats?period=month${selectedCompany ? `&company=${selectedCompany}` : ''}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      setBasicStats({
        yesterday: yesterdayStats.data,
        today: todayStats.data,
        week: weekStats.data,
        month: monthStats.data
      });

      setWithdrawalStats({
        yesterday: yesterdayWithdrawalStats.data,
        today: todayWithdrawalStats.data,
        week: weekWithdrawalStats.data,
        month: monthWithdrawalStats.data
      });

      // 입금자 분석 데이터 가져오기 (분류 및 월별 필터 적용)
      let senderUrl = '/api/settlement/sender-analysis?';
      const senderParams = [];
      if (selectedCompany) {
        senderParams.push(`company=${selectedCompany}`);
      }
      if (selectedMonth) {
        senderParams.push(`month=${selectedMonth}`);
      }
      if (senderParams.length > 0) {
        senderUrl += senderParams.join('&');
      } else {
        senderUrl = senderUrl.slice(0, -1); // 마지막 ? 제거
      }
      
      const senderResponse = await axios.get(senderUrl, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 60000 // 60초 타임아웃
      });
      setSenderAnalysis(senderResponse.data);

      // 관리자인 경우 분류별 분석 데이터 가져오기 (월별 필터 적용)
      if (currentUser?.role !== 'user') {
        try {
          let companyUrl = '/api/settlement/company-analysis?';
          if (selectedCompanyMonth) {
            companyUrl += `month=${selectedCompanyMonth}`;
          }
          const companyResponse = await axios.get(companyUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          setCompanyAnalysis(companyResponse.data);
        } catch (err) {
          logger.apiError('GET', '/api/settlement/company-analysis', err);
          // 에러가 발생해도 다른 데이터는 정상적으로 표시
        }
      }

      setError(null);
    } catch (err) {
      logger.apiError('GET', '/api/settlement/*', err);
      setError(err.response?.data?.error || '데이터를 불러오지 못했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  const fetchPeriodAnalysis = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // 일별, 주별, 월별 데이터를 각각 가져오기
      const [dailyResponse, weeklyResponse, monthlyResponse] = await Promise.all([
        axios.get(`/api/settlement/period-analysis?period=daily&days=7${selectedCompany ? `&company=${selectedCompany}` : ''}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`/api/settlement/period-analysis?period=weekly&days=28${selectedCompany ? `&company=${selectedCompany}` : ''}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`/api/settlement/period-analysis?period=monthly${selectedCompany ? `&company=${selectedCompany}` : ''}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      // 데이터 개수 제한 (최신 데이터만)
      setDailyAnalysis(dailyResponse.data.slice(-7));
      setWeeklyAnalysis(weeklyResponse.data.slice(-4));
      
      // 월별 데이터 처리
      const currentMonth = new Date().getMonth() + 1; // 0-based이므로 +1
      const processedMonthlyData = monthlyResponse.data.slice(-currentMonth);
      setMonthlyAnalysis(processedMonthlyData);
    } catch (err) {
      logger.apiError('GET', '/api/settlement/period-analysis', err);
    }
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('ko-KR').format(Math.floor(amount)) + '원';
  };

  const formatAmountShort = (amount) => {
    if (amount >= 10000000) {
      return Math.floor(amount / 10000000) + '천만';
    } else if (amount >= 10000) {
      return Math.floor(amount / 10000) + '만';
    } else {
      return new Intl.NumberFormat('ko-KR').format(amount);
    }
  };

  const formatDate = (period, type) => {
    if (type === 'daily') {
      const date = new Date(period);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    } else if (type === 'weekly') {
      const [year, week] = period.split('-');
      return `${week}주`;
    } else {
      const [year, month] = period.split('-');
      return `${month}월`;
    }
  };

  const renderChart = (data, type) => {
    if (data.length === 0) {
      return <div className="no-data">데이터가 없습니다.</div>;
    }

    const maxAmount = Math.max(...data.map(item => item.total_amount));
    
    return (
      <div className="chart-container">
        {data.map((item, index) => (
          <div key={index} className="chart-bar">
            <div className="bar-label">{formatDate(item.period, type)}</div>
            <div className="bar-content">
              <div 
                className="bar" 
                style={{ 
                  height: `${maxAmount > 0 ? (item.total_amount / maxAmount) * 200 : 0}px`,
                  backgroundColor: type === 'daily' ? '#4CAF50' : type === 'weekly' ? '#2196F3' : '#FF9800'
                }}
              ></div>
            </div>
            <div className="bar-value">
              <div>{item.count}건</div>
              <div data-full-amount={formatAmount(item.total_amount)}>{formatAmountShort(item.total_amount)}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };



  if (error) {
    return (
      <div className="settlement-container">
        <div className="error">오류: {error}</div>
      </div>
    );
  }

  return (
    <div className="settlement-container">
      <div className="settlement-header">
        <h2>정산 대시보드</h2>
        {user?.role !== 'user' && (
          <div className="company-filter">
            <select 
              value={selectedCompany} 
              onChange={(e) => setSelectedCompany(e.target.value)}
            >
              <option value="">전체 분류</option>
              {allCompanies.map(company => (
                <option key={company.company} value={company.company}>
                  {company.company}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 기본 통계 - 입금 */}
      <div className="stats-grid">
        <div className={`stat-card deposit-card ${isUpdating ? 'updating' : ''}`}>
          <h3>전일 입금</h3>
          <div className="stat-content">
            <div className="stat-item">
              <span className="stat-label">건수</span>
              <span className="stat-value">{basicStats.yesterday.count}건</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">금액</span>
              <span className="stat-value">{formatAmount(basicStats.yesterday.total_amount)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">수수료</span>
              <span className="stat-value fee-value">{formatAmount(basicStats.yesterday.total_fee || 0)}</span>
            </div>
          </div>
        </div>
        <div className={`stat-card deposit-card ${isUpdating ? 'updating' : ''}`}>
          <h3>오늘 입금</h3>
          <div className="stat-content">
            <div className="stat-item">
              <span className="stat-label">건수</span>
              <span className="stat-value">{basicStats.today.count}건</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">금액</span>
              <span className="stat-value">{formatAmount(basicStats.today.total_amount)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">수수료</span>
              <span className="stat-value fee-value">{formatAmount(basicStats.today.total_fee || 0)}</span>
            </div>
          </div>
        </div>

        <div className={`stat-card deposit-card ${isUpdating ? 'updating' : ''}`}>
          <h3>이번 주 입금</h3>
          <div className="stat-content">
            <div className="stat-item">
              <span className="stat-label">건수</span>
              <span className="stat-value">{basicStats.week.count}건</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">금액</span>
              <span className="stat-value">{formatAmount(basicStats.week.total_amount)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">수수료</span>
              <span className="stat-value fee-value">{formatAmount(basicStats.week.total_fee || 0)}</span>
            </div>
          </div>
        </div>

        <div className={`stat-card deposit-card ${isUpdating ? 'updating' : ''}`}>
          <h3>이번 달 입금</h3>
          <div className="stat-content">
            <div className="stat-item">
              <span className="stat-label">건수</span>
              <span className="stat-value">{basicStats.month.count}건</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">금액</span>
              <span className="stat-value">{formatAmount(basicStats.month.total_amount)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">수수료</span>
              <span className="stat-value fee-value">{formatAmount(basicStats.month.total_fee || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 기본 통계 - 출금 */}
      <div className="stats-grid">
        <div className={`stat-card withdrawal-card ${isUpdating ? 'updating' : ''}`}>
          <h3>전일 출금</h3>
          <div className="stat-content">
            <div className="stat-item">
              <span className="stat-label">건수</span>
              <span className="stat-value">{withdrawalStats.yesterday.count}건</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">금액</span>
              <span className="stat-value">{formatAmount(withdrawalStats.yesterday.total_amount)}</span>
            </div>
          </div>
        </div>
        <div className={`stat-card withdrawal-card ${isUpdating ? 'updating' : ''}`}>
          <h3>오늘 출금</h3>
          <div className="stat-content">
            <div className="stat-item">
              <span className="stat-label">건수</span>
              <span className="stat-value">{withdrawalStats.today.count}건</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">금액</span>
              <span className="stat-value">{formatAmount(withdrawalStats.today.total_amount)}</span>
            </div>
          </div>
        </div>

        <div className={`stat-card withdrawal-card ${isUpdating ? 'updating' : ''}`}>
          <h3>이번 주 출금</h3>
          <div className="stat-content">
            <div className="stat-item">
              <span className="stat-label">건수</span>
              <span className="stat-value">{withdrawalStats.week.count}건</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">금액</span>
              <span className="stat-value">{formatAmount(withdrawalStats.week.total_amount)}</span>
            </div>
          </div>
        </div>

        <div className={`stat-card withdrawal-card ${isUpdating ? 'updating' : ''}`}>
          <h3>이번 달 출금</h3>
          <div className="stat-content">
            <div className="stat-item">
              <span className="stat-label">건수</span>
              <span className="stat-value">{withdrawalStats.month.count}건</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">금액</span>
              <span className="stat-value">{formatAmount(withdrawalStats.month.total_amount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 기간별 분석 섹션 - 가로 배치 */}
      {/* 
      <div className="charts-section">
        <div className={`analysis-section ${isUpdating ? 'updating' : ''}`}>
          <div className="section-header">
            <h3>일별 분석</h3>
            <div className="chart-info">최근 7일간의 일별 입금 현황</div>
          </div>
          <div className="period-chart daily-chart">
            {renderChart(dailyAnalysis, 'daily')}
          </div>
        </div>

        <div className={`analysis-section ${isUpdating ? 'updating' : ''}`}>
          <div className="section-header">
            <h3>주별 분석</h3>
            <div className="chart-info">최근 4주간의 주별 입금 현황</div>
          </div>
          <div className="period-chart weekly-chart">
            {renderChart(weeklyAnalysis, 'weekly')}
          </div>
        </div>

        <div className={`analysis-section ${isUpdating ? 'updating' : ''}`}>
          <div className="section-header">
            <h3>월별 분석</h3>
            <div className="chart-info">이번년도 월별 입금 현황</div>
          </div>
          <div className="period-chart monthly-chart">
            {renderChart(monthlyAnalysis, 'monthly')}
          </div>
        </div>
      </div>
      */}

      {/* 하단 테이블 섹션 - 가로 배치 */}
      <div className="tables-section">
        {/* 입금자 분석 */}
        <div className={`analysis-section ${isUpdating ? 'updating' : ''}`}>
          <div className="section-header">
            <h3>상위 입금자</h3>
            <div className="sender-filter">
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="">올해 전체</option>
                {Array.from({length: new Date().getMonth() + 1}, (_, i) => i + 1).map(month => (
                  <option key={month} value={month}>
                    {month}월
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="sender-table">
            <table>
              <thead>
                <tr>
                  <th>순위</th>
                  <th>입금자</th>
                  {user?.role !== 'user' && <th>분류</th>}
                  <th>사용자명</th>
                  <th>입금 건수</th>
                  <th>총 입금액</th>
                  <th>평균 금액</th>
                </tr>
              </thead>
              <tbody>
                {senderAnalysis.length === 0 ? (
                  <tr>
                    <td colSpan={user?.role !== 'user' ? 7 : 6} className="no-data">
                      입금 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  senderAnalysis.map((sender, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{sender.sender}</td>
                      {user?.role !== 'user' && <td>{sender.company}</td>}
                      <td>{sender.company_name || '-'}</td>
                      <td>{sender.count}건</td>
                      <td>{formatAmount(sender.total_amount)}</td>
                      <td>{formatAmount(sender.avg_amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 분류별 분석 (관리자 전용) */}
        {user?.role !== 'user' && (
          <div className={`analysis-section ${isUpdating ? 'updating' : ''}`}>
            <div className="section-header">
              <h3>분류별 분석</h3>
              <div className="sender-filter">
                <select 
                  value={selectedCompanyMonth} 
                  onChange={(e) => setSelectedCompanyMonth(e.target.value)}
                >
                  <option value="">올해 전체</option>
                  {Array.from({length: new Date().getMonth() + 1}, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>
                      {month}월
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="company-table">
              <table>
                <thead>
                  <tr>
                    <th>순위</th>
                    <th>분류</th>
                    <th>사용자명</th>
                    <th>입금 건수</th>
                    <th>총 입금액</th>
                    <th>총 수수료</th>
                    <th>총 출금액</th>
                  </tr>
                </thead>
                <tbody>
                  {companyAnalysis.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="no-data">
                        분류별 데이터가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    companyAnalysis.map((company, index) => (
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td>{company.company}</td>
                        <td>{company.company_name || '-'}</td>
                        <td>{company.deposit_count}건</td>
                        <td>{formatAmount(company.total_deposit)}</td>
                        <td className="fee-value">{formatAmount(company.total_fee)}</td>
                        <td>{formatAmount(company.total_withdrawal)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Settlement; 