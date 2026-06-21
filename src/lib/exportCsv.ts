// Build a CSV of all events for a baby and hand it to the OS share sheet
// (expo-file-system + expo-sharing — cross-platform, §5.9 / §10.1).
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import * as repo from '@/src/db/repo';
import { buildCsv } from '@/src/logic/csv';

export async function exportCsv(babyId: number, babyName: string): Promise<void> {
  const [feeds, diapers, growth] = await Promise.all([
    repo.getAllFeedEvents(babyId),
    repo.getAllDiaperEvents(babyId),
    repo.getGrowthMeasurements(babyId),
  ]);
  const csv = buildCsv(feeds, diapers, growth);

  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = babyName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'baby';
  const file = new File(Paths.cache, `lull-${safeName}-${stamp}.csv`);
  file.create({ overwrite: true });
  file.write(csv);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      dialogTitle: 'Export Lull data',
      UTI: 'public.comma-separated-values-text',
    });
  }
}
