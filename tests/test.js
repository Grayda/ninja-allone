// A test file for the AllOne. Finds, subscribes and queries all devices
// Press the button on the top of your AllOne to put it into learning mode

var OrviboAllOne = require("../lib/allone.js");
var o = new OrviboAllOne();

o.on("ready", function() {
	c("Ready. Now detecting sockets");
	t = setInterval(function() {
        c("Discovery timer set");
		o.discover();
	}, 1000);
});

o.on("discovering", function() {
	c("Discovering sockets ..");
});

o.on('allonefound', function(index, addr, mac) { 
	clearInterval(t);
	c("Socket found! Index is " + index + ". Address is " + addr + " and MAC is " + mac + ". Subscribing .."); 
	o.subscribe(); 
	c("Rediscovering sockets ..");
	o.discover();
}) // We've found a socket. Subscribe to

o.on('buttonpress', function(index) {
    c("Button was pressed on Orvibo: " + index);
    c("Putting the AllOne into learning mode ..");
    o.enterLearningMode(index);
});

o.on('subscribed', function(index, state) { 
	c("Socket index " + index + " successfully subscribed.");
    console.dir(o.hosts);
	o.query(); 
}); // We've subscribed to our device. Now we need to grab its name!

o.on('queried', function(index, name) {
	c("Socket " + index + " has a name: " + name);
});

o.on('emitting', function(index, ir) {
   c("Emitting: " + ir.toString());
});

o.on("ircode", function(message) {
   c("IR code received [BETA]: " +  message);
});

o.on('messagereceived', function(message, remote) {
    c("Message received from: " + remote + ". Was: " + message.toString('hex'));
});

o.on('messageSent', function(message, sHost, server) {
    c("Sending message to " + sHost + " from " + server + ". Message is: " + message.toString('hex'));
});

function c(text) {
	console.log(text);
}
o.prepare();

