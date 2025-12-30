import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, Trophy, Target, Clock } from 'lucide-react';

export default function PlayerMiniGame({
  miniGameState,
  setMiniGameState,
  targetNumber,
  setTargetNumber,
  userInput,
  setUserInput,
  timeLeft,
  setTimeLeft,
  score,
  setScore,
  finalReward,
  setFinalReward,
  gameState,
  playerActions,
  success,
  error,
  nickname,
}) {
  // 숫자 맞추기 게임 시작
  const startNumberGame = () => {
    if (!gameState.isGameStarted) {
      error('오류', '게임이 시작되지 않았습니다.', 3000);
      return;
    }
    setMiniGameState('playing');
    setTargetNumber(Math.floor(Math.random() * 100) + 1);
    setUserInput('');
    setTimeLeft(10);
    setScore(0);
    setFinalReward(0);
  };

  // 게임 종료 및 운영자에게 요청
  const finishGame = useCallback(() => {
    if (score === 0) {
      error('오류', '점수를 획득하지 못했습니다.', 2000);
      setMiniGameState('idle');
      return;
    }
    
    setFinalReward(score);
    setMiniGameState('pending');
    
    // 운영자에게 미니게임 완료 요청 전송
    if (playerActions && playerActions.completeMiniGame) {
      playerActions.completeMiniGame(score);
      success('요청 완료', '운영자 승인을 기다리는 중입니다.', 3000);
    }
  }, [score, playerActions, success, error]);

  // 숫자 게임 타이머
  useEffect(() => {
    if (miniGameState === 'playing' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            finishGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [miniGameState, timeLeft, finishGame]);

  // 정답 확인
  const checkNumberAnswer = () => {
    const userNum = parseInt(userInput);
    if (isNaN(userNum) || userNum < 1 || userNum > 100) {
      error('오류', '1-100 사이의 숫자를 입력해주세요.', 2000);
      return;
    }

    const difference = Math.abs(userNum - targetNumber);
    let points = 0;

    if (difference === 0) {
      points = 1000;
      success('완벽!', '정확히 맞췄습니다!', 2000);
    } else if (difference <= 5) {
      points = 500;
      success('거의 맞음!', `차이: ${difference}`, 2000);
    } else if (difference <= 10) {
      points = 300;
      success('좋아요!', `차이: ${difference}`, 2000);
    } else if (difference <= 20) {
      points = 100;
      success('괜찮아요', `차이: ${difference}`, 2000);
    } else {
      error('틀렸어요', `차이: ${difference}`, 2000);
      return;
    }

    setScore((prev) => prev + points);
    setTargetNumber(Math.floor(Math.random() * 100) + 1);
    setUserInput('');
    setTimeLeft(10);
  };

  // 게임 리셋
  const resetGame = () => {
    setMiniGameState('idle');
    setScore(0);
    setTargetNumber(null);
    setUserInput('');
    setTimeLeft(10);
    setFinalReward(0);
  };

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {miniGameState === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="card-modern p-6 sm:p-8 text-center"
          >
            <Gamepad2 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">미니게임</h3>
            <p className="text-gray-500 mb-4">
              숫자 맞추기 게임을 플레이하고 보상을 받으세요!
            </p>
            {!gameState.isGameStarted && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ 게임이 시작되지 않았습니다.
                </p>
              </div>
            )}
            <button
              onClick={startNumberGame}
              disabled={!gameState.isGameStarted}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold rounded-lg text-sm transition-all"
            >
              게임 시작
            </button>
          </motion.div>
        )}

        {miniGameState === 'playing' && (
          <motion.div
            key="playing"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="card-modern p-6 sm:p-8"
          >
            <div className="text-center mb-6">
              <div className="text-sm text-gray-600 mb-2 flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" />
                남은 시간
              </div>
              <div className="text-4xl font-bold text-blue-600 mb-4">
                {timeLeft}초
              </div>
              <div className="text-sm text-gray-600 mb-2">목표 숫자</div>
              <div className="text-6xl font-black text-purple-600 mb-4">
                {targetNumber}
              </div>
              <div className="text-sm text-gray-600 mb-2">현재 점수</div>
              <div className="text-2xl font-bold text-green-600">
                ₩{score.toLocaleString('ko-KR')}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  숫자 입력 (1-100)
                </label>
                <input
                  type="number"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      checkNumberAnswer();
                    }
                  }}
                  min="1"
                  max="100"
                  placeholder="1-100 사이의 숫자"
                  className="input-modern w-full text-center text-2xl"
                  autoFocus
                />
              </div>
              <button
                onClick={checkNumberAnswer}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-lg text-sm transition-all"
              >
                확인
              </button>
              <button
                onClick={finishGame}
                className="w-full px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg text-sm transition-all"
              >
                게임 종료 및 요청
              </button>
            </div>
          </motion.div>
        )}

        {miniGameState === 'pending' && (
          <motion.div
            key="pending"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="card-modern p-6 sm:p-8 text-center"
          >
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold mb-2">승인 대기 중</h2>
            <div className="text-4xl font-black text-green-600 mb-4">
              ₩{finalReward.toLocaleString('ko-KR')}
            </div>
            <p className="text-gray-600 mb-6">
              운영자가 승인하면 보상이 지급됩니다.
            </p>
          </motion.div>
        )}

        {miniGameState === 'finished' && (
          <motion.div
            key="finished"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="card-modern p-6 sm:p-8 text-center"
          >
            <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
            <h2 className="text-2xl font-bold mb-2">보상 지급 완료!</h2>
            <div className="text-4xl font-black text-green-600 mb-4">
              ₩{finalReward.toLocaleString('ko-KR')}
            </div>
            <p className="text-gray-600 mb-6">
              보상이 지급되었습니다.
            </p>
            <button
              onClick={resetGame}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold rounded-lg text-sm transition-all"
            >
              다시 시작
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

