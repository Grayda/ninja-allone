/*
  * Orvibo AllOne Module
  * --------------------
  *
  * This library lets you control an Orvibo AllOne IR Blaster from node.js
  *
  * Usage
  * ------
  * You need to set your AllOne up using the WiWo app first. This code only controls an already set up socket
  * Require the allone.js file, create a new instance of OrviboAllOne, then call the prepare function, the discover function, the subscribe function, then emitIR
  * Use "on" or callbacks to listen for events
  * 
  * Emits
  * ------
  * allonefound (index, IP address, MAC address) - New AllOne has been found
  * namechanged (old name, new name) - Socket name has changed.
  * queried (name of socket, index) - .query() has been called, but no confirmation received yet
  * subscribed (index, state) - Same as above, but for .subscribe()
  * statechanged (index, state) - The state has been changed by other means (e.g. Physical button press, button press in the SmartPoint app)
  * messagerecieved (message, remote IP address, type of message) - A message has been received. Type of message is just a human-readable string (e.g. "Socket Found message")
  * ready - Emitted after .prepare() is called and signifies that the user is ready to start discovering sockets
  * discovering - .discover() has been called and no confirmation has been received yet
  * subscribing (index) - Same as above, but for .subscribe()
  * querying (index) - Same as above, but for .query();
  * messageSent (message, remote IP address, local IP address) - A message has been sent.
  * emitting (index, message) - We're trying to emit some IR. message is the IR being sent
  * emitted (index) - We've asked to emit some data, and we've had confirmation
*/

var util = require("util"); // For inheriting the EventEmitter stuff so we can use it via this.emit();
var EventEmitter = require("events").EventEmitter; // For emitting events so other node.js libraries and code can react to what we're doing here
var os = require("os"); // Used to check if we're running Windows, Linux or Mac (needed so we don't crash our app while binding our socket. Stupid bugs!
var _s = require("underscore.string");

var sDgram = require('dgram'); // this library gives us UDP support
var scktClient = sDgram.createSocket('udp4'); // For sending data
var scktServer = sDgram.createSocket('udp4'); // For receiving data

var localIP = getBroadcastAddress(); // Get our local IP address
var broadcastip = "255.255.255.255"; // Where we'll send our first discovery packet

var hosts = []; // The array that will hold all of our disocvered sockets
var port = 10000 // The port we'll connect on
var payload = []; // The data we'll be sending
var twenties = ['0x20', '0x20', '0x20', '0x20', '0x20', '0x20']; // this appears at the end of a few packets we send, so put it here for shortness of code. It's padding for the MAC address, mostly

var e = new EventEmitter(); // For emitting events such as "power changed" etc.

util.inherits(OrviboAllOne, EventEmitter); // We want to get all the benefits of EventEmitter, but in our own class. this means we can use this.emit("Derp");

function OrviboAllOne() { // The main function in our module. AFAIK, this is akin to a class myClass { } thing in PHP
	EventEmitter.call(this); // Needed so we can emit() from this module

	scktServer.on('message', function (message, remote) { // We've got a message back from the network
	    if (remote.address != localIP) { // Check message isn't from us

	        var MessageHex = new Buffer(message).toString('hex'); // Convert our message into a string of hex
            
			var macAddress = MessageHex.substr(MessageHex.indexOf('accf'), 12); // Look for the first occurance of ACCF (the start of our MAC address) and grab it, plus the next 12 bytes
			var type; // A human-readable version of what message we've received
			
			index = hosts.map(function(e) { return e.macaddress; }).indexOf(macAddress); // Use the arr.map() and indexOf functions to find out where in our array, our AllOne is

			switch(MessageHex.substr(8,4)) { // Go 4 bytes in (4x2, remember?) and get the next 2 bytes. This is our command ID
				case "7161": // We've asked for all sockets on the network, and smoeone has replied!
                    
                    if(index == -1 && MessageHex.indexOf("4952443030") > -1) { // If we haven't got this IP address in our host array yet AND the packet is from a known AllOne (because IR00 appears in the packet) ..
                    
						hosts.push({ // Add it to our array
							"name": "", // The name of our socket. We don't know it yet!
							"ipaddress": remote.address, // The IP address of our socket
							"macaddress": macAddress, // And the MAC address
							"subscribed": false, // We haven't subscribed to this socket yet
						});
						type = "Discovery packet"; // Output the type of packet we've got (to make debugging outputs easier to read)
						this.emit("allonefound", hosts.length - 1, remote.address, macAddress); // Tell the world we've found a socket!
					}
					break;
                    
                case "6963": // We've asked to emit some IR and it's been done. 
                    this.emit("emitted", index);
                    break;
                    
				case "7274": // We've queried the socket for the name, and we've got data coming back
					if(hosts[index].name === "") { // If we haven't added the name of our socket to our array yet
						var strName = MessageHex.split("202020202020")[4]; // We want everything after the fourth 202020202020 which is where our name starts
						strName = strName.substr(0,32).toString('hex'); // And we want the next 32 bytes, as this is how long our name is. When we get it, trim the whitespace off.
						if(strName == "ffffffffffffffffffffffffffffffff") { // When no name is set, we get lots of FFFF's back, so if we see that 
							strName = "Orvibo Socket " + macAddress; // Set our name to something standard
						} else {
							strName = hex2a(strName.toString('hex')); // Turn our buffer into a hex string and then turn that into a string
							strName = strName.trim(); // Trim off the fat.
						}
						
						this.emit('namechanged', hosts[index].name, strName) // Let everyone know the name of the socket has changed
						hosts[index].name = strName; // Add our name to the array.
						this.emit("queried", index, strName); // We're done querying, so tell everyone. Include the name and index for record keeping
					}
					type = "Query response packet"; // Output the type of packet we've got (to make debugging outputs easier to read)
					break;
				
				case "636c": // We've asked to subscribe to an AllOne, and this is confirmation.
					if(hosts[index].subscribed == false) {
					   hosts[index].subscribed = true; // We've now properly subscribed, so set our subscribed property to true
					   this.emit("subscribed", index); // Emit that we've subscribed, plus the index (in the array) of our AllOne
					   type = "Subscription confirmation packet"; // Output the type of packet we've got (to make debugging outputs easier to read)
                    }
					break;

                case "6c73": // We're in learning mode, and we've got some IR back!
                    if(MessageHex.substr(4, 4) == 0018) { break; } // We don't need this message.
                    this.emit("ircode", index, MessageHex.substr(52));
                    break;
				default: // For everything else
					type = "Other type of packet"; // Output the type of packet we've got (to make debugging outputs easier to read)
					break;
			}	
			this.emit("messagereceived", message, remote.address, type); // It's not from us, so let everyone know we've got data			
		}
	}.bind(this));
}

