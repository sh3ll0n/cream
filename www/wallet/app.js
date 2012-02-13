var browserid = require('connect-browserid'),
    clientSessions = require("client-sessions"),
    express = require('express'),

    db = require('./lib/db'),
    conf = require('./config'),
    routes = require('./routes'),
    userdb = require('./lib/userdb');

var app = module.exports = express.createServer();

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.logger());
  app.use(express.responseTime());
  app.use(express.methodOverride());
  app.use(clientSessions({
    cookieName: 'session_state',
    secret: conf.session_sekrit,
    duration: 24 * 60 * 60 * 1000 // 1 day
  }));

  app.use(browserid.authUser({ secret: conf.browserid_sekrit,
                               audience: conf.browserid_audience }));
  app.use(browserid.guarantee_audience);
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes

app.get('/include.js', routes.lift);

app.get('/', routes.index);

app.get('/pay', routes.pay);
app.get('/existing-payment', routes.existing_payment);

app.post('/auth', browserid.auth());
browserid.events.on('login', function (verified_email, req, resp) {
  console.log('logged in event, creating user');
  console.log('vep', verified_email);
  console.log('req', req);
  console.log('resp', resp);
  db.withDb(function (err, conn, db) {
    if (err) { console.error(err); return; }
    userdb.create_user(conn, verified_email, function (err, db_res) {
      console.log('Created user', err, db_res);
    });
  });
});
app.get('/logout', browserid.logout({next:'/'}));

// AJAX partial
app.get('/add-payment-method', routes.add_payment_method);

app.post('/stripe-add-payment', routes.stripe_add_payment);

app.post('/pay-transaction', routes.pay_transaction);

app.listen(3001);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
