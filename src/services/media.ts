import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { createId } from '@/utils/id';

export type MediaFolder = 'memories' | 'voice';
export type PhotoSource = 'library' | 'camera';

const DEFAULT_EXTENSION: Record<MediaFolder, string> = { memories: '.jpg', voice: '.m4a' };
const FILE_PREFIX: Record<MediaFolder, string> = { memories: 'memory-', voice: 'voice-' };

const isWeb = Platform.OS === 'web';

/** ".jpg" from "file:///…/IMG_0042.JPG?x=1" — lower-cased, or '' when there is none. */
function extensionOf(uri: string): string {
  const path = uri.split(/[?#]/)[0] ?? '';
  const match = /\.([a-z0-9]{1,5})$/i.exec(path.slice(path.lastIndexOf('/') + 1));
  return match ? `.${match[1].toLowerCase()}` : '';
}

function folderDirectory(folder: MediaFolder): Directory {
  const directory = new Directory(Paths.document, folder);
  directory.create({ intermediates: true, idempotent: true });
  return directory;
}

/**
 * Copies a temporary file (picker result, fresh recording) into
 * `Paths.document/<folder>/` under a unique name, keeping its extension, and
 * returns the persisted URI. Already-persisted files are returned as-is.
 *
 * On web, or if the copy fails, the original URI is returned unchanged.
 */
export async function persistFile(uri: string, folder: MediaFolder): Promise<string> {
  if (isWeb || !uri) return uri;
  try {
    const directory = folderDirectory(folder);
    if (uri.startsWith(directory.uri)) return uri;

    const source = new File(uri);
    const target = new File(directory, `${FILE_PREFIX[folder]}${createId()}${extensionOf(uri) || DEFAULT_EXTENSION[folder]}`);
    await source.copy(target);

    // Picker/recorder output lives in the cache — tidy it up once we own a copy.
    if (uri.startsWith(Paths.cache.uri)) {
      try {
        source.delete();
      } catch {
        // The OS purges the cache eventually anyway.
      }
    }
    return target.uri;
  } catch (error) {
    if (__DEV__) console.warn('[media] Could not persist file, keeping the original URI.', error);
    return uri;
  }
}

/**
 * Deletes a file previously persisted by `persistFile`. Only touches files inside
 * the app's document directory (never bundled assets or remote URIs). No-op on web.
 */
export async function deleteFile(uri?: string): Promise<void> {
  if (isWeb || !uri) return;
  try {
    if (!uri.startsWith(Paths.document.uri)) return;
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone, or not ours to delete.
  }
}

async function hasPermission(source: PhotoSource): Promise<boolean> {
  // The system photo picker (PHPicker / Android Photo Picker) needs no permission,
  // so only the camera asks — avoids an unnecessary "allow access to all photos" prompt.
  if (source === 'library' || isWeb) return true;
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await ImagePicker.requestCameraPermissionsAsync()).granted;
}

/**
 * Lets the user pick (or shoot) a photo, crops it, and copies it into
 * `Paths.document/memories/`. Resolves the persisted URI, or `null` when the
 * user cancels, permission is denied or no camera is available.
 */
export async function pickPhoto(source: PhotoSource): Promise<string | null> {
  try {
    if (!(await hasPermission(source))) return null;
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset?.uri) return null;
    return await persistFile(asset.uri, 'memories');
  } catch (error) {
    // e.g. launchCameraAsync on a simulator without a camera.
    if (__DEV__) console.warn('[media] Photo picker failed.', error);
    return null;
  }
}
