import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 pt-28 text-center">
      <p className="font-pixel text-7xl text-diamond">404</p>
      <p className="mt-4 text-muted">Bu sahifa topilmadi · Page not found</p>
      <Link href="/" className="btn-pixel mt-8 bg-grass px-5 py-2.5 text-white">
        ← CraftMine
      </Link>
    </div>
  );
}
