$('#make-payment').live('submit', function(event) {
  event.preventDefault();
  //var amount = parseFloat($('#make-payment #amount').val()) * 100;
  // amount 1000 is $10.00
  var amount = parseInt($('#amount-dollar', $(this)).val()) * 100 +
               parseInt($('#amount-cents', $(this)).val());
  var process_reciept = function (reciept) {
    console.log(reciept);
    var f = $('#make-reciept');
    $('[name=actual_amount]', f).attr('value', reciept.amount);
    $('[name=currency]', f).attr('value', reciept.currency);
    $('[name=date]', f).attr('value', reciept.date);
    $('[name=merchant_email]', f).attr('value', reciept.merchant_email);
    $('[name=payment_type]', f).attr('value', reciept.payment_type);
    $('[name=transaction_id]', f).attr('value', reciept.transaction);
    console.log('submitting');
    f.submit();
  };
  navigator.payz(amount, ['VISA', 'IOU'],
                 // Which side has recipient
                 {
                   reciever: 'shout@ozten.com',
                   //TODO How do we know what business this is?
                   // TODO how do we route their pahyment?
                   payee: 'eozten@yahoo.com',
                   description: 'Buy used couch',
                   success: process_reciept,
                   failure: function (error) { console.error(error); }
                 });
  return false;
});