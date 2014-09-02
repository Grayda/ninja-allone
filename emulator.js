/*
  * Orvibo AllOne / S10 / S20 Socket Emulator Module
  * ------------------------------------------------
  *
  * This library lets you emulate an Orvibo AllOne, S10 or S20 socket in node.js. Useful for testing the ninja-orvibo driver
  *
  * Usage
  * -----
  * Require this file and .push() a new socket onto the hosts variable. See emulatorTest.js for example
  * Call .prepare() once you've created your sockets.
  * If you are testing against the SmartPoint or WiWo app, go into Settings > Smart Setup > Search Socket (you do NOT need to hit "Setup New socket" because it's already "set up"
  * If you are testing against the ninja-allone driver for the Ninja Blocks, simply refresh your dashboard and watch the sockets appear. 
  * 
  * Emits
  * ------
  * ready - The port is bound and is ready to accept incoming data
  * messagereceived (message, remote address) - Data has been received
  * discovery (index, address) - The socket has been probed and we've responded
  * subscription (address) - We've been queried, so we've sent back confirmation
  * learning (index, address) - We've been put into learning mode
*/

var util = require("util"); // For inheriting the EventEmitter stuff so we can use it via this.emit();
var EventEmitter = require("events").EventEmitter; // For emitting events so other node.js libraries and code can react to what we're doing here
var os = require("os"); // Used to check if we're running Windows, Linux or Mac (needed so we don't crash our app while binding our socket. Stupid bugs!
var _s = require("underscore.string");

util.inherits(OrviboEmulator, EventEmitter); // We want to get all the benefits of EventEmitter, but in our own class. this means we can use this.emit("Derp");

var sDgram = require('dgram'); // this library gives us UDP support
var scktClient = sDgram.createSocket('udp4'); // For sending data
var scktServer = sDgram.createSocket('udp4'); // For receiving data
var localIP = getBroadcastAddress(); // Get our local IP address
var broadcastip = "255.255.255.255"; // Where we'll send our "discovery" packet
var port = 10000 // The port we'll connect on
var payload = []; // The data we'll be sending
var twenties = "202020202020"; // this appears at the end of a few packets we send, so put it here for shortness of code

var hosts = [];


