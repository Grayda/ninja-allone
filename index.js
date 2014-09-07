var util = require('util') // For inheriting the EventEmitter class
  , stream = require('stream')
  , configHandlers = require('./lib/config-handlers')
  , OrviboAllOne = require("./lib/allone.js"); // Our AllOne / Socket class

// Give our driver a stream interface
util.inherits(myDriver,stream);

// Our greeting to the user.
var ALLONE_WELCOME = {
  "contents": [
    { "type": "heading",      "text": "Orvibo AllOne Driver Loaded" },
    { "type": "paragraph",    "text": "The Orvibo AllOne Driver has been loaded. To learn an IR code, please type LEARN into the text box and press 'Set Text'" }
  ]
};

var orvibo = new OrviboAllOne(); // The main class that controls our sockets
var devices = []; // The AllOne devices we've discovered
var dTimer; // A timer that repeats orvibo.discovery() until something is found.
var rTimer; // A timer that repeats our subscribe function every 4 minutes
var rdTimer; // A timer that rediscovers our sockets every minute

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

    
  app.on('client::down',function(){ // Our block has gone down, so clear out the timers so when our block reconnects to the cloud, we won't get more setIntervals clogging up the system
    clearInterval(rTimer);
    clearInterval(dTimer);
    clearInterval(rdTimer);
  });
    
  app.on('client::up',function(){

    // The client is now connected to the Ninja Platform

    // Check if we have sent an announcement before.
    // If not, send one and save the fact that we have.
    if (!opts.hasSentAnnouncement) {
      self.emit('announcement',ALLONE_WELCOME);
      opts.hasSentAnnouncement = true;
      self.save();
    }

    orvibo.on('ready', function() { // We're ready to begin looking for devices.
		dTimer = setInterval(function() { // Sometimes the data won't send right away and we have to try a few times before the packet will leave
			orvibo.discover();
		 }, 2000); // preparation is complete. Start discovering sockets!
        
        setTimeout(function() { clearInterval(dTimer, 120000) }); // Stop our 2-second searching after 2 minutes if nothing was found.

		rTimer = setInterval(function() { // We need to subscribe every so often to keep control of the socket. This code calls subscribe() every 4 minutes
			orvibo.subscribe();
	    },240000);
		 
		 rdTimer = setInterval(function() { // Every minute we want to scan for new sockets
			 orvibo.discover();
		 }, 60000);
	});
	
	orvibo.on('allonefound', function(index) { // We've found an AllOne!
		clearInterval(dTimer); // Stop searching. 
		orvibo.subscribe(); // Subscribe to the device
		orvibo.discover(); // And search again in case we missed any devices before
	});
    
    orvibo.on('socketfound', function(index) { // We've found a socket!
		clearInterval(dTimer); // Stop searching.
		orvibo.subscribe(); // Subscribe to the socket
		orvibo.discover(); // And search again, just like above
	})
		
	orvibo.on('subscribed', function(index, state) { // We've asked to subscribe to a socket and we've had confirmation! 
		if(orvibo.hosts[index].type == "socket") { // If it's a socket
            this.emit('data', state); // Tell the world what the state of the socket is
        } else if(orvibo.hosts[index].type == "allone") {
            this.emit('data', ''); // Otherwise, emit some blank data to at least get the widget ungreyed in the dashboard
        }
		orvibo.query(); 
	}.bind(this)); // We've subscribed to our device. Now we need to grab its name!
	
	orvibo.on('messagereceived', function(message, host) { // Want to see what's coming in? Uncomment the next line
		// console.log("Message from " + host + ": " + message.toString('hex'));
	});
   
	orvibo.on('queried', function(index, name, type) { // We've asked our device for it's name and it's responded
		clearInterval(dTimer); // Stop looking for new sockets. This is a bit of a safety net to ensure we're not searching when we're not supposed to.
		// Register a device
		process.nextTick(function() { // We want to ensure this line runs, so we stick it in the nextTick function
            devices.push(new Device(index, name, orvibo.hosts[index].macaddress, type)); // Add a new device to our devices array
		    self.emit('register', devices[devices.length - 1]); // And let the world know we've got a new device!
            if(type == "allone") { // If it's an AllOne, we need to have a push button (as a text_display driver doesn't let you test via the "Equality" rule element :\
			      devices[index].button = new Device(index, name, orvibo.hosts[index].macaddress, "button"); // Register a new push button
		          self.emit('register', devices[index].button); // And let the world know we've got a new device!                
            }
			
            orvibo.subscribe(); // Subscribe again, just in case. 
		});
	});
	
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
  // can do. Otherwise, we will try action the rpc method
  if (!rpc) {
    return configHandlers.menu.call(this,cb);
  }
};


// ===========================================================================================================================
// ===========================================================================================================================
//      The device part of the show. This part takes over once we've 'register'ed a device in the myDriver part above       ||
// ===========================================================================================================================
// ===========================================================================================================================


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
function Device(index, dName, macaddress, type) { // Check out the self.emit('register' ... ) bit above to see what we're passing here

  var self = this;

  // This device will emit data
  this.readable = true;

  this.type = type; // The type of device we're working with (allone or socket)

  this.G = "orvibo" + type + macaddress; // G is the internal name of our device and makes up part of the GUID (click the gear > info on the dashboard to see)
  this.V = 0; // 0 is Ninja Blocks' device list
  if(type == "socket") { // If we've got a socket
    this.writeable = true;      
    this.name = dName // The name of our socket
    this.D = 238; // Device will be a relay
  } else if(type == "allone") {
    this.writeable = true;
    this.name = dName // The name of our socket
    this.D = 240; // Otherwise, device will be a Text driver
  } else if(type == "button") {
    this.writeable = false;      
    this.name = dName + " button" // The name of our socket      
    this.D = 5; // Otherwise, device will be a Text driver      
  }
  

  this.id = index; // And the index of our socket (which can be passed to Device.write below
    
    orvibo.on('ircode', function(index, data) { // We were in learning mode and have received some IR data back!
      devices[index].emit('data', data); // Emit it. Remember that devices[index] is an array that holds all our registered devices
    }.bind(this));
    
    orvibo.on('buttonpress', function(index) { // We've pressed the physical (reset) button on top of the AllOne and we've got some data back
       devices[index].button.emit('data', false); 
    }.bind(this));
        
    orvibo.on('statechanged', function(index, state) { // Our socket has changed state, so emit the data so the dashboard can keep up
        try {
            devices[index].emit('data', state);  
        } catch(ex) {
            
        }
    }.bind(this));
    
    if(type == "socket") { // If we've got a socket
        process.nextTick(function() {
	       devices[this.id].emit('data', orvibo.hosts[this.id].state); // Emit the initial state of our socket
        }.bind(this));
    }
	
};


/**
 * Called whenever there is data from the Ninja Platform
 * This is required if Device.writable = true
 *
 * @param  {String} data The data received
 */
Device.prototype.write = function(data) {
    id = this.id;
    try { // Try this code
        switch(this.type) { // Get the type of device we're working with
            case "socket": // If it's a socket
                orvibo.setState(this.id, data); // Set the state
                devices[this.id].emit('data', data); // Let the world know we've changed
                break;
            case "allone": // If it's an AllOne
                if(data == "LEARN") { // If the data is "LEARN"
                    orvibo.enterLearningMode(this.id); // We're in learning mode
                } else { // If it's not "LEARNING", it's IR data
		          if(orvibo.hosts[this.id].subscribed == true) { // Are we subscribed? If yes,
		              orvibo.emitIR(this.id, data); // Emit the IR as-is. It's up to the user to make sure the IR is correct
		              devices[this.id].emit('data', data); // Let the world know what we just emitted
		          } else { // If we're not subscribed
			         orvibo.discover(); // Start the discovery / subscription process again. 
		          }
                }
                break;
            case "button":
                break;
            default:
                break;
        }
        
    } catch(ex) { // If there was a problem running the above code (e.g. socket not subscribed or what-not)
        console.log("Error writing data: " + ex.message); // Error!
    }
}

// Export it
module.exports = myDriver;
