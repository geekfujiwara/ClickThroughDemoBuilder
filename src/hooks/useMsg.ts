/**
 * useMsg — 言語切替時に再レンダリングをトリガーするフック
 *
 * MSG プロキシ自体は常に最新言語を返すが、React コンポーネントが
 * 再レンダリングされないと表示が変わらない。
 * このフックを使うことで言語変更時に自動的に再レンダリングされる。
 */
import { useState, useEffect } from 'react';
import { MSG } from '@/constants/messages';
import { onLanguageChange } from '@/constants/i18n';

export function useMsg() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsubscribe = onLanguageChange(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  return MSG;
}
