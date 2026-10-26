'use client';

import { useEffect, useRef } from 'react';

interface Hero {
  name: string;
  skin: string;
  slim: boolean;
  turn: number;
  tag: string;
}

// HD (256x256) skins: same Minecraft body, 4x finer pixels
const HEROES: Hero[] = [
  { name: 'MikuuLovesCoffee', skin: '/skins/mikuulovescoffee.png', slim: false, turn: 0.45, tag: 'text-gold' },
  { name: 'xxbabyxv', skin: '/skins/xxbabyxv.png', slim: true, turn: -0.45, tag: 'text-pink' },
];

/** The two owners standing together, with name tags. */
export function HeroScene() {
  const refs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    let disposed = false;
    const viewers: { dispose(): void }[] = [];

    (async () => {
      const skinview3d = await import('skinview3d');
      if (disposed) return;
      HEROES.forEach((hero, i) => {
        const canvas = refs.current[i];
        if (!canvas) return;
        const viewer = new skinview3d.SkinViewer({
          canvas,
          width: canvas.clientWidth,
          height: canvas.clientHeight,
          model: hero.slim ? 'slim' : 'default',
          zoom: 0.78,
          fov: 40,
        });
        viewer.globalLight.intensity = 2.4;
        viewer.cameraLight.intensity = 1.2;
        viewer.playerObject.rotation.y = hero.turn;
        viewer.controls.enableZoom = false;
        viewer.controls.enablePan = false;
        viewer.animation = new skinview3d.IdleAnimation();
        viewer.animation.speed = 0.8 + i * 0.15;
        void viewer.loadSkin(hero.skin, { model: hero.slim ? 'slim' : 'default' });
        const onResize = () => viewer.setSize(canvas.clientWidth, canvas.clientHeight);
        window.addEventListener('resize', onResize);
        viewers.push({
          dispose() {
            window.removeEventListener('resize', onResize);
            viewer.dispose();
          },
        });
      });
    })();

    return () => {
      disposed = true;
      viewers.forEach((v) => v.dispose());
    };
  }, []);

  return (
    <div className="relative mx-auto flex w-full max-w-xl items-end justify-center">
      {HEROES.map((hero, i) => (
        <div key={hero.name} className="relative w-1/2">
          {/* Minecraft-style name tag */}
          <span className={`absolute left-1/2 top-2 z-10 -translate-x-1/2 whitespace-nowrap bg-black/45 px-2 py-0.5 font-pixel text-sm sm:text-base ${hero.tag}`}>
            {hero.name}
          </span>
          <canvas
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="h-[340px] w-full cursor-grab active:cursor-grabbing sm:h-[420px]"
            aria-label={`${hero.name} 3D`}
          />
        </div>
      ))}
      {/* little hearts floating up between them */}
      <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2" aria-hidden>
        {[0, 1.3, 2.6].map((delay, i) => (
          <span key={i} className="heart" style={{ left: (i - 1) * 18, animationDelay: `${delay}s` }} />
        ))}
      </div>
    </div>
  );
}
