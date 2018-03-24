var os = require('os');
var osu = require('os-utils');
var usb = require('usb');
//var diskspace = require('diskspace');
var ds = require('fd-diskspace');
var si = require('systeminformation');
var tcpp = require('tcp-ping');

var light = {
	cpu: -1,	
	freemem: -1,
	totalmem: -1,
	ping: -1,
	temp: -1	
};

var heavy = {	
	sysUptime: -1,
	platform: -1,
	hostname: -1,
	lsusb: [],
	network: {},
	disk: {}
};

function getLight(){
	return light;
}

function getHeavy(){
	return heavy;
}

function updateLight(){	
	// RAM
	light.freemem = Math.trunc(os.freemem() / 1048576);
	light.totalmem = Math.trunc(os.totalmem() / 1048576);
	
	// CPU
	osu.cpuUsage(function(v){
		light.cpu = Math.trunc(v * 10000)/100;	
	});
		
	// PING
	tcpp.ping({ address: 'google.fr', attempts: 1 }, function(err, data) {	
		if (err) {
			light.ping = "error pull ping data";
		}else if(data && data.results && data.results[0] && data.results[0].time){					
			light.ping = Math.trunc(data.results[0].time*100)/100;
		}
	});	
	
	// TMP
	si.cpuTemperature(function(tmp){					
		light.temp = tmp.main;
	}); 
}


function updateHeavy(){
	// Network
	try{		
		heavy.network = {};	
		var net = os.networkInterfaces();
		for (var co in net) {	
			net[co]
			if(co != "lo"){
				heavy.network[co] = net[co];
			}
		}
	}catch(e){
		heavy.disk = "error pull network data";
	}
	
	// USB
	try{		
		heavy.lsusb = [];	
		var devices = usb.getDeviceList();
		for (var dd in devices) {	
			var d = devices[dd];
			var s = 'Bus '+ ('000' + d.busNumber).slice(-3) +
			' Device ' + ('000' + d.deviceAddress).slice(-3) + ':' +
			' ID ' + ('0000' + d.deviceDescriptor.idVendor.toString(16)).slice(-4) + ': ' +
			('0000' + d.deviceDescriptor.idProduct.toString(16)).slice(-4) +
			d.deviceDescriptor.iManufacturer || '' + d.deviceDescriptor.iProduct || '';		
			heavy.lsusb.push(s);
		}
	}catch(e){
		heavy.lsusb = "error pull usb data";
	}

	
	// OS
	try{		
		heavy.sysUptime = osu.sysUptime();
		heavy.platform = os.platform();
		heavy.hostname = os.hostname();
	}catch(e){
		heavy.platform = "error pull os data";
	}	
		
	// DISK
	try{
		
		ds.diskSpace(function(e, res){
			if(e){
				heavy.disk = "error pull disk data";
			}else if(res.total){				
				heavy.disk.total = Math.trunc(res.total.size);
				heavy.disk.used = Math.trunc(res.total.used);
				heavy.disk.free = Math.trunc(res.total.free);
				heavy.disk.perc = Math.trunc(res.total.percent* 10000)/100;
				console.log(heavy.disk.perc);
			}
		});
		
		/*
		var media = '/';
		if(os.platform() == "win32"){
			media = 'C';
		}		
		diskspace.check(media, function (err, result){	
			if (err) {
				heavy.disk = "error pull disk data";
			}else if(result){				
				heavy.disk = result;
				heavy.disk.total = Math.trunc(heavy.disk.total / 1048576);
				heavy.disk.used = Math.trunc(heavy.disk.used / 1048576);
				heavy.disk.free = Math.trunc(heavy.disk.free / 1048576);
			}
		});	
		*/		
		
	}catch(e){
		heavy.disk = "error pull disk data";
	}
}


module.exports.getLight = getLight;
module.exports.getHeavy = getHeavy;
module.exports.updateLight = updateLight;
module.exports.updateHeavy = updateHeavy;