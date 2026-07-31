// import { io } from '../external/socket.io-4.7.5.esm.min.js';
import io from 'socket.io-client';

export class SocketStatus {
  onConnect: Function | null;
  onDisconnect: Function | null;
  socket: any;
  connectListener: () => void;
  disconnectListener: () => void;

  constructor({
    onConnect = null,
    onDisconnect = null,
  }: { onConnect?: Function | null; onDisconnect?: Function | null } = {}) {
    this.onConnect = onConnect;
    this.onDisconnect = onDisconnect;

    this.socket = io();

    // Bind once and store references
    this.connectListener = this.#connectListener.bind(this);
    this.disconnectListener = this.#disconnectListener.bind(this);

    this.socket.on('connect', this.connectListener);
    this.socket.on('disconnect', this.disconnectListener);
  }

  reconnect() {
    if (this.socket.connected) this.socket.disconnect();
    this.socket.connect();
  }

  #connectListener() {
    if (typeof this.onConnect === 'function') {
      this.onConnect(this);
    }
  }

  #disconnectListener() {
    if (typeof this.onDisconnect === 'function') {
      this.onDisconnect(this);
    }
  }

  /**
   * @param {Function|null} callback
   */
  setConnectCallback(callback: Function | null) {
    this.onConnect = callback;
  }

  /**
   * @param {Function|null} callback
   */
  setDisconnectCallback(callback: Function | null) {
    this.onDisconnect = callback;
  }

  destroy() {
    this.socket.off('connect', this.connectListener);
    this.socket.off('disconnect', this.disconnectListener);

    this.socket.disconnect();
  }
}
