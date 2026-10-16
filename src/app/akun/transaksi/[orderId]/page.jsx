import React, { Suspense } from 'react';
import DetailTransaksiClient, { DetailTransaksiSkeleton } from '@/components/account/DetailTransaksiClient';
import PageLayoutWrapper from '@/components/layout/PageLayoutWrapper';

export default async function DetailTransaksiAkunPage({ params }) {
  let resolvedParams = null;
  try {
    resolvedParams = await Promise.resolve(params);
  } catch (_) {
    resolvedParams = params;
  }

  const rawId = resolvedParams?.orderId || resolvedParams?.id || '';
  let orderId = '';
  if (rawId) {
    try {
      orderId = decodeURIComponent(String(rawId).trim());
    } catch (_) {
      orderId = String(rawId).trim();
    }
  }

  return (
    <PageLayoutWrapper>
      <Suspense fallback={<DetailTransaksiSkeleton />}>
        <DetailTransaksiClient orderId={orderId} />
      </Suspense>
    </PageLayoutWrapper>
  );
}
