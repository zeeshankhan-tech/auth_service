const { Router } = require('express');
const { asyncHandler } = require('../utils/asyncHandler');

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: { status: 'ok' } });
  }),
);

module.exports = router;
