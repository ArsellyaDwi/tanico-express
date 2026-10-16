"use client";

import React from 'react';

/**
 * Transparent pass-through wrapper.
 * Persistent layouts are now maintained at the App Router layout segment level
 * (src/app/(public)/layout.jsx, src/app/account/layout.jsx, src/app/(auth)/layout.jsx, src/app/admin/layout.jsx)
 * preventing layout remounts, state loss, and Header/Footer resets on navigation.
 */
export default function PageLayoutWrapper({ children }) {
  return <>{children}</>;
}
