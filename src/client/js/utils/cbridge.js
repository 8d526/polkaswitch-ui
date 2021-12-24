//Celer doc: https://cbridge-docs.celer.network/developer/cbridge-sdk
import {
    GetTransferConfigsRequest,
    EstimateAmtRequest
}
    from "../../../cbridge-ts-proto/sgn/gateway/v1/gateway_pb";

// import grpc-web WebClient
import { WebClient }
    from "../../../cbridge-ts-proto/sgn/gateway/v1/GatewayServiceClientPb";
import EventManager from './events';
import Wallet from "./wallet";
import TokenListManager from "./tokenList";

window.CBridgeUtils = {
    _client: false,

    _activeTxs: [],
    _historicalTxs: [],

    initialize: async function() {
        EventManager.listenFor('walletUpdated', this.resetClient.bind(this));

        if (Wallet.isConnected()) {
            this._client = await this.initializeClient();
        }
    },

    isClientInitialized: function() {
        return !!this._client;
    },

    initializeClient: async function() {
        //Test celer hostname: https://cbridge-v2-test.celer.network
        var client = this._client = new WebClient(`https://cbridge-v2-prod.celer.network`, null, null);
        this._attachClientListeners(client);
        return client;
    },

    resetClient: function() {
        console.log("Celer Bridge grpc client reset");

        if (this._client) {
            //detach all listeners
            // TODO
            // this._sdk.removeAllListeners();
            // this._sdk.detach();
        }

        this._client = false;
        this._activeTxs = [];
        this._historicalTxs = [];
    },

    _attachClientListeners: function(_client) {
        if (!_client) {
            return;
        }
    },

    isSupportedAsset: function(sendingAssetId) {
        return true;
    },

    isSupportedNetwork: async function(network) {
        if (!this._client) {
            this._client = await this.initializeClient();
        }

        const config = await this.getTransferConfig();
        const chains = JSON.parse(config).chains
        return chains.some(e => e.name.toLowerCase() === network.name.toLowerCase())
    },

    getTransferConfig: async function () {
        if (!Wallet.isConnected()) {
            console.error("cbridge: Wallet not connected");
            return false;
        }

        if (!this._client) {
            this._client = await this.initializeClient();
        }

        const request = new GetTransferConfigsRequest();
        return await this._client.getTransferConfigs(request, null);
    },

    getEstimate: async function(
        transactionId,
        sendingChainId,
        sendingAssetId,
        receivingChainId,
        receivingAssetId,
        amountBN,
        slippage //convert percent to int eg: 0.05% = 500; 0.1 = 1000
    ) {
        if (!Wallet.isConnected()) {
            console.error("cbridge: Wallet not connected");
            return false;
        }

        if (!this._client) {
            this._client = await this.initializeClient();
        }

        const receivingAsset = TokenListManager.findTokenById(receivingAssetId, receivingChain);
        const sendingAsset = TokenListManager.findTokenById(sendingAssetId);
        const bridgeAsset = TokenListManager.findTokenById(sendingAsset.symbol, receivingChain);

        const request = new EstimateAmtRequest();
        request.setSrcChainId(sendingChainId);
        request.setDstChainId(receivingChainId);
        request.setTokenSymbol(sendingAsset.symbol);
        request.setAmt(amountBN.toString());
        request.setUsrAddr(Wallet.currentAddress());
        request.setSlippageTolerance(slippage);

        const response = this._client.estimateAmt(request, null);
        const jsonResp = JSON.parse(response);
        const baseFee = parseInt(jsonResp.perc_fee)
        return {
            id: transactionId,
            // transactionFee: jsonResp.
        }
    }

}


