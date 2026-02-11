import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Save,
  Upload,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Rocket,
  Settings,
  Newspaper,
  TrendingUp,
  Lightbulb,
  Check,
  AlertCircle,
} from 'lucide-react';

// 기본 시나리오 템플릿
const createEmptyRound = (roundIndex) => ({
  round: roundIndex,
  month: '',
  headline: '',
  newsBriefing: [],
  volatility: {},
  freeHint: '',
  paidHint: '',
});

const createEmptyStock = (id = '') => ({
  id: id || `stock_${Date.now()}`,
  name: '',
  basePrice: 100000,
});

export default function ScenarioSetupModal({
  isOpen,
  onClose,
  onStartGame,
  type, // 'practice' or 'real'
  socket,
  adminActions,
  gameState,
  playerCount,
}) {
  const [step, setStep] = useState('list'); // 'list', 'edit', 'confirm'
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [scenarioName, setScenarioName] = useState('');

  // 편집 중인 시나리오 데이터
  const [stocks, setStocks] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [activeRound, setActiveRound] = useState(0);
  const [activeTab, setActiveTab] = useState('news'); // 'news', 'stocks', 'hints'

  // 삭제 확인
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hasPreviousData = gameState?.isGameStarted || (playerCount && playerCount > 0);

  const isPractice = type === 'practice';
  const defaultRoundCount = isPractice ? 3 : 6;

  // 모달이 열릴 때 상태 초기화 및 시나리오 목록 불러오기
  useEffect(() => {
    if (isOpen) {
      setStep('list');
      setSelectedScenario(null);
      setConfirmDelete(false);
      setActiveRound(0);
      setActiveTab('news');
      if (adminActions) {
        loadScenarios();
      }
    }
  }, [isOpen]);

  // 시나리오 목록 불러오기
  const loadScenarios = () => {
    if (!adminActions) return;
    setIsLoading(true);

    adminActions.getScenarios(isPractice ? 'practice' : 'real');

    const handleScenariosUpdate = (data) => {
      setScenarios(data.scenarios || []);
      setIsLoading(false);
    };

    socket.once('SCENARIOS_LIST_UPDATE', handleScenariosUpdate);

    // 타임아웃
    setTimeout(() => {
      socket.off('SCENARIOS_LIST_UPDATE', handleScenariosUpdate);
      setIsLoading(false);
    }, 5000);
  };

  // 새 시나리오 만들기
  const createNewScenario = () => {
    const defaultStocks = isPractice
      ? [
          { id: 'smh1', name: '종목 1', basePrice: 100000 },
          { id: 'smh2', name: '종목 2', basePrice: 100000 },
          { id: 'smh3', name: '종목 3', basePrice: 100000 },
        ]
      : [
          { id: 'ts', name: '태산 파운드리', basePrice: 143600 },
          { id: 'hm', name: '하이퍼 메모리', basePrice: 48500 },
          { id: 'ue', name: '유니버스 엔터', basePrice: 62400 },
          { id: 'im', name: '아이코닉 뮤직', basePrice: 18700 },
          { id: 'hc', name: '희망 건설', basePrice: 4800 },
          { id: 'mi', name: '미래 인프라', basePrice: 3200 },
          { id: 'lm', name: '라이트닝 모터스', basePrice: 78500 },
          { id: 'nb', name: '넥스트 배터리', basePrice: 32400 },
          { id: 'jd', name: '제트 유통', basePrice: 24100 },
          { id: 'of', name: '오리지널 푸드', basePrice: 146800 },
        ];

    setStocks(defaultStocks);
    setRounds(
      Array.from({ length: defaultRoundCount }, (_, i) => {
        const round = createEmptyRound(i);
        // 기본 volatility 설정
        round.volatility = defaultStocks.reduce((acc, stock) => {
          acc[stock.id] = 0;
          return acc;
        }, {});
        return round;
      })
    );
    setScenarioName(`새 ${isPractice ? '연습' : '실제'} 시나리오`);
    setSelectedScenario(null);
    setActiveRound(0);
    setStep('edit');
  };

  // 기존 시나리오 불러오기
  const loadScenario = (scenario) => {
    setScenarioName(scenario.name);
    setStocks(scenario.stocks || []);
    setRounds(scenario.rounds || []);
    setSelectedScenario(scenario);
    setActiveRound(0);
    setStep('edit');
  };

  // 시나리오 저장
  const saveScenario = () => {
    if (!adminActions || !scenarioName.trim()) return;

    const scenarioId = selectedScenario?.id || null;
    const scenarioType = isPractice ? 'practice' : 'real';

    adminActions.saveScenario(scenarioId, scenarioName.trim(), scenarioType, stocks, rounds);

    socket.once('SCENARIO_SAVED', (data) => {
      if (data.success) {
        setSelectedScenario({ id: data.id, name: scenarioName.trim(), type: scenarioType, stocks, rounds });
        loadScenarios();
      }
    });
  };

  // 시나리오 삭제
  const deleteScenario = (scenarioId) => {
    if (!adminActions) return;

    adminActions.deleteScenario(scenarioId);

    socket.once('SCENARIO_DELETED', () => {
      loadScenarios();
    });
  };

  // 게임 시작
  const handleStartGame = () => {
    const shouldDelete = confirmDelete && hasPreviousData;
    onStartGame(stocks, rounds, shouldDelete);
  };

  // 라운드 데이터 업데이트
  const updateRound = (field, value) => {
    setRounds((prev) =>
      prev.map((r, i) =>
        i === activeRound ? { ...r, [field]: value } : r
      )
    );
  };

  // 주가 변동률 업데이트
  const updateVolatility = (stockId, value) => {
    setRounds((prev) =>
      prev.map((r, i) =>
        i === activeRound
          ? { ...r, volatility: { ...r.volatility, [stockId]: parseFloat(value) || 0 } }
          : r
      )
    );
  };

  // 뉴스 브리핑 추가
  const addNewsBriefing = () => {
    setRounds((prev) =>
      prev.map((r, i) =>
        i === activeRound
          ? { ...r, newsBriefing: [...(r.newsBriefing || []), { category: '', content: '' }] }
          : r
      )
    );
  };

  // 뉴스 브리핑 업데이트
  const updateNewsBriefing = (index, field, value) => {
    setRounds((prev) =>
      prev.map((r, i) =>
        i === activeRound
          ? {
              ...r,
              newsBriefing: r.newsBriefing.map((nb, ni) =>
                ni === index ? { ...nb, [field]: value } : nb
              ),
            }
          : r
      )
    );
  };

  // 뉴스 브리핑 삭제
  const removeNewsBriefing = (index) => {
    setRounds((prev) =>
      prev.map((r, i) =>
        i === activeRound
          ? { ...r, newsBriefing: r.newsBriefing.filter((_, ni) => ni !== index) }
          : r
      )
    );
  };

  // 종목 업데이트
  const updateStock = (index, field, value) => {
    setStocks((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  if (!isOpen) return null;

  const currentRound = rounds[activeRound] || {};

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden shadow-xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              {step !== 'list' && (
                <button
                  onClick={() => setStep('list')}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPractice ? 'bg-yellow-100' : 'bg-blue-100'}`}>
                {isPractice ? (
                  <GraduationCap className="w-5 h-5 text-yellow-600" />
                ) : (
                  <Rocket className="w-5 h-5 text-blue-600" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {step === 'list' && `${isPractice ? '연습' : '실제'} 게임 시나리오`}
                  {step === 'edit' && '시나리오 설정'}
                  {step === 'confirm' && '게임 시작 확인'}
                </h2>
                <p className="text-sm text-gray-500">
                  {step === 'list' && '시나리오를 선택하거나 새로 만드세요'}
                  {step === 'edit' && scenarioName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 시나리오 목록 */}
          {step === 'list' && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {/* 새 시나리오 만들기 버튼 */}
                <button
                  onClick={createNewScenario}
                  className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-gray-600 hover:text-blue-600"
                >
                  <Plus className="w-5 h-5" />
                  <span className="font-semibold">새 시나리오 만들기</span>
                </button>

                {/* 저장된 시나리오 목록 */}
                {isLoading ? (
                  <div className="text-center py-8 text-gray-500">
                    불러오는 중...
                  </div>
                ) : scenarios.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    저장된 시나리오가 없습니다
                  </div>
                ) : (
                  scenarios.map((scenario) => (
                    <div
                      key={scenario.id}
                      className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-300 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{scenario.name}</h3>
                          <p className="text-sm text-gray-500">
                            {scenario.rounds?.length || 0}라운드 / {scenario.stocks?.length || 0}종목
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => loadScenario(scenario)}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg text-sm transition-all"
                          >
                            불러오기
                          </button>
                          <button
                            onClick={() => deleteScenario(scenario.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 시나리오 편집 */}
          {step === 'edit' && (
            <>
              <div className="flex-1 overflow-y-auto">
                {/* 시나리오 이름 */}
                <div className="p-4 border-b border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    시나리오 이름
                  </label>
                  <input
                    type="text"
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    className="input-modern w-full"
                    placeholder="시나리오 이름을 입력하세요"
                  />
                </div>

                {/* 탭 메뉴 */}
                <div className="flex border-b border-gray-200 px-4">
                  {[
                    { id: 'stocks', label: '종목 설정', icon: TrendingUp },
                    { id: 'news', label: '뉴스 & 주가', icon: Newspaper },
                    { id: 'hints', label: '힌트', icon: Lightbulb },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span className="font-semibold text-sm">{tab.label}</span>
                    </button>
                  ))}
                </div>

                <div className="p-4">
                  {/* 종목 설정 탭 */}
                  {activeTab === 'stocks' && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-900 mb-3">주식 종목 설정</h3>
                      {stocks.map((stock, index) => (
                        <div key={stock.id} className="flex gap-3 items-center">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={stock.name}
                              onChange={(e) => updateStock(index, 'name', e.target.value)}
                              className="input-modern w-full"
                              placeholder="종목명"
                            />
                          </div>
                          <div className="w-40">
                            <input
                              type="number"
                              value={stock.basePrice}
                              onChange={(e) => updateStock(index, 'basePrice', parseInt(e.target.value) || 0)}
                              className="input-modern w-full"
                              placeholder="초기 가격"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 뉴스 & 주가 탭 */}
                  {activeTab === 'news' && (
                    <div className="space-y-4">
                      {/* 라운드 선택 */}
                      <div className="flex items-center justify-between mb-4">
                        <button
                          onClick={() => setActiveRound((prev) => Math.max(0, prev - 1))}
                          disabled={activeRound === 0}
                          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="font-bold text-lg">
                          라운드 {activeRound + 1} / {rounds.length}
                        </span>
                        <button
                          onClick={() => setActiveRound((prev) => Math.min(rounds.length - 1, prev + 1))}
                          disabled={activeRound >= rounds.length - 1}
                          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>

                      {/* 기간 */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          기간 (예: 1~2월)
                        </label>
                        <input
                          type="text"
                          value={currentRound.month || ''}
                          onChange={(e) => updateRound('month', e.target.value)}
                          className="input-modern w-full"
                          placeholder="1~2월"
                        />
                      </div>

                      {/* 헤드라인 */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          헤드라인
                        </label>
                        <input
                          type="text"
                          value={currentRound.headline || ''}
                          onChange={(e) => updateRound('headline', e.target.value)}
                          className="input-modern w-full"
                          placeholder="이 라운드의 핵심 헤드라인"
                        />
                      </div>

                      {/* 뉴스 브리핑 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-semibold text-gray-700">
                            뉴스 브리핑
                          </label>
                          <button
                            onClick={addNewsBriefing}
                            className="text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                          >
                            <Plus className="w-4 h-4" /> 추가
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(currentRound.newsBriefing || []).map((nb, index) => (
                            <div key={index} className="flex gap-2 items-start">
                              <input
                                type="text"
                                value={nb.category || ''}
                                onChange={(e) => updateNewsBriefing(index, 'category', e.target.value)}
                                className="input-modern w-24"
                                placeholder="카테고리"
                              />
                              <input
                                type="text"
                                value={nb.content || ''}
                                onChange={(e) => updateNewsBriefing(index, 'content', e.target.value)}
                                className="input-modern flex-1"
                                placeholder="뉴스 내용"
                              />
                              <button
                                onClick={() => removeNewsBriefing(index)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 주가 변동률 */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          주가 변동률 (%)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {stocks.map((stock) => (
                            <div key={stock.id} className="flex items-center gap-2">
                              <span className="text-sm text-gray-600 w-24 truncate">{stock.name}</span>
                              <input
                                type="number"
                                value={currentRound.volatility?.[stock.id] || 0}
                                onChange={(e) => updateVolatility(stock.id, e.target.value)}
                                className="input-modern w-20 text-center"
                                step="0.1"
                              />
                              <span className="text-sm text-gray-500">%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 힌트 탭 */}
                  {activeTab === 'hints' && (
                    <div className="space-y-4">
                      {/* 라운드 선택 */}
                      <div className="flex items-center justify-between mb-4">
                        <button
                          onClick={() => setActiveRound((prev) => Math.max(0, prev - 1))}
                          disabled={activeRound === 0}
                          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="font-bold text-lg">
                          라운드 {activeRound + 1} / {rounds.length}
                        </span>
                        <button
                          onClick={() => setActiveRound((prev) => Math.min(rounds.length - 1, prev + 1))}
                          disabled={activeRound >= rounds.length - 1}
                          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          무료 힌트
                        </label>
                        <textarea
                          value={currentRound.freeHint || ''}
                          onChange={(e) => updateRound('freeHint', e.target.value)}
                          className="input-modern w-full min-h-[80px]"
                          placeholder="이 라운드의 무료 힌트"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          유료 힌트
                        </label>
                        <textarea
                          value={currentRound.paidHint || ''}
                          onChange={(e) => updateRound('paidHint', e.target.value)}
                          className="input-modern w-full min-h-[80px]"
                          placeholder="이 라운드의 유료 힌트"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 하단 버튼 */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-3">
                <button
                  onClick={saveScenario}
                  className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  저장하기
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  className={`flex-1 px-4 py-3 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
                    isPractice
                      ? 'bg-yellow-500 hover:bg-yellow-600'
                      : 'bg-blue-500 hover:bg-blue-600'
                  }`}
                >
                  <Rocket className="w-4 h-4" />
                  게임 시작
                </button>
              </div>
            </>
          )}

          {/* 게임 시작 확인 */}
          {step === 'confirm' && (
            <div className="flex-1 overflow-y-auto p-4">
              {/* 이전 데이터 경고 */}
              {hasPreviousData && (
                <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-red-900 mb-2">
                        이전 게임 데이터가 있습니다
                      </h3>
                      <div className="bg-white rounded-lg p-3 border border-red-200">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={confirmDelete}
                            onChange={(e) => setConfirmDelete(e.target.checked)}
                            className="mt-1 w-5 h-5 text-red-600 border-red-300 rounded"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-red-900 mb-1">
                              이전 게임 데이터 삭제 확인
                            </div>
                            <div className="text-xs text-red-700">
                              체크하면 이전 게임의 모든 데이터가 삭제되고 새 게임이 시작됩니다.
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 시나리오 요약 */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <h3 className="font-bold text-gray-900 mb-3">시나리오 요약</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">시나리오 이름:</span>
                    <span className="font-semibold">{scenarioName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">라운드 수:</span>
                    <span className="font-semibold">{rounds.length}라운드</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">종목 수:</span>
                    <span className="font-semibold">{stocks.length}종목</span>
                  </div>
                </div>
              </div>

              {/* 종목 목록 */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <h3 className="font-bold text-gray-900 mb-3">주식 종목</h3>
                <div className="grid grid-cols-2 gap-2">
                  {stocks.map((stock) => (
                    <div key={stock.id} className="text-sm bg-white rounded-lg p-2 border border-gray-200">
                      <div className="font-semibold">{stock.name}</div>
                      <div className="text-gray-500">₩{stock.basePrice.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 시작 버튼 */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('edit')}
                  className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl"
                >
                  돌아가기
                </button>
                <button
                  onClick={handleStartGame}
                  disabled={hasPreviousData && !confirmDelete}
                  className={`flex-1 px-4 py-3 text-white font-semibold rounded-xl flex items-center justify-center gap-2 ${
                    hasPreviousData && !confirmDelete
                      ? 'bg-gray-400 cursor-not-allowed'
                      : isPractice
                      ? 'bg-yellow-500 hover:bg-yellow-600'
                      : 'bg-blue-500 hover:bg-blue-600'
                  }`}
                >
                  {hasPreviousData && !confirmDelete ? (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      삭제 확인 필요
                    </>
                  ) : (
                    <>
                      {isPractice ? <GraduationCap className="w-4 h-4" /> : <Rocket className="w-4 h-4" />}
                      게임 시작
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
