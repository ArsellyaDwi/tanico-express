import '@/app/globals.css';
import ClientCursor from '@/components/ui/ClientCursor';
import ClientFontLoader from '@/components/ui/ClientFontLoader';

const baseUrl = process.env.APP_URL || 'https://tanico.id';

export const metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'TaniCo',
    template: '%s | TaniCo'
  },
  description: 'A high-fidelity, premium, and beautifully minimalist e-commerce platform for curated fresh organic and hydroponic vegetables, featuring sustainable farm stories and editorial layouts.',
  keywords: ['sayur segar', 'sayur organik bangka', 'hidroponik bangka', 'tanico', 'belanja sayur online', 'petani lokal'],
  authors: [{ name: 'TaniCo Indonesia' }],
  creator: 'TaniCo',
  publisher: 'TaniCo',
  formatDetection: {
    email: false,
    address: false,
    telephone: false
  },
  alternates: {
    canonical: './'
  },
  openGraph: {
    title: 'TaniCo',
    description: 'A high-fidelity, premium, and beautifully minimalist e-commerce platform for curated fresh organic and hydroponic vegetables, featuring sustainable farm stories and editorial layouts.',
    url: baseUrl,
    siteName: 'TaniCo',
    locale: 'id_ID',
    type: 'website',
    images: []
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TaniCo',
    description: 'Belanja sayur segar langsung dari kebun lokal Bangka.',
    images: []
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1
    }
  }
};

export default function RootLayout({ children }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'TaniCo',
    url: baseUrl,
    logo: `${baseUrl}/favicon.ico`,
    description: 'Platform belanja sayuran segar, organik, dan hidroponik langsung dari petani lokal Bangka.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Jl. Raya Pemali No. 45',
      addressLocality: 'Sungailiat',
      addressRegion: 'Bangka',
      addressCountry: 'ID'
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+628127300400',
      contactType: 'Customer Service',
      areaServed: 'ID',
      availableLanguage: 'Indonesian'
    }
  };

  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window === 'undefined' || !window.Element) return;
                var origSetAttr = Element.prototype.setAttribute;
                Element.prototype.setAttribute = function(name, value) {
                  if (name && typeof name === 'string' && name.toLowerCase() === 'fdprocessedid') {
                    return;
                  }
                  return origSetAttr.apply(this, arguments);
                };
                try {
                  Object.defineProperty(HTMLElement.prototype, 'fdprocessedid', {
                    get: function() { return undefined; },
                    set: function() {},
                    configurable: true
                  });
                } catch(e) {}
                if (typeof MutationObserver !== 'undefined') {
                  var obs = new MutationObserver(function(muts) {
                    for (var i = 0; i < muts.length; i++) {
                      var m = muts[i];
                      if (m.type === 'attributes' && m.attributeName && m.attributeName.toLowerCase() === 'fdprocessedid') {
                        m.target.removeAttribute(m.attributeName);
                      }
                    }
                  });
                  obs.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['fdprocessedid'] });
                }
              })();
            `
          }}
        />
      </head>
      <body suppressHydrationWarning className="bg-[#FCFCFC] text-[#174C3C] font-sans antialiased selection:bg-[#DCEFE0] selection:text-[#174C3C]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ClientFontLoader />
        <ClientCursor />
        {children}
      </body>
    </html>
  );
}
