var sysInfo = require('sysInfo');
sysInfo.init();

sysInfo.setFreqMonito(1000, function(data){
	console.log(data);
});

sysInfo.setFreqHard(60000, function(data){
	console.log(data);
});
