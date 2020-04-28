var os = require('os');
var osu = require('os-utils');
try{		
	var usb = require('usb');
}catch(e){
	console.error('Fail load usb');
}
try{		
	var usbDetect = require('usb-detection');
}catch(e){
	console.error('Fail load usb-detect');
}
var ds = require('fd-diskspace');
var si = require('systeminformation');
var tcpp = require('tcp-ping');
var fs = require('fs');
try{		
	const SerialPort = require('serialport');
}catch(e){
	console.error('Fail load SerialPort');
}
var psList = require('ps-list');

// Color console
/*
[
	[ 'warn',  '\x1b[35m' ],
	[ 'error', '\x1b[31m' ],
	[ 'log',   '\x1b[2m'  ]
].forEach(function(pair) {
	var method = pair[0], reset = '\x1b[0m', color = '\x1b[36m' + pair[1];
	console[method] = console[method].bind(console, color, method.toUpperCase(), reset);
});	
*/
var option = {
	cpu		: true,
	ram		: true,
	ping	: true,
	temp	: true,
	os		: true,
	piv		: true,
	usb		: true,
	disk	: true,
	network	: true,
	process : true,
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
	//For a real copy non editable
	return JSON.parse(JSON.stringify(monito));
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
		si.mem(function(data){					
			monito.freemem = Math.trunc(data.available / 1048576);
			monito.totalmem = Math.trunc(data.total / 1048576);
		});
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
	//comparte('temp', function(){
		si.cpuTemperature(function(tmp){
			//Fix for OrangePi
			if(tmp.main > 0 && tmp.main < 1){
				tmp.main = tmp.main * 1000;
			}
			monito.temp = tmp.main;
		});
	//});	
	
}






/**************************************************************************************************************/
/* HARDWARE *************************************************************************************************/
/**************************************************************************************************************/

var heavy = {	
	sysUptime: -1,
	platform: -1,
	hostname: -1,
	piv: -1,
	process: [],
	lsusb: [],
	network: {},
	disk: {},
	wifi: {},
	modem: {},
	serial: {},
	gps: {},
	android: {}
};

var hardInterval;
function getHard(){
	//For a real copy non editable
	return JSON.parse(JSON.stringify(heavy));
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
	updateSelected('wifi');
	updateSelected('network');
	updateSelected('usb');
	updateSelected('os');
	updateSelected('piv');
	updateSelected('disk');
	updateSelected('process');
	updateSelected('modem');
	updateSelected('serial');
	updateSelected('android');
	updateSelected('gps');	
}

function updateSelected(name, cb){	

	comparte(name, function(){
		
		// WIFI
		if(name=='wifi'){		
			wifiScann(function(data, err){
				if(err){
					disable('wifi');
				}else if(data){
					heavy.wifi = data;
				}
				if(cb){
					cb(heavy.wifi);
				}
			});	
		}
		
		// Network
		else if(name=='network'){
			heavy.network = {};	
			var net = os.networkInterfaces();
			for (var co in net) {	
				if(co != "lo"){
					heavy.network[co] = net[co];
				}
			}
			if(cb){
				cb(heavy.network);
			}
		}
		
		// USB
		else if(name=='usb'){
			try{		
				usbDetect.find(function(err, devices) {
					if(err){
						disable('usb');
					}else{
						heavy.lsusb = devices; 
					}
					if(cb){
						cb(heavy.lsusb);
					}
				});
			}catch(e){}
		}
		
		// OS
		else if(name=='os'){			
			heavy.sysUptime = osu.sysUptime();
			heavy.platform = os.platform();
			heavy.hostname = os.hostname();
			if(cb){
				cb(heavy.hostname);
			}
		}
		
		// Pi version
		else if(name=='piv'){
			var cpu_info = fs.readFileSync(CPU_INFO_FILE_PATH).toString();
			cpu_info = cpu_info.slice(cpu_info.lastIndexOf("Revision") , cpu_info.length);
			revision = cpu_info.slice(cpu_info.indexOf(":")+1 , cpu_info.indexOf("\n")).trim();
			heavy.piv = ras_tab[revision];
			if(cb){
				cb(heavy.piv);
			}
		}
		
			
		// DISK
		else if(name=='disk'){
			ds.diskSpace(function(e, res){
				if(e){
					disable('disk');
				}else if(res.total){				
					heavy.disk.total = Math.trunc(res.total.size);
					heavy.disk.used = Math.trunc(res.total.used);
					heavy.disk.free = Math.trunc(res.total.free);
					heavy.disk.perc = Math.trunc(res.total.percent* 10000)/100;
				}
				if(cb){
					cb(heavy.disk);
				}
			});
		}
		
		// Process list
		else if(name=='process'){		
			psList().then(data => {
				/*if(e){
					disable('process');
				}else if(data){*/			
					heavy.process = data;
				//}
				if(cb){
					cb(heavy.process);
				}
			});
		}	

		// Modem
		else if(name=='modem'){	
			getModem(function(data, err){
				if(err){
					disable('modem');
				}else if(data){
					heavy.modem = data;
				}	
				if(cb){
					cb(heavy.modem);
				}				
			});
		}
		
		// Serial
		else if(name=='serial'){
			SerialPort.list(function (err, ports) {
				listPort = ports;
				ports.timestamp = Date.now();
				heavy.serial = ports;
				if(cb){
					cb(heavy.serial);
				}
			});
		}
		
		// Android
		else if(name=='android'){
			gfhfgh
			if(cb){
				cb();
			}
		}
		
		// GPS
		else if(name=='gps'){
			var toSend = {
				considerIp: true,
				wifiAccessPoints: heavy.wifi,
			};             
			googleGeoloc(toSend, function (data, err) {  
				if(err){
					disable('gps');
				}else if(data){                
					data.timestamp = Date.now();
					heavy.gps = data;
				} 
				if(cb){
					cb(heavy.gps);
				}				
			});
		}
		
	});
}




