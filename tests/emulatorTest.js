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
			state: "",
			remote: '',
			ready: false,
            type: "allone"
		},
        { 
			index: 1,
			name: "Faded Bad",
			macAddress: "accffadedbad",
			icon: "01",
			state: "01",
			remote: '',
			ready: false,
            type: "socket"
		},
        { 
			index: 2,
			name: "The Fab Three",
			macAddress: "accfabfabfab",
			icon: "01",
			state: "",
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
rl.setPrompt('Enter a command or type help to see list of available commands');
rl.prompt();
rl.on('line', function(line) {
	try {
        line = line.split(" ");
    
        switch(line[0]) {
            case "status":
                console.log("Status of virtual devices:");
                console.dir(o.hosts);
                break;
            case "learn":
                console.log("Entering learning mode ..");
                o.enterLearningMode(line[1]);
                break;
            case "toggle":
                console.log("Toggling socket #" + line[1]);
                o.setState(parseInt(line[1]), o.hosts[parseInt(line[1])].state == "00" ? "01" : "00");
                break;
            case "button":
                o.sendMessage(o.hex2ba("686400176469" + o.hosts[parseInt(line[1])].macAddress + "2020202020200000000000"), o.hosts[parseInt(line[1])].remote);
                break;
            case "help":
                console.log("Available commands:");
                console.log("status - Displays the status of all emulated devices");
                console.log("learn [index] - Puts an AllOne into learn mode. Example: learn 0");
                console.log("toggle [index] - Toggles a socket on or off. Example: toggle 1");
                console.log("button [index] - Simulate a button press on an AllOne. Example: button 0");
                break;
            default:
                console.log("Unknown command. Type help to see list of available commands");
                break;
            
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