OrviboAllOne.prototype.prepare = function(callback) { // Begin listening on our ports
	// Due to some funkyness between operating systems or possibly node.js versions, we need to bind our client in two different ways.
	if(os.type() == "Windows_NT") { // Windows will only work if we setBroadcast(true) in a callback
		scktClient.bind(port, function() {
			scktClient.setBroadcast(true); // If we don't do this, we can't send broadcast packets to x.x.x.255, so we can never discover our sockets!		
		});
	} else { // While node.js on Linux (Raspbian, but possibly other distros) will chuck the sads if we have a callback, even if the callback does absolutely nothing (possibly a bug)
		scktClient.bind(port);
		scktClient.setBroadcast(true); // If we don't do this, we can't send broadcast packets to x.x.x.255, so we can never discover our sockets!
	}
	
	scktServer.bind(port, localIP); // Listen on port 10000
	this.emit("ready"); // TO-DO: Change this to something else, as it means we're bound, NOT that we're ready to turn the socket on and off. Potentially confusing!
	if(typeof callback === "function") { if(typeof callback === "function") { callback(); } }
}

OrviboAllOne.prototype.discover = function(callback) { // To discover sockets, we send out the payload below. Any socket that is configured should report back.
    payload = []; // Clear out the payload variable
    payload = payload.concat(['0x68', '0x64', '0x00', '0x06', '0x71', '0x61']); // Our broadcast packet. No MAC address required!
	this.sendMessage(payload, broadcastip, function(){
		this.emit("discovering"); // Tell everyone we're in the process of discovering
	}.bind(this)); 
	if(typeof callback === "function") { callback(); }
}

OrviboAllOne.prototype.subscribe = function(callback) { // We've found a socket, now we just need to subscribe to it so we can control it.
	hosts.forEach(function(item) { // // Loop through each found socket

			macReversed = this.hex2ba(item.macaddress); // Convert our MAC address into a byte array (e.g. [0x12, 0x23] etc.)
			macReversed = macReversed.slice().reverse(); // And reverse the individual sections (e.g. ACCF becomes CFAC etc.)
		    payload = []; // Clear out our payload
		    payload = payload.concat(['0x68', '0x64', '0x00', '0x1e', '0x63', '0x6c'], this.hex2ba(item.macaddress), twenties, macReversed, twenties); // The subscription packet
		    this.sendMessage(payload, item.ipaddress, function(){ // Send the message and when that's done..
				this.emit("subscribing", index); // Let everyone know
			}.bind(this)); 

	}.bind(this));
	if(typeof callback === "function") { callback(); }
}

