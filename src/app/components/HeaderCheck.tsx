import { headers } from 'next/headers';

export default async function HeaderCheck({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const displayApp = headersList.get('display_app');

  if (displayApp !== 'true') {
    return null;
  }

  return <>{children}</>;
}
