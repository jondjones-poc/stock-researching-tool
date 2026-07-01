'use client';

import Link from 'next/link';
import { formatDcfButtonDate, formatDcfDisplayDate } from '../utils/dcfDates';

interface DcfStatusLinkProps {
  href: string;
  hasDcfEntry: boolean;
  updatedAt?: string | null;
  isRecent?: boolean;
  showDate?: boolean;
}

export default function DcfStatusLink({
  href,
  hasDcfEntry,
  updatedAt = null,
  isRecent = false,
  showDate = true,
}: DcfStatusLinkProps) {
  const title = !hasDcfEntry
    ? 'No DCF model — create one'
    : updatedAt
      ? `DCF last updated ${formatDcfDisplayDate(updatedAt)}`
      : 'DCF model saved';

  const className = !hasDcfEntry
    ? 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40'
    : isRecent
      ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40'
      : 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40';

  return (
    <Link
      href={href}
      title={title}
      aria-label={title}
      className={`px-2 py-1 rounded-lg border text-xs font-bold transition-colors ${className}`}
    >
      <span className="flex flex-col items-center leading-tight">
        <span>DCF</span>
        {showDate && hasDcfEntry && updatedAt && (
          <span className="text-[10px] font-normal">{formatDcfButtonDate(updatedAt)}</span>
        )}
      </span>
    </Link>
  );
}
