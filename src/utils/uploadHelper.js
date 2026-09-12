import { logger } from '@/utils/logger';

export async function uploadFileToSupabase(file, folder = 'tanico-public', customFilename = null, customHeaders = {}) {
  try {
    if (!file) {
      return { success: false, error: 'File tidak ditemukan' };
    }

    // If file is already a valid remote URL string
    if (typeof file === 'string') {
      if (file.startsWith('http://') || file.startsWith('https://')) {
        return {
          success: true,
          url: file,
          publicUrl: file,
          path: file,
          bucket: folder,
          toString: () => file
        };
      }
    }

    const cleanFolder = folder || 'tanico-public';
    const cleanFilename = customFilename || (file && file.name ? file.name : `upload_${Date.now()}.jpg`);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', cleanFolder);
    formData.append('bucket', cleanFolder);
    formData.append('filename', cleanFilename);

    // Retrieve auth token from localStorage if in browser
    let headers = { ...customHeaders };
    if (typeof window !== 'undefined') {
      try {
        const storedUser = JSON.parse(localStorage.getItem('tanico_user') || 'null');
        const token = storedUser?.sessionToken || storedUser?.token;
        if (token && !headers.Authorization && !headers.authorization) {
          headers.Authorization = `Bearer ${token}`;
        }
      } catch (e) {}
    }

    // Try primary admin upload endpoint first
    let response = null;
    try {
      response = await fetch('/api/admin/upload', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formData
      });
    } catch (netErr) {
      logger.warn('[uploadFileToSupabase] /api/admin/upload network failure, attempting /api/upload', netErr);
    }

    // If primary route failed with 401, 403, 404, or network error, fallback to /api/upload
    if (!response || !response.ok) {
      try {
        const fallbackRes = await fetch('/api/upload', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: formData
        });
        if (fallbackRes.ok) {
          response = fallbackRes;
        }
      } catch (fallbackErr) {
        logger.warn('[uploadFileToSupabase] Fallback /api/upload error:', fallbackErr);
      }
    }

    if (!response || !response.ok) {
      const errData = response ? await response.json().catch(() => ({})) : {};
      const errorMessage = errData.error || errData.message || `Upload gagal (Status: ${response?.status || 'network error'})`;
      logger.error('uploadFileToSupabase failed response:', errorMessage);
      return {
        success: false,
        error: errorMessage,
        url: '',
        publicUrl: ''
      };
    }

    const data = await response.json();
    const finalUrl = data.url || data.publicUrl || data.path || '';

    return {
      success: true,
      url: finalUrl,
      publicUrl: finalUrl,
      path: data.path || finalUrl,
      bucket: data.bucket || cleanFolder,
      data,
      toString: () => finalUrl
    };
  } catch (error) {
    logger.error('uploadFileToSupabase exception:', error);
    return {
      success: false,
      error: error.message || 'Terjadi kesalahan sistem saat mengunggah file',
      url: '',
      publicUrl: ''
    };
  }
}

