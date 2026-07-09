import { useRef } from 'react';

/**
 * Hook para arrastrar horizontalmente un contenedor con el mouse.
 * Úsalo en cualquier div con overflow-x: auto.
 *
 * Uso:
 *   const { ref, handlers } = useDragScroll();
 *   return <div ref={ref} {...handlers} style={{ overflowX: 'auto', cursor: 'grab' }}>...</div>
 */
export function useDragScroll() {
  const ref = useRef(null);
  const dragState = useRef({ isDown: false, startX: 0, scrollLeft: 0 });

  const onMouseDown = (e) => {
    dragState.current = { isDown: true, startX: e.pageX, scrollLeft: ref.current?.scrollLeft || 0 };
    e.currentTarget.style.cursor = 'grabbing';
    e.currentTarget.style.userSelect = 'none';
  };

  const onMouseMove = (e) => {
    if (!dragState.current.isDown || !ref.current) return;
    e.preventDefault();
    const dx = e.pageX - dragState.current.startX;
    ref.current.scrollLeft = dragState.current.scrollLeft - dx;
  };

  const onMouseUp = (e) => {
    dragState.current.isDown = false;
    e.currentTarget.style.cursor = 'grab';
  };

  const onMouseLeave = (e) => {
    dragState.current.isDown = false;
    e.currentTarget.style.cursor = 'grab';
  };

  return {
    ref,
    handlers: { onMouseDown, onMouseMove, onMouseUp, onMouseLeave },
    style: { cursor: 'grab', overflowX: 'auto' },
  };
}
