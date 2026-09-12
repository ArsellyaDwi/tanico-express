export function buildStorageUrl(path) {
  if (!path || typeof path !== 'string') return '';
  const trimmed = path.trim();
  if (!trimmed) return '';

  // Already a complete URL or data/blob URI
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sfjynaclpdsaedhqwkqb.supabase.co';
  const cleanBase = supabaseUrl.replace(/\/+$/, '');
  const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;

  // If path already includes storage/v1/object/public
  if (cleanPath.startsWith('storage/v1/object/public/')) {
    return `${cleanBase}/${cleanPath}`;
  }

  // If path starts with known bucket name
  if (
    cleanPath.startsWith('categories/') ||
    cleanPath.startsWith('partners/') ||
    cleanPath.startsWith('hero/') ||
    cleanPath.startsWith('products/') ||
    cleanPath.startsWith('gallery/') ||
    cleanPath.startsWith('articles/') ||
    cleanPath.startsWith('testimonials/') ||
    cleanPath.startsWith('tanico-public/') ||
    cleanPath.startsWith('tanico-uploads/')
  ) {
    return `${cleanBase}/storage/v1/object/public/${cleanPath}`;
  }

  return `${cleanBase}/storage/v1/object/public/tanico-uploads/${cleanPath}`;
}

export default buildStorageUrl;

