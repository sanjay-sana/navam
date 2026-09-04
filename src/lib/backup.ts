// Backup/restore file IO (§ v1.1). Fully offline: backup hands a JSON file to
// the OS share sheet; restore reads a user-picked file locally. No network.
import * as Application from 'expo-application';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
// The new File().text() API doesn't reliably read the URI a document picker
// returns; readAsStringAsync (still shipped under /legacy) is the proven path.
import { cacheDirectory, copyAsync, readAsStringAsync } from 'expo-file-system/legacy';
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

/**
 * Read a picked file's text. Some providers (Drive, "cloud-only" files) hand
 * back a content:// URI that readAsStringAsync can't open directly, so fall
 * back to copying it into our own cache (via the ContentResolver) and reading
 * that local copy.
 */
async function readPickedText(uri: string): Promise<string> {
  try {
    return await readAsStringAsync(uri);
  } catch (firstErr) {
    try {
      const dest = `${cacheDirectory}navam-restore-${Date.now()}.json`;
      await copyAsync({ from: uri, to: dest });
      return await readAsStringAsync(dest);
    } catch {
      throw firstErr; // report the original, more descriptive error
    }
  }
}

/** Let the user pick a backup file and parse it (does NOT write to the DB). */
export async function pickBackup(): Promise<ImportResult> {
  const res = await DocumentPicker.getDocumentAsync({
    type: '*/*', // some providers mislabel .json; filter nothing
    copyToCacheDirectory: true, // ask the picker for a local copy up front
  });
  if (res.canceled || !res.assets?.[0]) return { status: 'cancelled' };
  const uri = res.assets[0].uri;
  let text: string;
  try {
    text = await readPickedText(uri);
  } catch (e) {
    return {
      status: 'error',
      message: `Couldn’t read that file. Try saving the backup to your device (Files/Downloads) and pick it from there.\n\n${uri}\n${String(e)}`,
    };
  }
  const parsed = parseBackup(text);
  if (!parsed.ok) return { status: 'error', message: parsed.error };
  return { status: 'ok', data: parsed.value };
}
