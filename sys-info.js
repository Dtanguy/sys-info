var os = require('os');
var osu = require('os-utils');
var usb = require('usb');
var usbDetect = require('usb-detection');
var ds = require('fd-diskspace');
var si = require('systeminformation');
var tcpp = require('tcp-ping');

// Color console
[
	[ 'warn',  '\x1b[35m' ],
	[ 'error', '\x1b[31m' ],
	[ 'log',   '\x1b[2m'  ]
].forEach(function(pair) {
	var method = pair[0], reset = '\x1b[0m', color = '\x1b[36m' + pair[1];
	console[method] = console[method].bind(console, color, method.toUpperCase(), reset);
});	

var option = {
	cpu		: true,
	ram		: true,
	ping	: true,
	temp	: true,
	os		: true,
	usb		: true,
	disk	: true,
	network	: true,
	wifi	: true,
	modem	: true,
	serial	: true,
	android	: true,
	gps		: true		
};

function init(option_){
	if(option_){
		option = option_;
	}
	for(opt in option){
		if(option[opt]){
			console.log('Option enabled: ' + opt);
		}
	}
	updateMonito();
	updateHard();
}

/**************************************************************************************************************/
/* MONITORING *************************************************************************************************/
/**************************************************************************************************************/

var monito = {
	cpu: -1,	
	freemem: -1,
	totalmem: -1,
	ping: -1,
	temp: -1	
};

var monitoInterval;
function getMonito(){
	return monito;
}

function setFreqMonito(freq, cb){
	if(freq && cb){
		if(freq > 500 && freq < 60000){
			monitoInterval = setInterval(function() { 
				updateMonito();
				cb(monito);
			}, freq);
		}
	}else{
		clearInterval(monitoInterval);
	}
}


function comparte(name, cb){
	if(option[name]){
		try{		
			if(cb() < 0){
				throw "Fail"
			}
		}catch(e){
			disable(name);
		}
	}
}

function disable(name){
	console.warn('Option failure: ' + name + ' Disabled');
	option[name] = false;
}

function updateMonito(){	

	// RAM
	comparte('ram', function(){
		monito.freemem = Math.trunc(os.freemem() / 1048576);
		monito.totalmem = Math.trunc(os.totalmem() / 1048576);
	});
	
	// CPU
	comparte('cpu', function(){
		osu.cpuUsage(function(v){
			monito.cpu = Math.trunc(v * 10000)/100;	
		});
	});
		
	// PING
	comparte('ping', function(){
		tcpp.ping({address: 'google.fr', attempts: 1}, function(err, data) {	
			if (err) {
				monito.ping = '';
				disable('ping');
			}else if(data && data.results && data.results[0] && data.results[0].time){					
				monito.ping = Math.trunc(data.results[0].time*100)/100;
			}
		});	
	});
	
	// TEMP
	comparte('temp', function(){
		si.cpuTemperature(function(tmp){					
			monito.temp = tmp.main;
		});
	});	
	
}






/**************************************************************************************************************/
/* HARDWARE *************************************************************************************************/
/**************************************************************************************************************/

var heavy = {	
	sysUptime: -1,
	platform: -1,
	hostname: -1,
	lsusb: [],
	network: {},
	disk: {},
	wifi: {},
	modem: {}
};

var hardInterval;
function getHard(){
	return heavy;
}

function setFreqHard(freq, cb){
	if(freq && cb){
		if(freq > 1000 && freq < 600000){
			hardInterval = setInterval(function() { 
				updateHard();
				cb(heavy);
			}, freq);
		}
	}else{
		clearInterval(hardInterval);
	}
}

function updateHard(){
	
	// Wifi scann
	comparte('wifi', function(){
		wifiScann(function(data, err){
			if(err){
				disable('wifi');
			}else if(data){
				heavy.wifi = data;
			}
		});	
	});
	
	// Network
	comparte('network', function(){		
		heavy.network = {};	
		var net = os.networkInterfaces();
		for (var co in net) {	
			if(co != "lo"){
				heavy.network[co] = net[co];
			}
		}
	});

	// USB
	comparte('usb', function(){	
		usbDetect.find(function(err, devices) {
			if(err){
				disable('usb');
			}else{
				heavy.lsusb = devices; 
			}
		});
	});
	
	// OS
	comparte('usb', function(){			
		heavy.sysUptime = osu.sysUptime();
		heavy.platform = os.platform();
		heavy.hostname = os.hostname();
	});
		
	// DISK
	comparte('disk', function(){	
		ds.diskSpace(function(e, res){
			if(e){
				disable('disk');
			}else if(res.total){				
				heavy.disk.total = Math.trunc(res.total.size);
				heavy.disk.used = Math.trunc(res.total.used);
				heavy.disk.free = Math.trunc(res.total.free);
				heavy.disk.perc = Math.trunc(res.total.percent* 10000)/100;
			}
		});
	});

	// Modem
	comparte('modem', function(){	
	
	});
	
	// Serial
	comparte('serial', function(){	
	
	});
	
	// Android
	comparte('android', function(){	
	
	});
	
	// GPS
	comparte('gps', function(){	
	
	});
	
}




