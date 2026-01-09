// 2025 대한민국 격동의 주식 시장 - 10개 종목, 10라운드 시나리오
export const STOCKS = [
  { id: 'ts', name: '태산 파운드리', basePrice: 143600 }, // 우량주
  { id: 'hm', name: '하이퍼 메모리', basePrice: 48500 }, // 기술주
  { id: 'ue', name: '유니버스 엔터', basePrice: 62400 }, // 이슈주
  { id: 'im', name: '아이코닉 뮤직', basePrice: 18700 }, // 트렌드주
  { id: 'hc', name: '희망 건설', basePrice: 4800 }, // 정치 테마A
  { id: 'mi', name: '미래 인프라', basePrice: 3200 }, // 정치 테마B
  { id: 'lm', name: '라이트닝 모터스', basePrice: 78500 }, // 수출주
  { id: 'nb', name: '넥스트 배터리', basePrice: 32400 }, // 에너지주
  { id: 'jd', name: '제트 유통', basePrice: 24100 }, // 물류주
  { id: 'of', name: '오리지널 푸드', basePrice: 146800 }, // 필수소비재
];

// 연습 게임용 종목 (3개)
export const PRACTICE_STOCKS = [
  {
    id: 'smh1',
    name: '십자가메고활강1',
    basePrice: 100000,
  },
  {
    id: 'smh2',
    name: '십자가메고활강2',
    basePrice: 100000,
  },
  {
    id: 'smh3',
    name: '십자가메고활강3',
    basePrice: 100000,
  },
];

// 연습 게임용 시나리오 (3라운드)
export const practiceScenarios = [
  {
    round: 0,
    month: '12월',
    headline:
      '십메활 공식 인스타 개설! 활기찬 커뮤니티 활동 및 4회의 성공적인 활강 기록.',
    newsBriefing: [], // 연습 게임에서는 간결하게 headline만 사용
    volatility: {
      smh1: 30, // +30% (성장세)
      smh2: -20, // -20% (하락)
      smh3: 50, // +50% (대폭 상승)
    },
    freeHint:
      '십메활은 현재 열정으로 가득합니다. 하지만 겨울 스포츠는 언제나 예기치 못한 사고의 위험이 따르기 마련입니다.',
  },
  {
    round: 1,
    month: '1월',
    headline:
      '수많은 활강 기록 달성 중! 그러나 1월 30일, 핵심 회원의 심각한 다리 부상 발생. 안전 관리 부실 논란으로 인한 위기 봉착.',
    newsBriefing: [], // 연습 게임에서는 간결하게 headline만 사용
    volatility: {
      smh1: -50, // -50% (폭락)
      smh2: 40, // +40% (반등)
      smh3: -60, // -60% (대폭 하락)
    },
    paidHint:
      "위기 속에 기회가 있습니다. 절망적인 상황을 반전시킬 '새로운 인물'이 나타날지도 모릅니다.",
  },
  {
    round: 2,
    month: '2월',
    headline:
      "위기의 십메활, 전설적인 스키 인재 '강OO' 발견! 그의 합류로 팀의 전문성과 브랜드 가치가 사상 최고치 경신.",
    newsBriefing: [], // 연습 게임에서는 간결하게 headline만 사용
    volatility: {
      smh1: 120, // +120% (대폭등)
      smh2: -30, // -30% (하락)
      smh3: 200, // +200% (폭등)
    },
  },
];

