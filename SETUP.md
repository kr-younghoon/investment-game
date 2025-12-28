# 서버 실행 가이드

## 문제 해결: Socket.io 연결 오류

Socket.io 연결 오류가 발생하는 경우, 다음을 확인하세요:

### 1. 서버 실행 확인

서버가 실행 중이어야 합니다. 다음 명령으로 서버를 실행하세요:

```bash
npm run server
```

서버가 정상적으로 실행되면 다음과 같은 메시지가 표시됩니다:
```
🚀 Socket.io 서버가 실행되었습니다!
📡 서버 주소: http://localhost:3001
```

### 2. 동시 실행 방법

**방법 1: 동시 실행 (권장)**
```bash
npm run dev:all
```

**방법 2: 별도 터미널에서 실행**
```bash
# 터미널 1
npm run server

# 터미널 2
npm run dev
```

### 3. 포트 확인

- **서버 포트**: 3001 (Socket.io)
- **클라이언트 포트**: 5173 또는 5174 (Vite)

포트가 이미 사용 중인 경우:
- 서버 포트 변경: `PORT=3002 npm run server`
- 환경 변수 설정: `.env` 파일에 `VITE_SOCKET_URL=http://localhost:3002` 추가

### 4. 연결 상태 확인

- 플레이어 페이지: 우측 상단에 연결 상태 표시
- 관리자 페이지: 좌측 상단에 연결 상태 표시
- 🔴 빨간색 = 연결 안됨 (서버 미실행)
- 🟢 초록색 = 연결됨 (정상)

### 5. 일반적인 문제 해결

**문제**: "WebSocket connection failed"
- **해결**: 서버가 실행 중인지 확인 (`npm run server`)

**문제**: "Port 3001 is already in use"
- **해결**: 다른 프로세스가 포트를 사용 중입니다. 해당 프로세스를 종료하거나 다른 포트 사용

**문제**: "CORS error"
- **해결**: 서버의 CORS 설정이 올바른지 확인 (이미 설정되어 있음)

### 6. 개발 환경 설정

`.env` 파일 생성 (선택사항):
```
VITE_SOCKET_URL=http://localhost:3001
```

### 7. 프로덕션 빌드

```bash
npm run build
npm run server
```

빌드된 파일은 `dist` 폴더에 생성되며, 서버가 자동으로 제공합니다.


