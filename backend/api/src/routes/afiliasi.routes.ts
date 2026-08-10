import { Router } from 'express';
import * as afiliasiController from '../controllers/afiliasi.controller';

const router = Router();

router.get('/list-all', afiliasiController.listAfiliasiAdmin);
router.get('/petani-tersedia', afiliasiController.getPetaniTersedia);
router.post('/manual', afiliasiController.createAfiliasiManual);
router.put('/:id', afiliasiController.updateAfiliasi);
router.delete('/:id', afiliasiController.deleteAfiliasi);

export default router;
