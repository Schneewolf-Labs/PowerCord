const net = require('node:net');

// One request/response round trip over a fresh connection. Both daemons are cheap to
// connect to and a persistent socket would need its own reconnect logic.
function request({ host, port, timeout = 5000 }, payload, isComplete) {
	return new Promise((resolve, reject) => {
		const socket = net.connect({ host, port });
		let buf = Buffer.alloc(0);
		const fail = err => { socket.destroy(); reject(err); };

		socket.setTimeout(timeout, () => fail(new Error(`timed out talking to ${host}:${port}`)));
		socket.on('error', fail);
		socket.on('connect', () => socket.write(payload));
		socket.on('data', chunk => {
			buf = Buffer.concat([buf, chunk]);
			if (isComplete(buf)) {
				socket.end();
				resolve(buf);
			}
		});
		socket.on('close', () => reject(new Error(`${host}:${port} closed the connection mid-response`)));
	});
}

module.exports = { request };
