var OrviboAllOne = require("./allone.js");
var o = new OrviboAllOne();

o.on('messagereceived', function(message, remote) {
    c("Message received from: " + remote + ". Was: " + message.toString('hex'));
});

o.on('messageSent', function(message, sHost, server) {
    c("Sending message to " + sHost + " from " + server + ". Message is: " + message.toString('hex'));
});

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

o.on('socketfound', function(index) { 
	clearInterval(t);
	c("Socket found! Index is " + index + ". Subscribing .."); 
	o.subscribe(); 
	c("Rediscovering sockets ..");
	o.discover();
}) // We've found a socket. Subscribe to

o.on('subscribed', function(index, state) { 
	c("Socket index " + index + " successfully subscribed. State is " + state + ". Querying ..");
	o.query(); 
}); // We've subscribed to our device. Now we need to grab its name!

o.on('queried', function(index, name) {
	c("Socket " + index + " has a name. It's " + name);

});

function c(text) {
	console.log(text);
}
o.prepare();

