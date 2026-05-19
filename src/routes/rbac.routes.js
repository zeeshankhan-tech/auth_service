const { Router } = require('express');
const { authenticate } = require('../middlewares/authenticate.middleware');
const { authorize } = require('../middlewares/authorize.middleware');
const { ROLES } = require('../constants/roles');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiResponseDto } = require('../dtos');
const { HTTP_STATUS } = require('../constants/http');

const router = Router();

router.get(
  '/admin/ping',
  authenticate(),
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseDto.success({ message: 'admin-ok', userId: req.auth.userId }));
  }),
);

router.get(
  '/seller/ping',
  authenticate(),
  authorize(ROLES.SELLER, ROLES.ADMIN, ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseDto.success({ message: 'seller-ok', userId: req.auth.userId }));
  }),
);

module.exports = router;
