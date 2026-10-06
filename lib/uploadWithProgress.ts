/**
 * Upload FormData via XMLHttpRequest so we get real upload progress events.
 * `fetch()` doesn't support upload progress — XHR does.
 */

export interface UploadResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export function uploadWithProgress<T = any>(
  url: string,
  formData: FormData,
  onProgress?: (percent: number, loadedBytes: number, totalBytes: number) => void
): Promise<UploadResult<T>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100), e.loaded, e.total);
      }
    });

    xhr.addEventListener('load', () => {
      try {
        const json = JSON.parse(xhr.responseText);
        resolve(json);
      } catch {
        resolve({ success: false, error: `Server returned ${xhr.status}` });
      }
    });

    xhr.addEventListener('error', () => resolve({ success: false, error: 'Network error' }));
    xhr.addEventListener('abort', () => resolve({ success: false, error: 'Upload cancelled' }));
    xhr.addEventListener('timeout', () => resolve({ success: false, error: 'Upload timed out' }));

    xhr.send(formData);
  });
}

/** Format bytes to human-readable string. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