function OrviboEmulator() {
	EventEmitter.call(this); // Needed so we can emit() from this module
	scktServer.on('message', function (message, remote) { // We've got a message back from the network
		if (remote.address != localIP) { //Check message isn't from us
			var MessageHex = new Buffer(message).toString('hex'); // Convert our message into a string of hex
			this.emit('messagereceived', message, remote.address);
			var remoteMac = MessageHex.substr(MessageHex.indexOf('accf'), 12); // Look for the first occurance of ACCF (the start of our MAC address) and grab it, plus the next 12 bytes
			index = this.hosts.map(function(e) { return e.macAddress; }).indexOf(remoteMac); // Use the arr.map() and indexOf functions to find out where in our array, our socket is
            
			var type;
				switch(MessageHex.substr(8,4)) { // Look for the first twelve bytes
					case "7161": // An app is asking for our details!
                        
						this.hosts.forEach(function(item) {
                            item.remote = remote.address;
							item.ready = true;
                            if(item.type == "socket") {
                                payload = "6864002a716100" + item.macAddress + twenties + _s.chop(item.macAddress, 2).reverse().join("") + twenties + "534F43303032FED989D7" + item.state;
                            } else {
                                payload = "68640029716100" + item.macAddress + twenties + _s.chop(item.macAddress, 2).reverse().join("") + twenties + "49524430303535E8AED7";
                            }
							
							this.sendMessage(this.hex2ba(payload),remote.address);
							this.emit('discovery', item.index, remote.address);							
						}.bind(this));

						break;
                          
					case "7167": // Discovery of a socket where the MAC address is known, but the IP isn't
						mIndex = this.hosts.map(function(e) { return e.macAddress; }).indexOf(remoteMac);
						if(mIndex > -1) { 
							this.hosts[mIndex].remote = remote.address;
							this.hosts[mIndex].ready = true;
                            
                            if(this.hosts[mIndex].type == "socket") {
                                payload = "6864002a716100" + this.hosts[mIndex].macAddress + twenties + _s.chop(this.hosts[mIndex].macAddress, 2).reverse().join("") + twenties + "534F43303032FED989D7" + this.hosts[mIndex].state;
                            } else {
                                payload = "68640029716100" + this.hosts[mIndex].macAddress + twenties + _s.chop(this.hosts[mIndex].macAddress, 2).reverse().join("") + twenties + "4952443030358feeafd7";
                            }
							
							this.sendMessage(this.hex2ba(payload),remote.address);						
							this.emit('discovery', mIndex, remote.address);							
						}
						
						break;
					case "636c":
						if(this.hosts[index].type == "socket") {
                            payload = "68640018636C" + this.hosts[index].macAddress + twenties + "0000000000" + this.hosts[index].state
                        } else {
                            payload = "68640018636C" + this.hosts[index].macAddress + twenties + "0000000000";
                        }
						this.sendMessage(this.hex2ba(payload),remote.address);
						this.emit('subscription', index, remote.address);			
						break;
                        
                    case "6c73":
                        payload = "686400186c73" + this.hosts[index].macAddress + twenties + "010000000000";
                        this.sendMessage(this.hex2ba(payload),remote.address);
                        this.emit('learning', index, remote.address);
                        break;
                        
					case "7274":
						namepad = _s.rpad(this.hosts[index].name, 16, " ");
						namepad = new Buffer(namepad);
						var ip = localIP.split(".");
						var ipHex = "";
						ip.forEach(function(e) {
							tmp = parseInt(e).toString(16);
							ipHex = ipHex + _s.lpad(tmp, 2, "0");
						});
					
						switch(MessageHex.substr(MessageHex.length - 14, 2)) {
							case "01":
								console.log("Table 1");
								payload = "686400247274"
									+ this.hosts[index].macAddress
									+ twenties
									+ "020000000001000100000600040004000200";
								break;
							case "04":
								console.log("Table 4");							
								payload = "686400A87274" // Magic key, message length, command ID
									+ this.hosts[index].macAddress 
									+ twenties 
									+ "020000000004000100008A0001004325" // Record number and other junk we don't care about :)
									+ this.hosts[index].macAddress 
									+ twenties 
									+ _s.chop(this.hosts[index].macAddress, 2).reverse().join("")
									+ twenties 
									+ "383838383838" // Remote password
									+ twenties // Padding for the remote password
									+ namepad.toString('hex') // Socket name including padding
									+ "0400" // The socket icon
									+ "10000000" // Hardware version
									+ "09000000" // Firmware version
									+ "05000000" // Chip firmware version
									+ "1027" // Port 10000
									+ "2a796fd0" // The remote port (for remote access?)
									+ "1027" // Remote port 10000
									+ "766963656e7465722e6f727669626f2e636f6d" // vicenter.orvibo.com
									+ "202020202020202020202020202020202020202020" // And padding for remote address above
									+ ip
									+ "c0a80101" // Local gateway (modem etc.)
									+ "ffffff00" // Subnet mask
									+ "01" // DHCP is on?
									+ "01" // Discoverable?
									+ "000a" // Timezone
									+ "0000" // ?? Sample data says 0000 but real data says 00FF. What means?
									+ "0000"; // Countdown timer
								break;
							default:
								throw "Unhandled table data. Hex was: " + MessageHex.toString('hex');
								break;
						}
						
						
						this.sendMessage(this.hex2ba(payload),remote.address);
						this.emit('queried', index, remote.address);
						break;
					case "6373": // I don't know what this is, but the SmartPoint app asks the socket for it, so here it is!
						payload = "686400176373"
							+ this.hosts[index].macAddress
							+ twenties
							+ "0000000000"; // Does state go on the end here?
						this.sendMessage(this.hex2ba(payload),remote.address);
						this.emit('unknownA');
						break;
					case "6862":
						payload = "686400176862"
							+ this.hosts[index].macAddress
							+ twenties
							+ "0000000000";
						this.sendMessage(this.hex2ba(payload),remote.address);
						this.emit('unknownB');						
						break;							
					case "6463":
						console.log("Request to change state received");
						oldState = this.hosts[index].state;
						this.hosts[index].state = MessageHex.substr(MessageHex.length - 2,2) == "01" ? "01" : "00";
						payload = "686400176463" + this.hosts[index].macAddress + twenties + "02000000" + oldState;
						this.sendMessage(this.hex2ba(payload),remote.address);
						payload = "686400177366" + this.hosts[index].macAddress + twenties + "00000000" + this.hosts[index].state;
						this.sendMessage(this.hex2ba(payload),remote.address);
						this.emit('statechange', index, this.hosts[index].state, remote.address);
						break;
		          case "6963":
                        this.emit("irblasted", index, MessageHex);
                        break;
				}
			
		}

}.bind(this));

}

