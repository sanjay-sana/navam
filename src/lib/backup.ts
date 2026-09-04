// Backup/restore file IO (§ v1.1). Fully offline: backup hands a JSON file to
// the OS share sheet; restore reads a user-picked file locally. No network.
import * as Application from 'expo-application';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import * as repo from '@/src/db/repo';
import { buildBackupJson, parseBackup, type BackupData } from '@/src/logic/backup';

/** Gather everything for the active baby, write a JSON backup, and share it. */
export async function exportBackup(): Promise<'ok' | 'no-baby'> {
  const baby = await repo.getActiveBaby();
  if (!baby) return 'no-baby';
  const [feeds, diapers, sleeps, growth, settings, reminder] = await Promise.all([
    repo.getAllFeedEvents(baby.id),
    repo.getAllDiaperEvents(baby.id),
    repo.getAllSleepEvents(baby.id),
    repo.getGrowthMeasurements(baby.id),
    repo.getSettings(),
    repo.getFeedReminder(baby.id),
  ]);
  const json = buildBackupJson(
    { baby, feeds, diapers, sleeps, growth, settings, reminder },
    Application.nativeApplicationVersion
  );

  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = baby.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'baby';
  const file = new File(Paths.cache, `navam-backup-${safeName}-${stamp}.json`);
  file.create({ overwrite: true });
  file.write(json);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Save Navam backup',
      UTI: 'public.json',
    });
  }
  return 'ok';
}

export type ImportResult =
  | { status: 'cancelled' }
  | { status: 'error'; message: string }
  | { status: 'ok'; data: BackupData };

/** Let the user pick a backup file and parse it (does NOT write to the DB). */
export async function pickBackup(): Promise<ImportResult> {
  const res = await DocumentPicker.getDocumentAsync({
    // JSON mime, but keep it permissive — some pickers mislabel .json.
    type: ['application/json', 'text/*', '*/*'],
    copyToCacheDirectory: true, // guarantees a readable file:// uri
  });
  if (res.canceled || !res.assets?.[0]) return { status: 'cancelled' };
  let text: string;
  try {
    text = await new File(res.assets[0].uri).text();
  } catch {
    return { status: 'error', message: 'Couldn’t read that file.' };
  }
  const parsed = parseBackup(text);
  if (!parsed.ok) return { status: 'error', message: parsed.error };
  return { status: 'ok', data: parsed.value };
}
