import React from 'react';
import { getHomeData } from '@/lib/home';
import StorefrontHomePageClient from '@/components/home/StorefrontHomePageClient';

export const revalidate = 30;

export default async function StorefrontHomePage() {
  let homeData = null;
  try {
    homeData = await getHomeData();
  } catch (error) {
    console.error('Server Component getHomeData error:', error);
  }

  return <StorefrontHomePageClient initialData={homeData} />;
}