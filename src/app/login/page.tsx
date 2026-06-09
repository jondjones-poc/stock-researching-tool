'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy /login URL — AuthGate handles sign-in at app root. */
export default function LoginRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    router.replace(`/${hash}`);
  }, [router]);

  return null;
}