export const initialScenarios = [
  {
    round: 0,
    month: '1~2월',
    headline: '격변의 시작, 1만 원 시대와 AI 열풍',
    newsBriefing: [
      {
        category: '경제',
        content:
          "최저임금 10,030원 시대 개막... 자영업계 '밀크플레이션' 비상",
      },
      {
        category: '사회',
        content:
          "KFA 축구협회장 선거 논란... 정몽규 4선 도전 두고 여론 '시끌'",
      },
      {
        category: '레저',
        content:
          "스키 클럽 '십메활' 시즌 피날레... 빙판길 44중 추돌 사고에 안전 주의보",
      },
      {
        category: '테크',
        content:
          '"이게 나라고?" AI 생성형 이미지 대유행... MZ세대 SNS 점령',
      },
      {
        category: '기업',
        content:
          "제주항공, 사고 여파 딛고 장애인 스포츠단 지원 등 'ESG 경영' 박차",
      },
    ],
    volatility: {
      ts: -1.46,
      hm: -1.44,
      ue: 4.49,
      im: 5.88,
      hc: -6.25,
      mi: -3.12,
      lm: -12.87,
      nb: -18.21,
      jd: 4.56,
      of: -3.2,
    },
  },
  {
    round: 1,
    month: '3~4월',
    headline: '심판의 날과 K-컬처의 독주',
    newsBriefing: [
      {
        category: '정치',
        content:
          "[속보] 4월 4일 헌재, 대통령 탄핵 만장일치 인용... '파면 선고'",
      },
      {
        category: '문화',
        content:
          "드라마 '폭삭 속았수다' 글로벌 흥행... 제주도 관광객 역대급 급증",
      },
      {
        category: '스포츠',
        content:
          '2025 프로야구 개막... "올해는 다르다" 역대 최단기간 관중 돌파 기록',
      },
      {
        category: '사회',
        content:
          '탄핵 찬반 집회 격화... 광화문 일대 교통 마비 및 긴장 고조',
      },
      {
        category: '경제',
        content:
          "KDI, 경제성장률 1.5%로 하향 조정... '경기 침체' 경고등",
      },
    ],
    volatility: {
      ts: 11.8,
      hm: 7.11,
      ue: 10.58,
      im: 11.62,
      hc: -6.67,
      mi: -9.68,
      lm: -4.68,
      nb: -2.64,
      jd: -1.59,
      of: -2.53,
    },
  },
  {
    round: 2,
    month: '5~6월',
    headline: '보랏빛 물결과 새로운 권력의 탄생',
    newsBriefing: [
      {
        category: '정치',
        content:
          '6.3 조기 대선 종료... 제21대 대통령 이재명 당선 확정',
      },
      {
        category: '스포츠',
        content:
          '캡틴 손흥민, 유로파리그 우승컵 들다! 토트넘 15년 만의 우승 쾌거',
      },
      {
        category: '금융',
        content:
          '새 정부 기대감에 코스피 3,000선 탈환... 삼천피 시대 재개',
      },
      {
        category: '엔터',
        content:
          "BTS 멤버 전원 만기 전역! 완전체 복귀에 전 세계 '보랏빛' 물결",
      },
      {
        category: '테크',
        content:
          "정부, 'AI 100조 투자' 계획 발표... 테크주 일제히 강세",
      },
    ],
    volatility: {
      ts: 2.4,
      hm: 7.03,
      ue: 78.09,
      im: 28.96,
      hc: 173.81,
      mi: -85.71,
      lm: 10.58,
      nb: 10.08,
      jd: -6.45,
      of: 2.82,
    },
  },
  {
    round: 3,
    month: '7~8월',
    headline: '빅딜의 시대, 사법의 칼날',
    newsBriefing: [
      {
        category: '기업',
        content:
          '삼성전자-테슬라 22조 규모 AI 칩 계약 체결! 역대급 파운드리 수주',
      },
      {
        category: '외교',
        content:
          "트럼프 관세 폭탄 피했다... 한미 관세 협상 '15% 하향' 극적 타결",
      },
      {
        category: '정치',
        content:
          '윤석열 전 대통령 재구속 및 기소... 특검 수사 사법 처리 본궤도',
      },
      {
        category: '방송',
        content:
          "연애 예능 '모태솔로지만 연애는 하고 싶어' 신드롬... 출연자 주가 폭등",
      },
      {
        category: '국제',
        content:
          '중동 전쟁 위기 최고조... 국제 유가 꿈동이며 에너지주 요동',
      },
    ],
    volatility: {
      ts: 72.84,
      hm: 13.87,
      ue: -2.65,
      im: 13.68,
      hc: 7.83,
      mi: -12.5,
      lm: 18.45,
      nb: 23.94,
      jd: -3.45,
      of: 4.07,
    },
  },
  {
    round: 4,
    month: '9~10월',
    headline: '경주 APEC과 대한민국 경제 신기원',
    newsBriefing: [
      {
        category: '금융',
        content:
          '[경사] 코스피 사상 첫 4,000포인트 돌파! 4천피 시대 개막',
      },
      {
        category: '외교',
        content:
          '경주 APEC 2025 개최... 한국 핵잠수함 건조 승인 등 역대급 성과',
      },
      {
        category: '산업',
        content:
          "젠슨 황 방한... 이재용·정의선과 '치맥 회동' 후 자율주행 빅딜 암시",
      },
      {
        category: '민생',
        content:
          '전 국민 2차 소비쿠폰 지급 시작... 전통시장 및 골목상권 활기',
      },
      {
        category: '국제',
        content:
          '이스라엘-하마스 1단계 휴전 합의... 노벨 평화상 발표',
      },
      {
        category: '엔터',
        content:
          "로제 'APT.' 글로벌 차트 석권! 전 세계가 술 게임 노래 챌린지 중",
      },
    ],
    volatility: {
      ts: 20.94,
      hm: 41.18,
      ue: 4.04,
      im: 8.87,
      hc: -5.6,
      mi: -8.57,
      lm: 17.82,
      nb: 8.79,
      jd: 23.94,
      of: 2.34,
    },
  },
  {
    round: 5,
    month: '11~12월',
    headline: '미디어 빅딜과 두쫀쿠 신드롬',
    newsBriefing: [
      {
        category: '트렌드',
        content:
          '"없어서 못 팔아요" 두쫀쿠(두바이 쫀덕 쿠키) 열풍... 전국적인 오픈런 대란',
      },
      {
        category: '엔터',
        content:
          '넷플릭스, 워너브라더스 인수 전격 발표... 미디어 시장 역대급 빅딜',
      },
      {
        category: '정치',
        content:
          '대통령실 청와대 복귀 완료! 용산 시대 마감하고 국정 정상화 선언',
      },
      {
        category: '사법',
        content:
          '전직 대통령 부부 중형 구형... 윤석열 10년·김건희 15년 선고 요청',
      },
      {
        category: '테크',
        content:
          '스타링크 한국 서비스 공식 개시... 위성 인터넷 시대 개막',
      },
      {
        category: '과학',
        content:
          '누리호 4차 발사 최종 성공! 대한민국 뉴 스페이스 시대 진입',
      },
    ],
    volatility: {
      ts: 7.92,
      hm: 9.16,
      ue: 30.99,
      im: 8.14,
      hc: 2.61,
      mi: 500.0,
      lm: 2.86,
      nb: 6.64,
      jd: 51.87,
      of: 34.26,
    },
  },
];
