// Deterministically simulate another process taking a released probe port.
const net = require('node:net'); const create = net.createServer;
net.createServer = function (...args) {
 const server = create.apply(this, args), close = server.close;
 server.close = function (callback) {
  const address = server.address();
  return close.call(server, () => {
   const holder = create(); holder.once('error', () => callback?.());
   holder.listen(address.port, address.address, () => { holder.unref(); callback?.(); });
  });
 };
 return server;
};
