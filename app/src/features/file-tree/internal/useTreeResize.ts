import { ref } from 'vue';
import { useSettingsStore } from '../../../stores/settings';

/** v4.6.x — sidebar width resize state */
export function useTreeResize() {
  const settings = useSettingsStore();
  const isResizing = ref(false);
  const startX = ref(0);
  const startWidth = ref(0);

  function onResizeStart(e: MouseEvent) {
    e.preventDefault();
    isResizing.value = true;
    startX.value = e.clientX;
    startWidth.value = settings.fileTreeWidth;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    const onMove = (m: MouseEvent) => {
      const dx = m.clientX - startX.value;
      settings.setFileTreeWidth(startWidth.value + dx);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      isResizing.value = false;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return { isResizing, onResizeStart };
}
