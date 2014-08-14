var configMessages = require('./config-messages');

/**
 * Called from the driver's config method when a
 * user wants to see a menu to configure the driver
 * @param  {Function} cb Callback to send a response back to the user
 */
exports.menu = function(cb) {

  cb(null,configMessages.menu);
};

/**
 * Called when a user clicks the 'Echo back to me'
 * button we sent in the menu request
 * @param  {Object}   params Parameter object
 * @param  {Function} cb     Callback to send back to the user
 */
exports.echo = function(params,cb) {

  var echoText = params.echoText;
  var payloadToSend = configMessages.echo;

  payloadToSend.contents.push({ "type": "paragraph", "text": params.hello_text });
  payloadToSend.contents.push({ "type": "close"    , "name": "Close" });

  cb(null,payloadToSend);
};