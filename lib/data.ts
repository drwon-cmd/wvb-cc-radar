import { cache } from 'react';
import path from 'node:path';
import { createDigestStore, firstReadableDigest } from './digest-store';
import type { DailyDigest } from './types';

export { isValidDigest } from './digest-store';

const store = createDigestStore(path.join(process.cwd(), 'data'));
export const getAllDates = cache(store.readAllDates);
export const getDigestByDate = cache(store.readDigestFile);

export const getLatestDigest = cache(async (): Promise<DailyDigest | null> =>
  firstReadableDigest(await getAllDates(), getDigestByDate),
);

export const getPreviousDigest = cache(async (currentDate: string): Promise<DailyDigest | null> => {
  const dates = await getAllDates();
  const index = dates.indexOf(currentDate);
  return index === -1 ? null : firstReadableDigest(dates.slice(index + 1), getDigestByDate);
});

export function formatDateKST(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
