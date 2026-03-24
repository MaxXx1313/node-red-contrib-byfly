const fetch = require('node-fetch');

/* response is:
{
    "current_page": 1,
    "data": [
        {
            "id": 12345678,
            "user_id": 12345678,
            "login": "12345678901234",
            "btk_id": "1234567890123",
            "error": null,
            "line_type": 16,
            "max_promised_payment_amount": "20.00",
            "balance": 59.69,
            "status": "complete",
            ...
            "applications": [
               ...
            ],
            "cctv_available": null,
            "has_delayed_actions": false,
            "price": 41.8,
            "terminate_in": 42
        }
    ],
    "first_page_url": "https:\/\/myapi.beltelecom.by\/api\/v2\/contracts?page=1",
    "from": 1,
    "next_page_url": null,
    "path": "https:\/\/myapi.beltelecom.by\/api\/v2\/contracts",
    "per_page": 9,
    "prev_page_url": null,
    "to": 1
}
*/
function getBalance(token, cb) {

    if (!token) {
        cb && cb(new Error('No token (not authorized?)'));
        return
    }

    fetch("https://myapi.beltelecom.by/api/v2/contracts", {
        "headers": {
            'authorization': 'Bearer ' + token,
        },
        "referrer": "https://my.beltelecom.by",
        "method": "GET"
    }).then(r => r.json()).then(data => {

        this.log('DATA RECEIVED', data);

        let balance = null;
        try {
            balance = data.data[0].balance;
        } catch (e) {
            this.error('byfly: structure error:', e);
            cb && cb(e);
        }

        cb && cb(null, balance, data);

    }).catch(e => {
        this.error('byfly: request error:', e);
        cb && cb(e);
    });
}

/**
 *
 *
 *
 */
module.exports = function (RED) {
    function ByFlyBalanceNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        // node started
        var token = node.credentials.token;
        if (token) {
            // TODO: set timer to resfresh token (no refresh endpoint?)
            this.log('TOKEN:' + token.substr(0, 6));
        }


        this.status({}); // clear status on deploy

        this.on('close', function () {
            // TODO: clear timer to resfresh token
        });

        node.on('input', function (msg, send, done) {
            var token = node.credentials.token;

            this.status({fill: "yellow", shape: "dot", text: "fetching"});

            getBalance.call(node, token, (err, balance, _raw) => {

                if (err) {
                    node.status({fill: "red", shape: "ring", text: "error"});

                    // https://nodered.org/docs/creating-nodes/node-js#handling-errors
                    if (done) {
                        // Node-RED 1.0 compatible
                        done(err);
                    } else {
                        // Node-RED 0.x compatible
                        node.error(err, msg);
                    }
                } else {
                    node.status({}); // clear status

                    msg.payload = parseFloat(balance);
                    msg.raw = _raw;
                    node.send(msg);
                }
            });
        });
    }

    RED.nodes.registerType("byfly-balance", ByFlyBalanceNode, {
        credentials: {
            username: {type: "text"},
            password: {type: "text"},
            token: {type: "password"}
        },
    });
}