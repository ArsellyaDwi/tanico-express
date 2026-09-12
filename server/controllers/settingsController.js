import prisma from '../services/prisma.js';
import { clearHomeCache } from '../services/cache.js';

const DEFAULT_SETTINGS = {
  id: 'default',
  logoText: 'TaniCo',
  tagline: 'Murni Organik',
  websiteName: 'TaniCo — Sayur Segar Organik',
  address: 'Jl. Raya Pemali No. 45, Bangka',
  googleMapsUrl: 'https://maps.google.com',
  whatsappNumber: '+628127300400',
  instagramUrl: 'https://instagram.com/tanico.bangka',
  facebookUrl: 'https://facebook.com/TaniCoBangka',
  emailAddress: 'halo@tanico.id',
  operationalHours: 'Setiap Hari: 07.00 - 17.00 WIB',
  footerText: '© 2026 TaniCo. Hak Cipta Dilindungi.',
  seoKeywords: 'sayur organik, sayur segar bangka, tanico, sayur sehat',
  homepageCMS: '{}',
  contactsCMS: '{}'
};

export async function getSettings(req, res) {
  try {
    const setting = await prisma.websiteSetting.findFirst().catch(() => null);
    if (!setting) {
      return res.json(DEFAULT_SETTINGS);
    }
    return res.json(setting);
  } catch (error) {
    console.error('getSettings error:', error);
    return res.json(DEFAULT_SETTINGS);
  }
}

export async function updateSettings(req, res) {
  try {
    const body = req.body || {};
    let setting = await prisma.websiteSetting.findFirst();

    if (!setting) {
      setting = await prisma.websiteSetting.create({
        data: {
          id: 'default',
          ...DEFAULT_SETTINGS,
          ...body,
          ...(body.homepageCMS && typeof body.homepageCMS === 'object' && {
            homepageCMS: JSON.stringify(body.homepageCMS)
          }),
          ...(body.contactsCMS && typeof body.contactsCMS === 'object' && {
            contactsCMS: JSON.stringify(body.contactsCMS)
          })
        }
      });
    } else {
      setting = await prisma.websiteSetting.update({
        where: { id: setting.id },
        data: {
          ...body,
          ...(body.homepageCMS && typeof body.homepageCMS === 'object' && {
            homepageCMS: JSON.stringify(body.homepageCMS)
          }),
          ...(body.contactsCMS && typeof body.contactsCMS === 'object' && {
            contactsCMS: JSON.stringify(body.contactsCMS)
          })
        }
      });
    }

    clearHomeCache();
    return res.json(setting);
  } catch (error) {
    console.error('updateSettings error:', error);
    return res.status(500).json({ error: 'Gagal memperbarui pengaturan' });
  }
}
