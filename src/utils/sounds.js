// 사운드 유틸리티 함수
// Web Audio API를 사용하여 간단한 사운드 생성

// AudioContext 생성 (브라우저 호환성 고려)
let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

// 간단한 beep 사운드 생성
function playBeep(frequency = 440, duration = 100, type = 'sine', volume = 0.3) {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration / 1000);
  } catch (error) {
    console.warn('사운드 재생 실패:', error);
  }
}

// 카운트다운 사운드 (짧은 beep)
export function playCountdownSound() {
  playBeep(600, 80, 'sine', 0.2);
}

// 라운드 시작 사운드 (긴 beep)
export function playRoundStartSound() {
  playBeep(800, 200, 'sine', 0.4);
}

// 매수 체결 사운드 (상승 톤)
export function playBuySound() {
  playBeep(600, 150, 'sine', 0.3);
  setTimeout(() => {
    playBeep(800, 100, 'sine', 0.3);
  }, 50);
}

// 매도 체결 사운드 (하강 톤)
export function playSellSound() {
  playBeep(800, 150, 'sine', 0.3);
  setTimeout(() => {
    playBeep(600, 100, 'sine', 0.3);
  }, 50);
}

// 힌트 도착 사운드 (알림 톤)
export function playHintSound() {
  playBeep(523, 100, 'sine', 0.3); // C5
  setTimeout(() => {
    playBeep(659, 100, 'sine', 0.3); // E5
  }, 100);
  setTimeout(() => {
    playBeep(784, 150, 'sine', 0.3); // G5
  }, 200);
}