OrviboAllOne.prototype.emitIR = function(index, ir, callback) { // Here's where the magic begins! this function blasts out IR! Send the IR as raw hex
	payload = []; // What we're going to send
	if(hosts[index].subscribed == true) { // Only send if we've subscribed
        packetLength = _s.lpad(decimalToHexString(ir.length / 2 + 26).toString(), 4, "0"); // This takes the length of our whole packet (IR + 26 bytes) and converts it to hex. Uses _s to pad it with 0s to make it valid hex
        irLength = _s.lpad(decimalToHexString(ir.length / 2).toString(), 4, "0"); // And we do the same, but with our hex
        irLength = _s.chop(irLength,2).reverse().join(""); // Cut up our length into hex and reverse it (needed for the IR length. Strange..)
        randomBitA = Math.floor((Math.random() * 2048)); // The A1 won't blast twice if this remains the same (some kind of accidental blast guard?), so get a random value
        randomBitB = Math.floor((Math.random() * 2048)); // Same as above
	   payload = payload.concat(['0x68', '0x64'], this.hex2ba(packetLength), ['0x69', '0x63'], this.hex2ba(hosts[index].macaddress), twenties, ['0x65', '0x00', '0x00', '0x00'], randomBitA, randomBitB, this.hex2ba(irLength), this.hex2ba(ir)); // Put it all together
        
	    this.sendMessage(payload, hosts[index].ipaddress, function(){ // And send it out
			this.emit("emitting", index, payload.toString('hex')); // Let everyone know we're trying to emit some data
		}.bind(this)); 
		if(typeof callback === "function") { callback(); }
	} else {
		this.subscribe(); // If we're not subscribed, then subscribe, damnit!
	}
}

OrviboAllOne.prototype.query = function(callback) { // Query all subscribed sockets for their name
	hosts.forEach(function(item, index) {

		if(item.subscribed == true) { // We can only query if we're subscribing
			payload = [];
			payload = payload.concat(['0x68', '0x64', '0x00', '0x1d', '0x72', '0x74'], this.hex2ba(item.macaddress), twenties, ['0x00', '0x00', '0x00', '0x00', '0x04', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00']);
			this.sendMessage(payload, hosts[index].ipaddress, function() {
				this.emit('querying', index); // Tell the world we're querying the sockets for their name
				
			}.bind(this));
		} else {
			this.subscribe();
		}
	}.bind(this));
	if(typeof callback === "function") { callback(); }
}

OrviboAllOne.prototype.enterLearningMode = function(index) { // In learning mode, the A1's ring turns red and will accept any IR code given to it. It'll then send us back data with this IR info in it
    payload = [];
    payload = payload.concat(['0x68', '0x64', '0x00', '0x18', '0x6c', '0x73'], this.hex2ba(hosts[index].macaddress), twenties, ['0x01', '0x00', '0x00', '0x00', '0x00', '0x00']);
    this.sendMessage(payload, hosts[index].ipaddress, function() {
        this.emit('learning', index); // Tell the world we're trying to learn. We're learnding, Super Nintendo Charlmers
    }.bind(this));
}
		

OrviboAllOne.prototype.hosts = hosts; // Give the calling module access to the list of sockets we've found

OrviboAllOne.prototype.sendMessage = function(message, sHost, callback) { // The fun (?) part of our module. Sending of the messages!
    message = new Buffer(message); // We need to send as a buffer. this line takes our message and makes it into one. 
    process.nextTick(function() { // Next time we're processing stuff. To keep our app from running away from us, I suppose
		scktClient.send(message, 0, message.length, port, sHost, function(err, bytes) { // Send the message. Parameter 2 is offset, so it's 0. 
	        if (err) throw err; // Error? CRASH AND BURN BB!
	        this.emit("messageSent", message, sHost, scktServer.address().address); // Tell the world we've sent a packet. Include message, who it's being sent to, plus the address it's being sent from
	    }.bind(this)); // Again, we do .bind(this) so calling this.emit(); comes from OrviboAllOne, and not from scktClient
		if(typeof callback === "function") { callback(); } // And if we've specified a callback function, go right ahead and do that, as we've sent the message
	}.bind(this));
}


function getBroadcastAddress() { // A bit of code that lets us get our network IP address
    var os = require('os')

	var interfaces = os.networkInterfaces(); // Get a list of interfaces
	var addresses = [];
	for (k in interfaces) { // Loop through our interfaces
	    for (k2 in interfaces[k]) { // And our sub-interfaces
	        var address = interfaces[k][k2]; // Get the address 
	        if (address.family == 'IPv4' && !address.internal) { // If we're IPv4 and it's not an internal address (like 127.0.0.1)
	            addresses.push(address.address) // Shove it onto our addresses array
                return addresses;
	        }
	    }
	}

	return addresses;
}

OrviboAllOne.prototype.hex2ba = function(hex) { // Takes a string of hex and turns it into a byte array: ['0xAC', '0xCF] etc.
    arr = []; // New array
	for (var i = 0; i < hex.length; i += 2) { // Loop through our string, jumping by 2 each time
	    arr.push("0x" + hex.substr(i, 2)); // Push 0x and the next two bytes onto the array
	}
	return arr;
}

function c(msg) { // Shortcut for "console.log". Saves typing when debugging.
	console.log(msg);
}

function hex2a(hexx) { // Takes a hex string and turns it into an ASCII string
    var hex = hexx.toString();//force conversion
    var str = '';
    for (var i = 0; i < hex.length; i += 2)
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
}
    
function decimalToHexString(number) { // Code from http://stackoverflow.com/a/57805
    if (number < 0) {
    	number = 0xFF + number + 1;
    }

    return number.toString(16).toUpperCase();
}

module.exports = OrviboAllOne; // And make every OrviboAllOne function available to whatever file wishes to use it. 