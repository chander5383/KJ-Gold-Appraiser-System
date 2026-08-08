const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getCertificates,
  getCertificate,
  createCertificate,
  updateCertificate,
  deleteCertificate,
  previewNextCertNo,
  searchCertificates,
  duplicateCertificate
} = require('../controllers/certificate.controller');

// All routes require authentication
router.use(authenticateToken);

// Certificate CRUD
router.get('/', getCertificates);
router.get('/next-number', previewNextCertNo);
router.get('/search', searchCertificates);
router.get('/:id', getCertificate);
router.post('/', createCertificate);
router.put('/:id', updateCertificate);
router.delete('/:id', deleteCertificate);
router.post('/:id/duplicate', duplicateCertificate);

module.exports = router;
