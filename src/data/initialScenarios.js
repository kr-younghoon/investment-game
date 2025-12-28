// 5개 섹터와 12라운드 시나리오 데이터
export const STOCKS = [
  { id: 'ai-tech', name: 'AI테크', basePrice: 100 },
  { id: 'k-dopamine', name: 'K-도파민', basePrice: 100 },
  { id: 'coin-meme', name: '코인/밈', basePrice: 100 },
  {
    id: 'longevity-bio',
    name: '영생바이오',
    basePrice: 100,
  },
  {
    id: 'resale-luxury',
    name: '리셀/럭셔리',
    basePrice: 100,
  },
];

export const initialScenarios = [
  {
    round: 0,
    month: '1월',
    headline: 'GPT-5 출시 발표... AI 혁명의 시작인가?',
    volatility: {
      'ai-tech': 15,
      'k-dopamine': -2,
      'coin-meme': 3,
      'longevity-bio': -1,
      'resale-luxury': 0,
    },
  },
  {
    round: 1,
    month: '2월',
    headline: '직구 금지법 통과... 해외 쇼핑몰 주가 급락',
    volatility: {
      'ai-tech': -3,
      'k-dopamine': -5,
      'coin-meme': -2,
      'longevity-bio': 0,
      'resale-luxury': -20,
    },
  },
  {
    round: 2,
    month: '3월',
    headline: '아이돌 스캔들 폭로... K-콘텐츠 신뢰도 하락',
    volatility: {
      'ai-tech': 0,
      'k-dopamine': -25,
      'coin-meme': -5,
      'longevity-bio': 0,
      'resale-luxury': -3,
    },
  },
  {
    round: 3,
    month: '4월',
    headline: '비트코인 폭락... 암호화폐 시장 붕괴',
    volatility: {
      'ai-tech': -2,
      'k-dopamine': -1,
      'coin-meme': -40,
      'longevity-bio': 0,
      'resale-luxury': 0,
    },
  },
  {
    round: 4,
    month: '5월',
    headline: '영생 바이오 약물 개발 성공... 불로불사의 시작?',
    volatility: {
      'ai-tech': 0,
      'k-dopamine': 0,
      'coin-meme': 0,
      'longevity-bio': 35,
      'resale-luxury': 0,
    },
  },
  {
    round: 5,
    month: '6월',
    headline: '오징어 게임 2 공개... K-콘텐츠 글로벌 재점화',
    volatility: {
      'ai-tech': 0,
      'k-dopamine': 25,
      'coin-meme': 5,
      'longevity-bio': 0,
      'resale-luxury': 3,
    },
  },
  {
    round: 6,
    month: '7월',
    headline: '구독료 대폭 인상... 스트리밍 서비스 주가 급등',
    volatility: {
      'ai-tech': 8,
      'k-dopamine': 15,
      'coin-meme': -2,
      'longevity-bio': 0,
      'resale-luxury': 0,
    },
  },
  {
    round: 7,
    month: '8월',
    headline: '암호화폐 재상장... 코인 시장 반등 신호',
    volatility: {
      'ai-tech': 0,
      'k-dopamine': 0,
      'coin-meme': 30,
      'longevity-bio': 0,
      'resale-luxury': 0,
    },
  },
  {
    round: 8,
    month: '9월',
    headline: '명품 가격 대폭 하락... 리셀 시장 붕괴',
    volatility: {
      'ai-tech': 0,
      'k-dopamine': 0,
      'coin-meme': 0,
      'longevity-bio': 0,
      'resale-luxury': -25,
    },
  },
  {
    round: 9,
    month: '10월',
    headline: '탈모 완치제 개발 성공... 바이오 주가 급등',
    volatility: {
      'ai-tech': 0,
      'k-dopamine': 0,
      'coin-meme': 0,
      'longevity-bio': 40,
      'resale-luxury': 0,
    },
  },
  {
    round: 10,
    month: '11월',
    headline: '테슬라 봇 출시... AI 로봇 혁명 시작',
    volatility: {
      'ai-tech': 20,
      'k-dopamine': 0,
      'coin-meme': 5,
      'longevity-bio': 0,
      'resale-luxury': 0,
    },
  },
  {
    round: 11,
    month: '12월',
    headline: '산타 랠리 vs 경제 위기... 연말 대결',
    volatility: {
      'ai-tech': -5,
      'k-dopamine': 10,
      'coin-meme': -10,
      'longevity-bio': 8,
      'resale-luxury': 15,
    },
  },
];


