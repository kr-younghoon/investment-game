import { useState, useCallback, useRef, useEffect } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const toastIdCounterRef = useRef(0);
  const timeoutIdsRef = useRef(new Map());

  // 컴포넌트 언마운트 시 모든 타이머 정리
  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      timeoutIdsRef.current.clear();
    };
  }, []);

  const removeToast = useCallback((id) => {
    // 타이머 정리
    const timeoutId = timeoutIdsRef.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutIdsRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((toast) => {
    const id = ++toastIdCounterRef.current;
    const newToast = {
      id,
      type: toast.type || 'info',
      title: toast.title,
      message: toast.message,
      duration: toast.duration || 3000,
    };

    setToasts((prev) => [...prev, newToast]);

    // 자동 제거 (타이머 ID 저장)
    if (newToast.duration > 0) {
      const timeoutId = setTimeout(() => {
        timeoutIdsRef.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, newToast.duration);
      timeoutIdsRef.current.set(id, timeoutId);
    }

    return id;
  }, []);

  const success = useCallback((title, message, duration) => {
    return addToast({ type: 'success', title, message, duration });
  }, [addToast]);

  const info = useCallback((title, message, duration) => {
    return addToast({ type: 'info', title, message, duration });
  }, [addToast]);

  const warning = useCallback((title, message, duration) => {
    return addToast({ type: 'warning', title, message, duration });
  }, [addToast]);

  const error = useCallback((title, message, duration) => {
    return addToast({ type: 'error', title, message, duration });
  }, [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    info,
    warning,
    error,
  };
}
