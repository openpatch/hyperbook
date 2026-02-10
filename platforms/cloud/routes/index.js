var express = require('express');
var router = express.Router();

/* Health check */
router.get('/api/health', function(req, res) {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
