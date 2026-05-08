import { io } from "../external/socket.io-4.7.5.esm.min.js";

export class SocketStatus {
    /**
     * @param {Object} options
     * @param {Function|null} [options.onConnect]
     * @param {Function|null} [options.onDisconnect]
     */
    constructor({
        onConnect = null,
        onDisconnect = null
    } = {}) {

        /**
         * User callbacks
         * @type {Function|null}
         */
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
        if (this.socket.connected)
            this.socket.disconnect();
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
    setConnectCallback(callback) {
        this.onConnect = callback;
    }

    /**
     * @param {Function|null} callback
     */
    setDisconnectCallback(callback) {
        this.onDisconnect = callback;
    }

    destroy() {
        this.socket.off('connect', this.connectListener);
        this.socket.off('disconnect', this.disconnectListener);

        this.socket.disconnect();
    }
}
