'use strict';
/**
 * expecting NET & TLS to be injected from outside:
 * for RN it should be in shim.js:
 *     global.net = require('react-native-tcp');
 *     global.tls = require('react-native-tcp/tls');
 *
 * for nodejs tests it should be provided before tests:
 *     global.net = require('net');
 *     global.tls = require('tls');
 * */
let net = global.net;
const TIMEOUT = 5000;

const EventEmitter = require('events').EventEmitter;
const util = require('./util');

class Client {
  constructor(port, host, protocol, options) {
    this.id = 0;
    this.port = port;
    this.host = host;
    this.callback_message_queue = {};
    this.subscribe = new EventEmitter();
    this.mp = new util.MessageParser((body, n) => {
      this.onMessage(body, n);
    });
    this._protocol = protocol; // saving defaults
    this._options = options;
  }

  connect() {
    if (this.status === 1) {
      return Promise.resolve();
    }
    this.status = 1;
    return this.connectSocket(this.port, this.host, this._protocol);
  }

  connectSocket(port, host, protocol) {
    return new Promise((resolve, reject) => {
      const errorHandler = e => reject(e);
      let options = {
        port: port,
        host: host,
        tls: protocol === 'tls',
        timeout: TIMEOUT
      };
      this.conn = net.createConnection(options, () => {
        this.conn.on('data', chunk => {
          this.conn.setTimeout(0);
          this.onRecv(chunk);
        });
        this.conn.on('end', e => {
          this.conn.setTimeout(0);
          this.onEnd(e);
        });
        this.conn.on('error', e => {
          this.onError(e);
        });
        resolve();
      });
      this.conn.on('error', errorHandler);
    });
  }

  close() {
    if (this.status === 0) {
      return;
    }
    if (this.conn) {
      this.conn.destroy();
      this.conn = null;
    }
    this.status = 0;
  }

  request(method, params) {
    if (this.status === 0) {
      return Promise.reject(new Error('ESOCKET'));
    }
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      const content = util.makeRequest(method, params, id);
      this.callback_message_queue[id] = util.createPromiseResult(resolve, reject);
      this.conn.write(content + '\n', 'utf8');
    });
  }

  requestBatch(method, params, secondParam) {
    if (this.status === 0) {
      return Promise.reject(new Error('ESOCKET'));
    }
    return new Promise((resolve, reject) => {
      let arguments_far_calls = {};
      let contents = [];
      for (let param of params) {
        const id = ++this.id;
        if (secondParam !== undefined) {
          contents.push(util.makeRequest(method, [param, secondParam], id));
        } else {
          contents.push(util.makeRequest(method, [param], id));
        }
        arguments_far_calls[id] = param;
      }
      const content = '[' + contents.join(',') + ']';
      this.callback_message_queue[this.id] = util.createPromiseResultBatch(resolve, reject, arguments_far_calls);
      // callback will exist only for max id
      this.conn.write(content + '\n', 'utf8');
    });
  }

  response(msg) {
    let callback;
    if (!msg.id && msg[0] && msg[0].id) {
      // this is a response from batch request
      for (let m of msg) {
        if (m.id && this.callback_message_queue[m.id]) {
          callback = this.callback_message_queue[m.id];
          delete this.callback_message_queue[m.id];
        }
      }
    } else {
      callback = this.callback_message_queue[msg.id];
    }

    if (callback) {
      delete this.callback_message_queue[msg.id];
      if (msg.error) {
        callback(msg.error);
      } else {
        callback(null, msg.result || msg);
      }
    } else {
      console.log("Can't get callback"); // can't get callback
    }
  }

  onMessage(body, n) {
    const msg = JSON.parse(body);
    if (msg instanceof Array) {
      this.response(msg);
    } else {
      if (msg.id !== void 0) {
        this.response(msg);
      } else {
        this.subscribe.emit(msg.method, msg.params);
      }
    }
  }

  onConnect() {}

  onClose(e) {
    this.status = 0;
    Object.keys(this.callback_message_queue).forEach(key => {
      this.callback_message_queue[key](new Error('close connect'));
      delete this.callback_message_queue[key];
    });
  }

  onRecv(chunk) {
    this.mp.run(chunk);
  }

  onEnd(e) {
    console.log('OnEnd:' + e);
  }

  onError(e) {
    console.warn('OnError:' + e);
  }
}

module.exports = Client;
