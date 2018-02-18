# sys-info

pack up of different call for get sys data

npm i

```
var sysInfo = require('./sys-info');


setInterval(function() { 

	//Update CPU, RAM, Ping and temps data
	sysInfo.updateLight();
	
	//Get it
	var msg = sysInfo.getLight();
	console.log(msg);
	
}, 1000);

setInterval(function() { 

	//Update lsusb, hard drive, OS ans network data
	sysInfo.updateHeavy();
	
	//Get it
	var msg = sysInfo.getHeavy();
	console.log(msg);
	
}, 60000);
```