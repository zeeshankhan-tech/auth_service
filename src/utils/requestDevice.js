function getDeviceInfo(req) {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? ua.slice(0, 512) : '';
}

module.exports = { getDeviceInfo };
