import prisma from '../services/prisma.js';

export async function getContacts(req, res) {
  try {
    const contacts = await prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    return res.json(contacts || []);
  } catch (error) {
    console.error('getContacts error:', error);
    return res.status(500).json({ error: 'Gagal memuat pesan kontak' });
  }
}

export async function submitContact(req, res) {
  try {
    const { name, email, phone, subject, message } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Nama, email, dan pesan wajib diisi' });
    }

    const newContact = await prisma.contactMessage.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : '',
        subject: subject ? subject.trim() : 'Pertanyaan Umum',
        message: message.trim()
      }
    });

    return res.status(201).json(newContact);
  } catch (error) {
    console.error('submitContact error:', error);
    return res.status(500).json({ error: 'Gagal mengirimkan pesan kontak' });
  }
}

export async function updateContact(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'ID pesan kontak diperlukan' });

    const { isRead, reply } = req.body || {};
    const updated = await prisma.contactMessage.update({
      where: { id },
      data: {
        ...(isRead !== undefined && { isRead }),
        ...(reply !== undefined && { reply })
      }
    });

    return res.json(updated);
  } catch (error) {
    console.error('updateContact error:', error);
    return res.status(500).json({ error: 'Gagal memperbarui kontak' });
  }
}

export async function deleteContact(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'ID pesan kontak diperlukan' });

    await prisma.contactMessage.delete({ where: { id } });
    return res.json({ success: true, message: 'Pesan kontak berhasil dihapus' });
  } catch (error) {
    console.error('deleteContact error:', error);
    return res.status(500).json({ error: 'Gagal menghapus pesan kontak' });
  }
}
