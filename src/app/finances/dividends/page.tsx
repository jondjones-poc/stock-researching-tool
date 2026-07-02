'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/** Legacy URL — redirects to /finances/etoro */
export default function DividendsRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const filter = searchParams.get('filter');
    const qs = filter ? `?filter=${filter}` : '';
    router.replace(`/finances/etoro${qs}`);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center text-gray-500 dark:text-gray-400">
      Redirecting to eToro…
    </div>
  );
}
