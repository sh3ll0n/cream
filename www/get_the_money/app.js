var browserid = require('connect-browserid'),
    clientSessions = require("client-sessions"),
    express = require('express'),
    routes = require('./routes'),

    conf = require('./config'),
    profiles = require('./lib/profiles');

var app = module.exports = express.createServer();

// Configuration
app.configure('development', function(){
  app.use(browserid.guarantee_audience);
  app.use(function (req, resp, next) {
    if (req.url == '/favicon.ico') {
      resp.send('wha', 404);
    } else {
      next();
    }
  });
});

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.compiler({ enable: ['less'],
                             src: './public'}));
  app.use(express.static(__dirname + '/public'));
  app.use(express.bodyParser());
  app.use(express.logger());
  app.use(express.responseTime());
  app.use(express.methodOverride());
  app.use(clientSessions({
    cookieName: 'session_state',
    secret: conf.session_sekrit,
    duration: 6 * 24 * 60 * 60 * 1000, // 1 day
    cookie: {
      maxAge: 14 * 24 * 60 * 60 * 1000 // 2 weeks
    }
  }));
  app.use(browserid.authUser({ secret: conf.browserid_sekrit,
                               audience: conf.browserid_audience }));
  app.use(routes.localVars);
  app.use(app.router);
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Helpers
app.dynamicHelpers({
  session: function (req, res) {
    return req.session;
  },
});


// Routes
//     Static
app.get('/', routes.index);
app.get('/about', routes.direct('about'));
//     Profile
app.get('/register', routes.register);
app.post('/register', routes.register);

//     Cash
app.get('/recent', routes.recent);

app.get('/ask-for-cash', routes.ask_for_cash);
app.post('/ask-for-cash', routes.ask_for_cash);

app.get('/pay/:email/:pay_req_id', routes.pay);
app.post('/reciept', routes.create_reciept);
app.get('/reciept/:transaction_id', routes.reciept);

// Auth
app.post('/auth', browserid.auth({ next: '/register' }));
browserid.events.on('login', function (verified_email, req, resp) {
  console.log('logged in event, ', verified_email);
});
app.get('/logout', browserid.logout({ next: '/' }));

// Startup
app.listen(3000);
console.log(app.address());

console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