OrviboEmulator.prototype.prepare = function() {

	// Due to some funkyness between operating systems or possibly node.js versions, we need to bind our client in two different ways.
	if(os.type() == "Windows_NT") { // Windows will only work if we setBroadcast(true) in a callback
		console.log("Binding port " + port + " to host " + localIP + " using Windows method");
		scktClient.bind(port, function() {
			scktClient.setBroadcast(true); // If we don't do this, we can't send broadcast packets to x.x.x.255, so we can never discover our sockets!		
		});
	} else { // While node.js on Linux (Raspbian, but possibly other distros) will chuck the sads if we have a callback, even if the callback does absolutely nothing (possibly a bug)
		console.log("Binding port " + port + " to host " + localIP + " using Linux method");
		scktClient.bind(port);
		scktClient.setBroadcast(true); // If we don't do this, we can't send broadcast packets to x.x.x.255, so we can never discover our sockets!
	}
	scktServer.bind(port, localIP); // Listen on port 10000
	this.emit('ready');
	
}

OrviboEmulator.prototype.setState = function(index, sState) {
	if(this.hosts[index].ready == true) {
		console.log("State: " + sState);
		oldState = this.hosts[index].state;
		this.hosts[index].state = sState
		console.log("State: " + sState);
		payload = "686400176463" + this.hosts[index].macAddress + twenties + "02000000" + oldState;
		this.sendMessage(this.hex2ba(payload),this.hosts[index].remote);
		setTimeout(function() {
			payload = "686400177366" + this.hosts[index].macAddress + twenties + "00000000" + sState;
			this.sendMessage(this.hex2ba(payload),this.hosts[index].remote);
		}.bind(this), 1000);
		
	}
}

OrviboEmulator.prototype.hosts = hosts;

OrviboEmulator.prototype.sendMessage = function(message, sHost, callback) {
    message = new Buffer(message); // We need to send as a buffer. this line takes our message and makes it into one. 
    process.nextTick(function() { // Next time we're processing stuff. To keep our app from running away from us, I suppose
		scktClient.send(message, 0, message.length, port, sHost, function(err, bytes) { // Send the message. Parameter 2 is offset, so it's 0. 
	        if (err) throw err; // Error? CRASH AND BURN BB!
			this.emit('sent', message, sHost);
	    }.bind(this)); // Again, we do .bind(this) so calling this.emit(); comes from OrviboSocket, and not from scktClient
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
	            return address.address // Shove it onto our addresses array
	        }
	    }
	}

	return 0;
}

OrviboEmulator.prototype.hex2ba = function(hex) { // Takes a string of hex and turns it into a byte array: ['0xAC', '0xCF] etc.
    arr = []; // New array
	for (var i = 0; i < hex.length; i += 2) { // Loop through our string, jumping by 2 each time
	    arr.push("0x" + hex.substr(i, 2)); // Push 0x and the next two bytes onto the array
	}
	return arr;
}

module.exports = OrviboEmulator; // And make every OrviboSocket function available to whatever file wishes to use it. 