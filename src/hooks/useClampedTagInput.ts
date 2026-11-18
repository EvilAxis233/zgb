import { useCallback, useRef, useState, type ChangeEvent, type CompositionEvent, type FocusEvent } from 'react';
import { clampTag } from '../utils/tagLength';

/**
 * 自定义标签输入框的受控值：
 * - 输入法组字期间（拼音还没上屏）不截断，否则 Safari / macOS 原生输入法会把被截断的
 *   拼音当成英文字符直接提交，12 个字符之后就无法继续打出中文；
 * - 组字结束或失焦后再按 12 个宽度收敛，保持「6 中文 / 12 英文」的上限。
 */
export function useClampedTagInput() {
  const [value, setValue] = useState('');
  const composing = useRef(false);

  const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setValue(composing.current ? next : clampTag(next));
  }, []);

  const onCompositionStart = useCallback(() => { composing.current = true; }, []);

  const onCompositionEnd = useCallback((event: CompositionEvent<HTMLInputElement>) => {
    composing.current = false;
    setValue(clampTag(event.currentTarget.value));
  }, []);

  const onBlur = useCallback((event: FocusEvent<HTMLInputElement>) => {
    if (!composing.current) setValue(clampTag(event.target.value));
  }, []);

  return { value, setValue, inputProps: { value, onChange, onCompositionStart, onCompositionEnd, onBlur } };
}