/***********************************************************************************************************/
/* WATCH USB ***********************************************************************************************/
/***********************************************************************************************************/

var USBchangeCb;

function initUSB(_USBchangeCb){
	if(_USBchangeCb){
		USBchangeCb = _USBchangeCb;
		try{
			usbDetect.startMonitoring();
		}catch(e){}
	}
}

try {
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
}catch(e){}


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
var ccmd = 'sudo ';

function getModem(cb){
	listModem(cb);
}

function listModem(cb){
	
	exec('mmcli -L', function (err, stdout) {
		if (err) {
		  cb({}, err);
		  return;
		}

		var tmp1 = stdout.split('/Modem/')[1]
		if(!tmp1){
			return;
		}
		modemNb = parseInt(tmp1.split('[')[0]);
		
		var name = stdout.substr(0, stdout.length-2);
		name = name.split('/');
		name.shift()
		name = '/'+name.join('/');
		var id = name.split(' ')[0];
		name = name.substr(id.length-1+2);
		
		if(0 <= modemNb <= 5){	
			getModemStat(modemNb, id, name, cb);
		}	
		
	});
	
}

function getModemStat(modemNbP, id_, model_, cb){
	exec('mmcli -m ' + modemNbP + ' --simple-status', function (err, data) {
		
		if(err || !data){
			cb({}, err);
			return;
		}
		
		var state_, opName_, accesTech_, signQual_;

		if(data.split("state: '") && data.split("state: '")[1] && data.split("state: '")[1].split("'")){
			state_ = data.split("state: '")[1].split("'")[0];
		}
		if(data.split("operator name: '") && data.split("operator name: '")[1] && data.split("operator name: '")[1].split("'")){
			opName_ = data.split("operator name: '")[1].split("'")[0];
		}
		if(data.split("access tech: '") && data.split("access tech: '")[1] && data.split("access tech: '")[1].split("'")){
			accesTech_ = data.split("access tech: '")[1].split("'")[0];
		}
		if(data.split("signal quality: '") && data.split("signal quality: '")[1] && data.split("signal quality: '")[1].split("'")){
			signQual_ = data.split("signal quality: '")[1].split("'")[0];
		}

		var connectionData = {
			id : id_,
			model: model_,
			state : state_,
			opName: opName_,
			accesTech: accesTech_,
			signQual: signQual_
		};
		cb(connectionData);	
		
    });
}


/***********************************************************************************************************/
/* GPS *****************************************************************************************************/
/***********************************************************************************************************/
const httpreq = require ('httpreq');

var config = {
    key: 'Yourkey',
    timeout: 5000
};

function googleGeoloc(params, callback) {

    const options = {
      method: 'POST',
      url: 'https://www.googleapis.com/geolocation/v1/geolocate?key=' + config.key,
      json: params,
      timeout: config.timeout
    };
  
    httpreq.doRequest (options, (err, res) => {
      var data = res && res.body || '';
  
      try {
        data = JSON.parse(data);
      } catch (e) {
        err += e;
      }

      if (data && data.error) {
        err += data.error;
      }
	  
      callback (data, err);
    });
  }
  


/***********************************************************************************************************/
/* RPI Version**********************************************************************************************/
/***********************************************************************************************************/


var CPU_INFO_FILE_PATH = "/proc/cpuinfo";

var ras_tab = {
  "0002"   : "Model_B_Revision_1.0",
  "0003"   : "Model_B_Revision_1.0_ECN0001",
  "0004"   : "Model_B_Revision_2.0",
  "0005"   : "Model_B_Revision_2.0",
  "0006"   : "Model_B_Revision_2.0",
  "0007"   : "Model_A",
  "0008"   : "Model_A",
  "0009"   : "Model_A",
  "0010"   : "Model_B+",
  "900032" : "Model_B+_Revision_1.2",
  "0011"   : "Compute_Module",
  "0012"   : "Model_A+",
  "900021" : "Model_A+_Revision_1.1",
  "0013"   : "Model_B+_Revision_1.2",
  "0014"   : "Compute_Module",
  "000d"   : "Model_B_Revision_2.0",
  "000e"   : "Model_B_Revision_2.0",
  "000f"   : "Model_B_Revision_2.0",
  "a020a0" : "Compute_Module_3",
  "a01040" : "Model_B_PI_2",
  "a01041" : "Model_B_PI_2_Revision_1.1",
  "a21041" : "Model_B_PI_2",
  "a02082" : "Model_B_PI_3",
  "a22042" : "Model_B_PI_2_Revision_1.2",
  "a22082" : "Model_B_PI_3",
  "a32082" : "Model_B_PI_3",
  "a020d3" : "Model_B+_PI_3", 
  "900092" : "Model_PiZero_Revision_1.2",
  "900093" : "Model_PiZero_Revision_1.3",
  "920093" : "Model_PiZero_Revision_1.3",
  "9000c1" : "Model_PiZeroW_Revision_1.1"
};



/***********************************************************************************************************/
/* ANDROID *************************************************************************************************/
/***********************************************************************************************************/


module.exports.init = init;

module.exports.getMonito = getMonito;
module.exports.setFreqMonito = setFreqMonito;
module.exports.updateMonito = updateMonito;

module.exports.getHard = getHard;
module.exports.setFreqHard = setFreqHard;
module.exports.updateHard = updateHard;

module.exports.updateSelected = updateSelected;
