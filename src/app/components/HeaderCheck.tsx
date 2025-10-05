import { headers } from 'next/headers';

export default async function HeaderCheck({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  
  // Always display component on localhost
  if (host.includes('localhost')) {
    return <>{children}</>;
  }
  
  // Only check display_app header in production
  const displayApp = headersList.get('display_app');
  if (displayApp !== 'true') {
    return null;
  }

  return <>{children}</>;
}
