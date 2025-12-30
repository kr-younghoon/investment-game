import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, QrCode, AlertCircle, FileText } from 'lucide-react';
import { motion } from 'framer-motion';

export default function QRScanner({ isOpen, onClose, onScanSuccess }) {
  const scannerContainerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [useManualInput, setUseManualInput] = useState(false);
  const [qrInput, setQrInput] = useState('');
  const cleanupInProgressRef = useRef(false);

  // 카메라 스캔 정리 함수
  const cleanupScanner = useCallback(async () => {
    if (cleanupInProgressRef.current) return;
    
    if (html5QrCodeRef.current) {
      cleanupInProgressRef.current = true;
      try {
        const scanner = html5QrCodeRef.current;
        
        // 스캔 중이면 먼저 중지
        if (scanner.isScanning && scanner.isScanning()) {
          try {
            await scanner.stop();
          } catch (stopErr) {
            console.warn('스캔 중지 오류 (무시):', stopErr);
          }
        }
        
        // DOM 정리
        try {
          await scanner.clear();
        } catch (clearErr) {
          console.warn('스캐너 정리 오류 (무시):', clearErr);
        }
      } catch (err) {
        console.warn('스캐너 정리 중 오류 (무시):', err);
      } finally {
        html5QrCodeRef.current = null;
        setIsScanning(false);
        cleanupInProgressRef.current = false;
      }
    }
  }, []);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      cleanupScanner();
    };
  }, [cleanupScanner]);

  // 모달이 닫힐 때 정리
  useEffect(() => {
    if (!isOpen) {
      cleanupScanner();
      setError('');
      setCameraError('');
      setUseManualInput(false);
      setQrInput('');
    }
  }, [isOpen, cleanupScanner]);

  const startScanning = useCallback(async () => {
    if (!scannerContainerRef.current || useManualInput) return;
    
    // 기존 스캐너가 있으면 먼저 정리
    await cleanupScanner();

    // DOM 요소가 있는지 확인
    const container = document.getElementById('qr-reader');
    if (!container) {
      console.error('QR reader container not found');
      setCameraError('스캐너 영역을 찾을 수 없습니다.');
      setUseManualInput(true);
      return;
    }

    try {
      setError('');
      setCameraError('');
      setIsScanning(true);
      
      // 새로운 스캐너 인스턴스 생성
      const scanner = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = scanner;
      
      // 카메라 권한 요청 및 스캔 시작
      await scanner.start(
        { facingMode: 'environment' }, // 후면 카메라 우선
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // QR 코드 스캔 성공
          try {
            const data = JSON.parse(decodedText);
            if (data.type === 'player' && data.socketId) {
              cleanupScanner().then(() => {
                onScanSuccess(decodedText);
                onClose();
              });
            } else {
              setError('유효하지 않은 플레이어 QR 코드입니다');
            }
          } catch {
            // JSON이 아니면 그대로 전달
            cleanupScanner().then(() => {
              onScanSuccess(decodedText);
              onClose();
            });
          }
        },
        (errorMessage) => {
          // 스캔 오류는 무시 (계속 스캔)
        }
      );
    } catch (err) {
      console.error('QR 스캔 시작 오류:', err);
      setIsScanning(false);
      
      // 스캐너 정리
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.clear();
        } catch (clearErr) {
          // 무시
        }
        html5QrCodeRef.current = null;
      }
      
      // 권한 거부 또는 카메라 없음
      if (err.name === 'NotAllowedError') {
        setCameraError('카메라 접근 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('카메라를 찾을 수 없습니다.');
      } else if (err.message && (err.message.includes('streaming not supported') || err.message.includes('Camera streaming'))) {
        setCameraError('이 브라우저는 카메라 스트리밍을 지원하지 않습니다. 수동 입력을 사용해주세요.');
        setUseManualInput(true);
      } else {
        setCameraError('카메라를 사용할 수 없습니다. 수동 입력을 사용해주세요.');
        setUseManualInput(true);
      }
    }
  }, [cleanupScanner, useManualInput, onScanSuccess, onClose]);

  const stopScanning = useCallback(async () => {
    await cleanupScanner();
  }, [cleanupScanner]);

  // 모달이 열릴 때 자동으로 스캔 시작 (수동 입력 모드가 아닐 때)
  useEffect(() => {
    if (isOpen && !useManualInput) {
      const timer = setTimeout(() => {
        startScanning();
      }, 500); // DOM이 완전히 렌더링될 때까지 대기
      return () => {
        clearTimeout(timer);
      };
    }
  }, [isOpen, useManualInput, startScanning]);

  const handleManualSubmit = () => {
    if (!qrInput.trim()) {
      setError('QR 코드 데이터를 입력하세요');
      return;
    }

    try {
      const data = JSON.parse(qrInput);
      if (data.type === 'player' && data.socketId) {
        onScanSuccess(qrInput);
        setQrInput('');
        setError('');
        onClose();
      } else {
        setError('유효하지 않은 플레이어 QR 코드입니다');
      }
    } catch {
      // JSON이 아니면 그대로 전달
      onScanSuccess(qrInput);
      setQrInput('');
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-white rounded-xl p-6 max-w-md w-full relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={async () => {
            await cleanupScanner();
            onClose();
          }}
          className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 transition-colors p-2 hover:bg-gray-100 rounded-lg z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-4">
          <QrCode className="w-12 h-12 mx-auto mb-2 text-purple-600" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">QR 코드 스캔</h2>
          <p className="text-sm text-gray-600">
            {useManualInput 
              ? 'QR 코드 데이터를 입력하세요' 
              : '플레이어의 QR 코드를 카메라로 스캔하세요'}
          </p>
        </div>

        {!useManualInput ? (
          <>
            {/* QR 스캔 영역 */}
            <div 
              ref={scannerContainerRef}
              className="w-full mb-4 rounded-lg overflow-hidden bg-gray-100 min-h-[250px] relative"
            >
              <div 
                id="qr-reader" 
                className="w-full h-full"
              />
              {!isScanning && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center text-center text-gray-500 bg-gray-100">
                  <div>
                    <Camera className="w-16 h-16 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">카메라를 시작하는 중...</p>
                  </div>
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center text-center p-4 bg-gray-100">
                  <div>
                    <AlertCircle className="w-12 h-12 mx-auto mb-2 text-red-500" />
                    <p className="text-sm text-red-600 mb-2">{cameraError}</p>
                    <button
                      onClick={() => setUseManualInput(true)}
                      className="text-sm text-purple-600 hover:text-purple-700 underline"
                    >
                      수동 입력으로 전환
                    </button>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              {!isScanning ? (
                <button
                  onClick={startScanning}
                  className="flex-1 btn-primary py-2 flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  스캔 시작
                </button>
              ) : (
                <button
                  onClick={stopScanning}
                  className="flex-1 btn-secondary py-2"
                >
                  스캔 중지
                </button>
              )}
              <button
                onClick={() => {
                  stopScanning();
                  setUseManualInput(true);
                }}
                className="flex-1 btn-secondary py-2 flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                수동 입력
              </button>
            </div>
          </>
        ) : (
          <>
            {/* 수동 입력 모드 */}
            <div className="mb-4">
              <textarea
                value={qrInput}
                onChange={(e) => {
                  setQrInput(e.target.value);
                  setError('');
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleManualSubmit();
                  }
                }}
                placeholder='{"type":"player","socketId":"...","nickname":"..."}'
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm font-mono"
                rows={4}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleManualSubmit}
                className="flex-1 btn-primary py-2 flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4" />
                확인
              </button>
              <button
                onClick={async () => {
                  setUseManualInput(false);
                  setQrInput('');
                  setError('');
                  setCameraError('');
                  await cleanupScanner();
                  setTimeout(() => {
                    startScanning();
                  }, 300);
                }}
                className="flex-1 btn-secondary py-2 flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                카메라로
              </button>
            </div>
          </>
        )}

        <p className="text-xs text-gray-500 text-center mt-4">
          💡 {useManualInput 
            ? 'QR 코드 데이터를 복사하여 붙여넣으세요' 
            : 'QR 코드를 카메라에 맞춰주세요'}
        </p>
      </motion.div>
    </motion.div>
  );
}
