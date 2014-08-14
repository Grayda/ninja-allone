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

o.on('allonefound', function(index, addr, mac) { 
	clearInterval(t);
	c("Socket found! Index is " + index + ". Address is " + addr + " and MAC is " + mac + ". Subscribing .."); 
	o.subscribe(); 
	c("Rediscovering sockets ..");
	o.discover();
}) // We've found a socket. Subscribe to

o.on('subscribed', function(index, state) { 
	c("Socket index " + index + " successfully subscribed.");
    console.dir(o.hosts);
	o.query(); 
}); // We've subscribed to our device. Now we need to grab its name!

o.on('queried', function(index, name) {
	c("Socket " + index + " has a name [BETA]: " + name);
    c("Emitting IR");
    
    setInterval(function() {
        o.emitIR(index, "00000000A000000000000000000090002023801135022602E9015A02FD015B0235022502E9015902FE015F0232027906FF015A0235027B060202C506E701C70636027A060202C506EA01C50637022402E801C60636022502E801C50636022602E8015A02FD01C906E90159020002590235022502E901C40637022502E801C50637027A060202570237027806FF01C806EA01C5063702FC9B2F23BD08E8010000".toLowerCase());
    }, 5000);
});

o.on('emitting', function(index, ir) {
   c("Emitting: " + ir.toString()); 
});

o.on("ircode", function(message) {
   c("IR code received [BETA]: " +  message);
});

function c(text) {
	console.log(text);
}
o.prepare();

