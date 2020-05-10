
const io = require('socket.io-client');
const fetch = require('node-fetch');


function getBalance(login, pass, cb){

	fetch("https://myapi.beltelecom.by/api/v1/contracts/check/balance", {
	  "headers": {
	    "accept": "application/json",
	    "accept-language": "en-US,en;q=0.9",
	    "content-type": "application/json",
	    "hl": "ru",
	    "sec-fetch-dest": "empty",
	    "sec-fetch-mode": "cors",
	    "sec-fetch-site": "same-site",
	    "x-client": "web"
	  },
	  "referrer": "https://my.beltelecom.by/check-balance",
	  "referrerPolicy": "no-referrer-when-downgrade",
	  "body": `{\"login\": \"${login}\",\"password\": \"${pass}\"}`,
	  "method": "POST",
	  "mode": "cors"
	}).then(r => r.json()).then(r =>{
		this.log('TOKEN RECEIVED', r);

		var socket = io('https://myws.beltelecom.by', {
			// namespace: "App.Events",
		});
		socket.on('connect', (client) => {
			this.log('byfly: connected' );
			this.log('byfly: subscribe to topic', r);
			
			socket.emit("subscribe",{"channel":r.channel,"auth":{"headers":{"Authorization":"Bearer undefined"}}});
		});
		socket.on('disconnect', () => {
			this.log('byfly: disconnected' );
		});


		socket.on('App\\Events\\PublicPush', (msgid, data) => {
			this.log('byfly: incoming', data);
			socket.emit("unsubscribe",{"channel":r.channel});
			socket.disconnect();

			// in timeout, so we close socket as soon as we can
			setTimeout(()=>{

				/*

				Data is: 
				{
					balance: 7.57
					initiator: "flow"
					login: "176XXXXXXXXXX"
					message: "176XXXXXXXXXX"
					services: ["Доступ к сети интернет", "Информирование о приближении к порогу отключения"]
					socket: null
					status: "success"
					subject: "Баланс"
					tariff: "Комфорт Экспресс"
					type: "App\IntegrationBus\Flows\CheckLogin"
					uuid: "df398102-ed0f-435e-af56-9e4a1725b0f0"

				}

				Error is: {
					initiator: 'flow',
					type: 'App\\IntegrationBus\\Flows\\CheckLogin',
					status: 'error',
					error: {
						code: 'issa.GetAuth.code_318',
						message: 'Неверный логин или пароль'
					},
					subject: 'Произошла ошибка',
					message: 'Неверный логин или пароль',
					socket: null
				}
				*/
				
				if(!data){
					cb && cb(new Error('Empty response'));
					return;
				}
				
				if(data.error){
					cb && cb(new Error(data.message || 'Unknown error format. Plugin needs an update =('));
					return;
				}
				
				if(typeof data.balance === 'undefined'){
					cb && cb(new Error('No balance in response'));
					return;
				}

				cb && cb(null, data ? data.balance : null, data);
			});
		});

	}).catch(e =>{
		this.error('byfly: error:', e);
		cb && cb(e);
	});
}

/**
 *
 * 
 * 
 */
module.exports = function(RED) {
    function ByFlyBalanceNode(config) {
        RED.nodes.createNode(this, config);
		var node = this;
		
		this.status({}); // clear status on deploy

        node.on('input', function(msg, send, done) {
			
			var username = this.credentials.username;
			var password = this.credentials.password;

			this.status({fill: "yellow", shape: "dot", text: "fetching"});

			getBalance.call(node, username, password, (err, balance, _raw)=>{

				if(err){
					this.status({fill: "red", shape: "ring", text: "error"});

					// https://nodered.org/docs/creating-nodes/node-js#handling-errors
					if (done) {
						// Node-RED 1.0 compatible
						done(err);
					} else {
						// Node-RED 0.x compatible
						node.error(err, msg);
					}
				} else { 
					this.status({}); // clear status

					msg.payload = parseFloat(balance);
					msg.raw = _raw;
					node.send(msg);
				}
			});
        });
    }
    RED.nodes.registerType("byfly-balance",ByFlyBalanceNode, {
        credentials: {
            username: {type:"text"},
            password: {type:"password"}
        },
	});
}