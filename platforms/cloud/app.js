var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');
var db = require('./lib/db');

var indexRouter = require('./routes/index');
var authRouter = require('./routes/auth');
var storeRouter = require('./routes/store');
var adminApiRouter = require('./routes/admin');
var adminViewsRouter = require('./routes/admin-views');

var app = express();

var PORT = process.env.PORT || 3001;

var corsOrigins = [process.env.BASE_URL];

app.use(cors({
  origin: async function(origin, callback) {
    if (!origin) return callback(null, true);

    var selfOrigin = 'http://localhost:' + PORT;
    if (origin === selfOrigin) return callback(null, true);

    if (corsOrigins.includes(origin)) return callback(null, true);

    try {
      var hyperbooks = await db.allAsync(
        'SELECT url FROM hyperbooks WHERE url IS NOT NULL'
      );
      for (var i = 0; i < hyperbooks.length; i++) {
        var hb = hyperbooks[i];
        if (typeof hb.url === 'string') {
          var hbOrigin = new URL(hb.url).origin;
          if (hbOrigin === origin) return callback(null, true);
        }
      }
    } catch (e) {
      // DB not ready yet or query failed
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Health check (before auth-protected routes)
app.use('/', indexRouter);

// API routes
app.use('/api/auth', authRouter);
app.use('/api/store', storeRouter);
app.use('/api', adminApiRouter);

// Server-rendered views
app.use('/', adminViewsRouter);

// 404 handler
app.use(function(req, res) {
  res.status(404).json({ error: 'Not found' });
});

// error handler
app.use(function(err, req, res, _next) {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
