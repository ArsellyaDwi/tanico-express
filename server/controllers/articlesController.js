import prisma from '../services/prisma.js';
import { getCacheItem, setCacheItem, clearHomeCache } from '../services/cache.js';
import { safeDeleteFileFromSupabase, handleMediaReplacement } from '../services/supabase.js';

export async function getArticles(req, res) {
  try {
    const { category, search, limit = 24, all, homepage, kisahMitra, slug } = req.query;

    if (slug) {
      let article = await prisma.article.findUnique({
        where: { slug: String(slug).toLowerCase().trim() }
      }).catch(() => null);
      if (!article) {
        article = await prisma.article.findUnique({
          where: { id: String(slug) }
        }).catch(() => null);
      }
      return res.json(article || null);
    }

    const where = {};
    if (all !== 'true') {
      where.status = { notIn: ['Draft', 'Nonaktif', 'draft', 'nonaktif'] };
    }

    if (category && category !== 'Semua') {
      where.category = { equals: String(category), mode: 'insensitive' };
    }

    if (homepage === 'true') {
      where.showOnHomepage = true;
    }

    if (kisahMitra === 'true') {
      where.showOnKisahMitra = true;
    }

    if (search) {
      where.OR = [
        { title: { contains: String(search), mode: 'insensitive' } },
        { excerpt: { contains: String(search), mode: 'insensitive' } },
        { content: { contains: String(search), mode: 'insensitive' } }
      ];
    }

    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
    const articles = await prisma.article.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limitNum
    });

    return res.json(articles || []);
  } catch (error) {
    console.error('getArticles error:', error);
    return res.status(500).json({ error: 'Gagal memuat artikel' });
  }
}

export async function getArticleBySlug(req, res) {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({ error: 'Slug artikel wajib diisi' });
    }

    const decodedSlug = decodeURIComponent(slug).trim().toLowerCase();
    const cacheKey = `article_slug_${decodedSlug}`;
    const cached = getCacheItem(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    let article = await prisma.article.findUnique({
      where: { slug: decodedSlug }
    }).catch(() => null);

    if (!article) {
      article = await prisma.article.findFirst({
        where: {
          OR: [
            { slug: { equals: decodedSlug, mode: 'insensitive' } },
            { id: decodedSlug }
          ]
        }
      }).catch(() => null);
    }

    if (!article) {
      return res.status(404).json({ error: 'Artikel tidak ditemukan' });
    }

    setCacheItem(cacheKey, article, 60 * 1000);
    return res.json(article);
  } catch (error) {
    console.error('getArticleBySlug error:', error);
    return res.status(500).json({ error: 'Gagal memuat artikel' });
  }
}

export async function createArticle(req, res) {
  try {
    const {
      title,
      slug,
      category,
      author,
      image,
      excerpt,
      content,
      readTime,
      date,
      status,
      showOnHomepage,
      showOnKisahMitra,
      subtitle
    } = req.body || {};

    if (!title || !content) {
      return res.status(400).json({ error: 'Judul dan konten wajib diisi' });
    }

    const generatedSlug = slug || title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const newArticle = await prisma.article.create({
      data: {
        title: title.trim(),
        slug: generatedSlug,
        category: category || 'Edukasi',
        author: author || 'Tim TaniCo',
        image: image || '',
        excerpt: excerpt || '',
        content,
        readTime: readTime || '5 min baca',
        date: date || new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
        status: status || 'published',
        showOnHomepage: showOnHomepage !== false,
        showOnKisahMitra: showOnKisahMitra === true,
        subtitle: subtitle || ''
      }
    });

    clearHomeCache();
    return res.status(201).json(newArticle);
  } catch (error) {
    console.error('createArticle error:', error);
    return res.status(500).json({ error: 'Gagal membuat artikel' });
  }
}

export async function updateArticle(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'ID artikel wajib ada' });

    const existing = await prisma.article.findUnique({ where: { id } });

    const {
      title,
      slug,
      category,
      author,
      image,
      excerpt,
      content,
      readTime,
      date,
      status,
      showOnHomepage,
      showOnKisahMitra,
      subtitle
    } = req.body || {};

    const updated = await prisma.article.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(slug !== undefined && { slug }),
        ...(category !== undefined && { category }),
        ...(author !== undefined && { author }),
        ...(image !== undefined && { image }),
        ...(excerpt !== undefined && { excerpt }),
        ...(content !== undefined && { content }),
        ...(readTime !== undefined && { readTime }),
        ...(date !== undefined && { date }),
        ...(status !== undefined && { status }),
        ...(showOnHomepage !== undefined && { showOnHomepage }),
        ...(showOnKisahMitra !== undefined && { showOnKisahMitra }),
        ...(subtitle !== undefined && { subtitle })
      }
    });

    if (image !== undefined && existing?.image && existing.image !== image) {
      await handleMediaReplacement(existing.image, image, 'articles').catch(() => {});
    }

    clearHomeCache();
    return res.json(updated);
  } catch (error) {
    console.error('updateArticle error:', error);
    return res.status(500).json({ error: 'Gagal memperbarui artikel' });
  }
}

export async function deleteArticle(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'ID artikel wajib diisi' });

    const article = await prisma.article.findUnique({ where: { id } });
    await prisma.article.delete({ where: { id } });

    if (article?.image) {
      await safeDeleteFileFromSupabase(article.image, 'articles').catch(() => {});
    }

    clearHomeCache();
    return res.json({ success: true, message: 'Artikel berhasil dihapus' });
  } catch (error) {
    console.error('deleteArticle error:', error);
    return res.status(500).json({ error: 'Gagal menghapus artikel' });
  }
}
