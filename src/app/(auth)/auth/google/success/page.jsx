"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

function SuccessContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams?.get('token');
    const userParam = searchParams?.get('user');

    if (!token || !userParam) {
      setStatus('error');
      setError('Data tidak lengkap dari Google.');
      return;
    }

    try {
      const user = JSON.parse(decodeURIComponent(userParam));
      const fullUser = {
        ...user,
        sessionToken: token,
      };

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('tanico_user', JSON.stringify(fullUser));
          const isHttps = window.location.protocol === 'https:';
          const sameSiteClause = isHttps ? '; SameSite=None; Secure' : '; SameSite=Lax';
          document.cookie = `tanico_session=${token}; path=/${sameSiteClause}; max-age=${60 * 60 * 24 * 7}`;
        } catch (storageErr) {
          console.error('Failed to save session to localStorage/cookies:', storageErr);
        }
      }

      if (window.opener) {
        window.opener.postMessage({
          type: 'GOOGLE_AUTH_SUCCESS',
          user: fullUser,
        }, '*');
        setStatus('success');
        setTimeout(() => window.close(), 800);
      } else {
        setStatus('success');
        setTimeout(() => {
          window.location.href = '/checkout';
        }, 800);
      }
    } catch (err) {
      console.error('Error parsing user data:', err);
      setStatus('error');
      setError('Data pengguna tidak valid.');
    }
  }, [searchParams]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#F0F2F5]">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Memproses login...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#F0F2F5]">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
          <div className="text-red-600 text-4xl mb-4">✗</div>
          <p className="text-red-600 text-sm font-medium">{error}</p>
          <button
            onClick={() => window.close()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F0F2F5]">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
        <div className="text-green-600 text-4xl mb-4">✓</div>
        <p className="text-gray-700 font-semibold">Login Berhasil!</p>
        <p className="text-gray-500 text-sm mt-1">Tutup jendela ini dan kembali ke aplikasi.</p>
      </div>
    </div>
  );
}

export default function GoogleSuccessPage() {
  return <SuccessContent />;
}