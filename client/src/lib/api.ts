const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

let onUnauthorizedCallback: (() => void) | null = null;
let activeSocketId: string | null = null;

export function setSocketIdForApi(socketId: string | null) {
  activeSocketId = socketId;
}

export function setUnauthorizedCallback(cb: () => void) {
  onUnauthorizedCallback = cb;
}

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sprintify_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (activeSocketId) {
    headers['X-Socket-Id'] = activeSocketId;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sprintify_token');
      localStorage.removeItem('sprintify_user');
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = data.error || data.message || `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return data as T;
}

export function apiUploadWithProgress<T = any>(
  endpoint: string,
  formData: FormData,
  onProgress?: (percent: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const token = typeof window !== 'undefined' ? localStorage.getItem('sprintify_token') : null;
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    xhr.open('POST', url, true);

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    if (activeSocketId) {
      xhr.setRequestHeader('X-Socket-Id', activeSocketId);
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      let data: any = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = {};
      }

      if (xhr.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('sprintify_token');
          localStorage.removeItem('sprintify_user');
          if (onUnauthorizedCallback) {
            onUnauthorizedCallback();
          }
        }
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as T);
      } else {
        const errorMsg = data.error || data.message || `Upload failed with status ${xhr.status}`;
        reject(new Error(errorMsg));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during file upload'));
    };

    xhr.send(formData);
  });
}

export async function apiDownloadBlob(endpoint: string): Promise<Blob> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sprintify_token') : null;

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const response = await fetch(url, { headers });

  if (response.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('sprintify_token');
    localStorage.removeItem('sprintify_user');
    if (onUnauthorizedCallback) onUnauthorizedCallback();
  }

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.error || 'Failed to download file');
  }

  return await response.blob();
}