/***********************************************************************************************************/
/* WATCH USB ***********************************************************************************************/
/***********************************************************************************************************/

var USBchangeCb;

function initUSB(_USBchangeCb){
	if(_USBchangeCb){
		USBchangeCb = _USBchangeCb;
		usbDetect.startMonitoring();
	}
}

usbDetect.on('add', function(device) {
	if(USBchangeCb){
		USBchangeCb('add', device);
	}
});

usbDetect.on('remove', function(device) {
	if(USBchangeCb){
		USBchangeCb('remove', device);
	}
});



/***********************************************************************************************************/
/* WIFI SCANN **********************************************************************************************/
/***********************************************************************************************************/

const exec    = require('child_process').exec;
const _       = require('lodash');

function wifiScann(cb){
	exec('iwlist scan', function (err, stdout) {
		if (err) {
		  cb();
		  return;
		}
		parseOutput(stdout, function(err, data){
			if(!err){
				cb(data);
			}
		});
	});
}

function parseOutput(str, callback) {
	
	//* Parsing the output of iwlist, tool having a lot of different faces :-(
	//* @param str output of the tool
	//* @param callback
	var macRegex  = /([0-9a-zA-Z]{1}[0-9a-zA-Z]{1}[:]{1}){5}[0-9a-zA-Z]{1}[0-9a-zA-Z]{1}/;
	var cellRegex = /Cell [0-9]{2,} - Address:/;
	var err   = null;
	var wifis = [];

  try {
    var blocks = str.split(cellRegex);

    blocks.forEach(block => {
      var network = {};
      var lines   = block.split('\n');
      if (macRegex.exec(lines[0])) {
        // First line is the mac address (always! (?))
        network.mac = lines[0].trim();

        lines.forEach(line => {
          // SSID
          if (line.indexOf('ESSID:') > 0) {
            network.ssid = _.trim(line.split(':')[1], '"');
            if (_.startsWith(network.ssid, '\\x00')) {
              // The raspi 3 interprets a string terminator as character, it's an empty SSID
              network.ssid = '';
            }
          }

          // Channel, an ugly thing to get it
          else if (_.startsWith(line.trim(), 'Frequency:')) {
            network.channel = parseInt(_.trim(line, ' )').split(/Channel/)[1], 10);
          }
            
          // Another ugly thing, the signal which can have different formats, even worse als
          // having different identifiers
          else if (line.indexOf('Signal level') > -1) {
            if (line.indexOf('Quality') > -1) {
              // This is a "Quality=40/70  Signal level=-70 dBm" line
              network.rssi = parseInt(line.substr(line.indexOf('Signal level') + 13), 10);
            }
            else {
              // This is a "Signal level=60/100" line
              var elements = line.split('=');
              elements.forEach(e => {
                if (e.indexOf('/') > 0) {
                  // that's our part
                  var parts    = e.split('/');
                  var level    = Math.floor(100 * parseInt(parts[0], 10) / parseInt(parts[1], 10));
                  network.rssi = level / 2 - 100;
                }
              })
            }
          }
        });
        wifis.push(network);
      }
    });
  }
  catch (ex) {
    err = ex;
  }

  callback(err, wifis);
}


/***********************************************************************************************************/
/* MODEM ***************************************************************************************************/
/***********************************************************************************************************/

function getModemStat(modemNbP){
	
	exec('mmcli -m ' + modemNbP + ' --simple-status', function (err, data) {
		
		var state, opName, accesTech, signQual;
		
		try{
			state = data.split("state: '")[1].split("'")[0];
			opName = data.split("operator name: '")[1].split("'")[0];
			accesTech = data.split("access tech: '")[1].split("'")[0];
			signQual = data.split("signal quality: '")[1].split("'")[0];
		}catch(e){
			
		}
		
		connectionData.state = state;
		connectionData.opName = opName;
		connectionData.accesTech = accesTech;
		connectionData.signQual = signQual;			

		tryMQ.publish('/MONITOR/gsm', connectionData);
		tryMQ.log('Modem state : ' + state);
		if( state == 'registered' || state == 'connected' ){
			en = true;		
		}else{
			en = false;	
			enableModem(modemNbP);	
		}		
		
    });
}


/***********************************************************************************************************/
/* GPS **********************************************************************************************/
/***********************************************************************************************************/


/***********************************************************************************************************/
/* ANDROID **********************************************************************************************/
/***********************************************************************************************************/




module.exports.init = init;

module.exports.getMonito = getMonito;
module.exports.setFreqMonito = setFreqMonito;
module.exports.updateMonito = updateMonito;

module.exports.getHard = getHard;
module.exports.setFreqHard = setFreqHard;
module.exports.updateHard = updateHard;

