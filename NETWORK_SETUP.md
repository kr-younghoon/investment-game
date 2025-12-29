# 네트워크 접속 설정 가이드

## 다른 기기(폰, 태블릿)에서 접속하는 방법

### 1. 같은 WiFi 네트워크에 연결

- **컴퓨터(서버)**: WiFi에 연결
- **폰/태블릿**: 같은 WiFi에 연결

### 2. 서버 실행

```bash
npm run server
```

서버가 실행되면 다음과 같은 메시지가 표시됩니다:

```
📡 네트워크 주소: http://192.168.x.x:3001
👥 플레이어 페이지 (네트워크): http://192.168.x.x:5173/player
```

**이 IP 주소를 기록해두세요!**

### 3. 클라이언트 실행

```bash
npm run dev
```

또는 동시 실행:

```bash
npm run dev:all
```

### 4. 다른 기기에서 접속

브라우저에서 다음 주소로 접속:

- **플레이어 페이지**: `http://[서버IP]:5173/` 또는 `http://[서버IP]:5173/player`
- **관리자 페이지**: `http://[서버IP]:5173/admin`

예시:

- 서버 IP가 `192.168.0.100`인 경우
- 플레이어 페이지: `http://192.168.0.100:5173/`

### 5. 방화벽 설정 (필요한 경우)

#### macOS

```bash
# 방화벽 설정 열기
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /usr/local/bin/node
```

또는 시스템 설정 > 보안 및 개인 정보 보호 > 방화벽에서 Node.js 허용

#### Windows

- Windows Defender 방화벽에서 포트 3001, 5173 허용

#### Linux

```bash
sudo ufw allow 3001
sudo ufw allow 5173
```

### 6. 문제 해결

**문제**: 다른 기기에서 접속이 안 됨

1. **같은 WiFi 확인**

   - 컴퓨터와 폰이 같은 WiFi에 연결되어 있는지 확인

2. **IP 주소 확인**

   - 서버 실행 시 표시되는 네트워크 주소 확인
   - 컴퓨터의 IP 주소 확인:
     - macOS/Linux: `ifconfig` 또는 `ip addr`
     - Windows: `ipconfig`

3. **방화벽 확인**

   - 방화벽이 포트 3001, 5173을 차단하지 않는지 확인

4. **브라우저에서 직접 테스트**

   - 폰 브라우저에서 `http://[서버IP]:3001` 접속 시도
   - 연결이 안 되면 서버 문제, 연결은 되지만 Socket.io 오류면 클라이언트 문제

5. **환경 변수 설정 (선택사항)**
   - `.env` 파일 생성:
     ```
     VITE_SOCKET_URL=http://[서버IP]:3001
     ```
   - 이렇게 하면 클라이언트가 항상 해당 IP로 연결

### 7. 모바일 브라우저 주의사항

- **HTTPS가 아닌 HTTP**: 일부 모바일 브라우저는 보안상 HTTP를 차단할 수 있습니다
- **개발 모드**: 개발 중에는 괜찮지만, 프로덕션에서는 HTTPS 사용 권장

### 8. 프로덕션 배포

프로덕션 환경에서는:

- HTTPS 사용
- 도메인 설정
- 환경 변수로 Socket.io URL 설정
