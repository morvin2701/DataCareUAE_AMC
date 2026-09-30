import { useCallback, useRef } from 'react';
import { handleEnterNav } from '../lib/enterNav.js';
export function useEnterNavigation({ onSubmit, onEscape } = {}) {
  const formRef = useRef(null);
  const onKeyDown = useCallback((e) => { if (formRef.current) handleEnterNav(e, formRef.current, { onSubmit, onEscape }); }, [onSubmit, onEscape]);
  return { formRef, onKeyDown };
}
