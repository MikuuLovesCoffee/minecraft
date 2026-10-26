'use client';

import { useEffect, useRef } from 'react';

/** Rotatable 3D view of one player's skin (walking in place). */
export function SkinViewer({ name }: { name: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let viewer: import('skinview3d').SkinViewer | null = null;
    let disposed = false;
    (async () => {
      const skinview3d = await import('skinview3d');
      const canvas = ref.current;
      if (disposed || !canvas) return;
      const url = `/api/skins/${encodeURIComponent(name)}`;
      // The API tells us whether the skin uses slim (3px) arms.
      const head = await fetch(url, { method: 'HEAD' }).catch(() => null);
      const model = head?.headers.get('x-skin-model') === 'slim' ? 'slim' : 'default';
      if (disposed) return;
      viewer = new skinview3d.SkinViewer({ canvas, width: canvas.clientWidth, height: canvas.clientHeight, zoom: 0.85, fov: 40 });
      viewer.globalLight.intensity = 2.4;
      viewer.controls.enableZoom = false;
      viewer.animation = new skinview3d.WalkingAnimation();
      viewer.animation.speed = 0.6;
      viewer.autoRotate = true;
      viewer.autoRotateSpeed = 0.6;
      void viewer.loadSkin(url, { model });
    })();
    return () => {
      disposed = true;
      viewer?.dispose();
    };
  }, [name]);

  return <canvas ref={ref} className="h-[360px] w-full cursor-grab active:cursor-grabbing" aria-label={`${name} 3D skin`} />;
}
