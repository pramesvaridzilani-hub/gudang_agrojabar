import { Request, Response } from 'express';
import prisma from '../../prisma/client';
import { sendNotificationToSellers } from '../sse.controller';

export const updateStockRequestStatusFromEcommerce = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, catatan } = req.body;

    if (!status) {
      return res.status(400).json({ statusCode: 400, message: 'Status wajib dicantumkan' });
    }

    const request = await prisma.pengajuanStokToko.findUnique({
      where: { ecommerceRequestId: id }
    });

    if (!request) {
      // Fallback: try by id
      const requestById = await prisma.pengajuanStokToko.findUnique({
        where: { id }
      });
      
      if (!requestById) {
        return res.status(404).json({ statusCode: 404, message: 'Pengajuan stok tidak ditemukan' });
      }
      
      await prisma.pengajuanStokToko.update({
        where: { id: requestById.id },
        data: { status, catatan }
      });
    } else {
      await prisma.pengajuanStokToko.update({
        where: { id: request.id },
        data: { status, catatan }
      });
    }

    console.log(`[Webhook] Pengajuan stok ${id} status updated to ${status} from Ecommerce`);
    return res.status(200).json({ statusCode: 200, message: 'Status berhasil diperbarui' });
  } catch (error) {
    console.error('[Webhook] Error updating status from ecommerce:', error);
    return res.status(500).json({ statusCode: 500, message: 'Internal server error' });
  }
};
