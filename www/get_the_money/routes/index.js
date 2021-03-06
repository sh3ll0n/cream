var crypto = require('crypto'),
    mail = require('mail').Mail({
      host: 'localhost',
      port: 25
    }),
    qs = require('querystring'),
    util = require('util'),

    conf = require('../etc/config'),
    profiles = require('../lib/profiles'),
    browserid = require('connect-browserid'),
    format_money = require('../lib/money_util').format_money,
    payments = require('../lib/payments');

// Routes

/*       username: 'me@gmail.com',
      password: '**password**' */
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', {});
};

exports.register = function (req, res) {
  if (browserid.enforceLogIn(req, res)) return;

  if (req.method === 'POST') {
    profiles.setProfile({
      email: req.user,
      fullName: req.body.fullName
    }, req, res, function (err) {
      if (err) res.render('register', {fullName: req.params.fullName});
      // TODO support a next query string param here...
      res.redirect('/recent');
    });
  } else {
    return res.render('register', { fullName: ''});
  }
};

exports.recent = function(req, res) {
  if (browserid.enforceLogIn(req, res)) return;
  //profiles.getProfile(req.user, req, res, function (exists, profile) {
    //console.log(profile);
    //if (exists) {
      payments.recent(req.user, function (recent_data) {
        res.render('recent', {
          payments: recent_data.payments, 
          income: recent_data.income, 
          requests: recent_data.requests, 
          requested: recent_data.requested, 
          format_money: format_money});
      });
    //} else {
      //res.redirect('/register');
    //}
  //});
};

exports.direct = function (template) {
  return function(req, res){
    res.render(template);
  };
};

exports.ask_for_cash = function(req, res){
  if (browserid.enforceLogIn(req, res)) return;
//  profiles.getProfile(req.user, req, res, function (exists, profile) {
    //util.debug(util.format('getProfile callback %s %s', exists, profile));
    //util.debug(exists);
    //util.debug(util.inspect(profile));    
    //if (exists) {
      if (req.method === 'POST') {
        var email = req.body.email,
            senders_email = req.user,
            amount = parseInt(req.body.dollaramount, 10) * 100 + parseInt(req.body.centamount, 10);
        payments.paymentRequested(senders_email, email, 
                                  amount, function (err, payReq) {
        if (err) throw err;
          //profile['fullName']
          var message_body = util.format('%s has asked you for %s.\n\n' +
                'You can pay them by visiting:\n' + conf.browserid_audience +
                '/pay/%s/%s\n', req.user, format_money(amount),
                                         qs.escape(email), qs.escape(payReq.id));
                                      
          console.info(message_body);
          mail.message({
            from: conf.system_email,
            'reply-to': senders_email,
            to: [email],
            cc: [senders_email],
            subject: util.format('%s has asked you for %s', req.user, format_money(amount))
          })
          .body(message_body)

          .send(function(err) {
           //if (err) throw err;
            console.log(err);
            console.log(message_body);
          });

          res.redirect('/recent');
        }); // payments.paymentRequested

      // Not POST
      } else {
        res.render('ask_for_cash', {email: 'hobo', _:function (msgid) { return msgid.toUpperCase(); }});
      }
    //} else {
      //console.info("No profile data, please register");
      //res.redirect('/register');
    //}
  //}); profile
};

exports.pay = function(req, res){
  console.info(req.params.email); 
  // Three possibilities
  // 1) no auth - capture details to session and redirect
  // 2) fresh auth - check session and continue
  // 3) auth - use request params and continue
  var pay_req_id, email;
  if (! req.user) {
      var pay_info = { email: req.params.email,
                       pay_req_id: req.params.pay_req_id};
      req.session.pay_info = pay_info;
      res.render('pay_login');

      return;
  } else if (req.session.pay_info){   
    pay_req_id = req.session.pay_info.pay_req_id;
  } else {
    pay_req_id = req.params.pay_req_id;
  }
  email = req.session.user;
  console.log('email=%s id=%s', email, pay_req_id);
  payments.paymentRequest(pay_req_id, function (err, pay_req) {
    //requesteeEmail: requesteeEmail,
    res.render('pay', { requestorEmail: pay_req.requestorEmail, 
                        display_amount: format_money(pay_req.amount),
                        amount: pay_req.amount });
  });
};

exports.create_reciept = function (req, resp) {
  if (browserid.enforceLogIn(req, resp)) return;
  var tx_id = req.body.transaction_id,
      reciept = {
        amount: req.body.actual_amount,
        currency: req.body.currency,
        date: req.body.date,
        customer_email: req.user,
        merchant_email: req.body.merchant_email,
        payment_type: req.body.payment_type,
        transaction_id: tx_id
      },
      url = util.format('/reciept/%s', tx_id);
  payments.recordReciept(reciept, function (err, pay_req) {
    if (err) {
      resp.send(err, 500);
    } else {
      resp.redirect(url);
    }
  });
};

exports.reciept = function (req, resp) {
  if (browserid.enforceLogIn(req, resp)) return;
  payments.reciept(req.params.transaction_id, function (err, reciept) {
    if (err)
      resp.send(err, 500);
    else
      resp.render('reciept', {reciept: reciept, format_money: format_money});
  });
};

// Middleware
exports.localVars = function (req, res, next) {
  var vars = {
    title: 'Get the Money',
    authenticated: false,
    cream_host: conf.wallet_host
  };
  if (req.user) {
    vars.authenticated = true;
    vars.gravatar = 'http://www.gravatar.com/avatar/' +
          crypto.createHash('md5').update(req.user.toLowerCase()).digest('hex');
  }
  for (var k in vars) {
    res.local(k, vars[k]);
  }
  res.local('page_scripts', []);
  next();
};