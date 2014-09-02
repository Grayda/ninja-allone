var OrviboEmulator = require("../emulator");
var o = new OrviboEmulator();



/* To add new sockets, add to this array as necessary */
o.hosts = 
	[
		{ 
			index: 0,
			name: "Dead Beef",
			macAddress: "accfdeadbeef",
			icon: "01",
			state: "01",
			remote: '',
			ready: false,
            type: "allone"
		},
	
	];
			
			

var readline = require('readline'),
rl = readline.createInterface(process.stdin, process.stdout);

console.log("List of sockets to be created:");
console.dir(o.hosts);

o.prepare();
count = o.hosts.length - 1;
rl.setPrompt('Enter an index to toggle (0 to ' + count.toString() + ")");
rl.prompt();
rl.on('line', function(line) {
	try {
		if(line == "status") { 
			console.log("State of sockets:");
			console.dir(o.hosts); 
		} else {
			console.log("Changing state of socket: " + parseInt(line));
			o.setState(parseInt(line), o.hosts[parseInt(line)].state == "00" ? "01" : "00");
		}
	} catch(ex) {
		console.log("Error setting state. Error was: " + ex);	
	}
	
	rl.prompt();
  });
  
o.on('messagereceived', function(data, ip) {
	console.log("Data received: " + data.toString('hex') + " from " + ip); 
});

o.on('discovery', function() {
	console.log("Discovery"); 
});

o.on('unknownA', function() {
	console.log("UA"); 
});

o.on('learning', function(index, address) {
   console.log("Learning mode activated. Sending fake code");
    payload = o.hex2ba("686400b26c73" + o.hosts[index].macAddress + "2020202020200000000000029800000000009800000000000000000088001423751138022002330226021e02220237021f02340225021f02210237022002330225021f028b0634027a0637028c061f028c063402790638028b0620028c06340279063702200234027806380220023302790637028d061e0223023602f305b802230236028d061f02220236028c061e0223023602210233027806360221023402770638020000");
    setTimeout(function() { o.sendMessage(payload, address); }, 4000);
});

o.on('unknownB', function() {
	console.log("UB"); 
});


o.on('subscription', function(index) {
	console.log("Subscription"); 
});

o.on('query', function() {
	console.log("Query"); 
});


  
o.on('sent', function(data, ip) {
	console.log("Data SENT: " + data.toString('hex') + " to " + ip); 
});