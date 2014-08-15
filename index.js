var util = require('util')
  , stream = require('stream')
  , configHandlers = require('./lib/config-handlers')
  , OrviboAllOne = require("./lib/allone.js");

// Give our driver a stream interface
util.inherits(myDriver,stream);

// Our greeting to the user.
var HELLO_WORLD_ANNOUNCEMENT = {
  "contents": [
    { "type": "heading",      "text": "Orvibo AllOne Driver Loaded" },
    { "type": "paragraph",    "text": "The Orvibo AllOne Driver has been loaded. Please use the config menu to learn and add new IR codes" }
  ]
};

var orvibo = new OrviboAllOne(); // The main class that controls our sockets
var devices = []; // The AllOne devices we've discovered
var dTimer; // A timer that repeats orvibo.discovery() until something is found. 
var stTimer; // A timer that repeats a setState command until it's changed.
var suTimer; // A timer that repeats the subscription command until we get a subscription back

/**
 * Called when our client starts up
 * @constructor
 *
 * @param  {Object} opts Saved/default driver configuration
 * @param  {Object} app  The app event emitter
 * @param  {String} app.id The client serial number
 *
 * @property  {Function} save When called will save the contents of `opts`
 * @property  {Function} config Will be called when config data is received from the Ninja Platform
 *
 * @fires register - Emit this when you wish to register a device (see Device)
 * @fires config - Emit this when you wish to send config data back to the Ninja Platform
 */
function myDriver(opts,app) {

  var self = this;

  app.on('client::up',function(){

    // The client is now connected to the Ninja Platform

    // Check if we have sent an announcement before.
    // If not, send one and save the fact that we have.
    if (!opts.hasSentAnnouncement) {
      self.emit('announcement',HELLO_WORLD_ANNOUNCEMENT);
      opts.hasSentAnnouncement = true;
      self.save();
    }

    orvibo.on('ready', function() { // We're ready to begin looking for sockets.
		console.log("Driver prepared, discovering sockets .."); 
		dTimer = setInterval(function() { // Sometimes the data won't send right away and we have to try a few times before the packet will leave
			console.log("Trying to discover sockets ..");
			orvibo.discover();
		 }, 2000); // preparation is complete. Start discovering sockets!

		setInterval(function() { // We need to subscribe every so often to keep control of the socket. This code calls subscribe() every 4 minutes
			console.log("Resubscribing to sockets ..");
			orvibo.subscribe();
	    },240000);
		 
		 setInterval(function() { // Every minute we want to scan for new sockets
			 console.log("Discovering new sockets..");
			 orvibo.discover();
		 }, 60000);
	});
	
	orvibo.on('allonefound', function(index) { 
		clearInterval(dTimer);
		console.log("Socket found! Index is " + index + ". IP address is " + orvibo.hosts[index].ipaddress + ". MAC address is: " + orvibo.hosts[index].macaddress + ". Subscribing .."); 
		orvibo.subscribe();
		orvibo.discover();
	}) // We've found a socket. Subscribe to it if we haven't already!
		
	orvibo.on('subscribed', function(index) { 
		console.log("Socket index " + index + " successfully subscribed. Querying ..");
		this.emit('data', '');
		orvibo.query(); 
	}); // We've subscribed to our device. Now we need to grab its name!
	
	orvibo.on('messagereceived', function(message, host) {
		// console.log("Message from " + host + ": " + message.toString('hex'));
	});
      
   
	orvibo.on('queried', function(index, name) {
		console.log("Socket " + index + " has a name. It's " + name);
		clearInterval(dTimer);	
		// Register a device
		process.nextTick(function() {
			console.log("Registering new socket ..");

			devices.push(new Device(index, name, orvibo.hosts[index].macaddress));
		    self.emit('register', devices[devices.length - 1]);

		});

	});
      
       
	
	orvibo.on('messagereceived', function(message) {
		// console.log("Message length: " + message.toString('hex').length);
	});
	
	console.log("Preparing driver ..");
	orvibo.prepare(); // Get ready to start finding sockets
  });
};

/**
 * Called when a user prompts a configuration.
 * If `rpc` is null, the user is asking for a menu of actions
 * This menu should have rpc_methods attached to them
 *
 * @param  {Object}   rpc     RPC Object
 * @param  {String}   rpc.method The method from the last payload
 * @param  {Object}   rpc.params Any input data the user provided
 * @param  {Function} cb      Used to match up requests.
 */
myDriver.prototype.config = function(rpc,cb) {

  var self = this;
  // If rpc is null, we should send the user a menu of what he/she
  // can do.
  // Otherwise, we will try action the rpc method
  if (!rpc) {
    return configHandlers.menu.call(this,cb);
  }
  else if (typeof configHandlers[rpc.method] === "function") {
    return configHandlers[rpc.method].call(this,rpc.params,cb);
  }
  else {
    return cb(true);
  }
};

// Give our device a stream interface
util.inherits(Device,stream);

// Export it
module.exports=Device;

/**
 * Creates a new Device Object
 *
 * @property {Boolean} readable Whether the device emits data
 * @property {Boolean} writable Whether the data can be actuated
 *
 * @property {Number} G - the channel of this device
 * @property {Number} V - the vendor ID of this device
 * @property {Number} D - the device ID of this device
 *
 * @property {Function} write Called when data is received from the Ninja Platform
 *
 * @fires data - Emit this when you wish to send data to the Ninja Platform
 */
function Device(index, dName, macaddress) {

  var self = this;

  // This device will emit data
  this.readable = true;
  // This device can be actuated
  this.writeable = true;

  this.G = "allone" + macaddress; // G is a string a represents the channel. 
  this.V = 0; // 0 is Ninja Blocks' device list
  this.D = 240; // Text driver
  this.name = dName
  this.id = index;
  process.nextTick(function() {

    self.emit('data','');
  });
    
    orvibo.on('ircode', function(index, data) {
      self.emit('data', data);
           
    }.bind(this));
	
};


/**
 * Called whenever there is data from the Ninja Platform
 * This is required if Device.writable = true
 *
 * @param  {String} data The data received
 */
Device.prototype.write = function(data) {
id = this.id;
  try {
      if(data == "LEARN") {
          orvibo.enterLearningMode(this.id);
          
      } else {
		if(orvibo.hosts[this.id].subscribed == true) {
		  orvibo.emitIR(this.id, data);
		  devices[this.id].emit('data', data);
		} else {
			console.log("Not subscribed. Discovering ..");
			orvibo.discover();
		}
      }
	} catch(ex) {
		console.log("Error writing data: " + ex.message);		
	}
  }


// Export it
module.exports = myDriver;
