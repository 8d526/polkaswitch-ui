import _ from "underscore";
import EventManager from './events';
import Wallet from "./wallet";
import * as ethers from 'ethers';
import TokenListManager from './tokenList';
import Storage from './storage';
import BN from 'bignumber.js';
import { BigNumber, constants, providers, Signer, utils } from "ethers";
import swapFn from "./swapFn";
import { ApprovalState } from "../constants/Status";

import { Hop, Chain } from '@hop-protocol/sdk'

// never exponent
BN.config({ EXPONENTIAL_AT: 1e+9 });

window.HopUtils = {
  _sdk: false,

  _activeTxs: [],
  _historicalTxs: [],

  _storeKey: () => {
    return `hop_${Wallet.currentAddress()}`;
  },

  initalize: async function() {
    EventManager.listenFor('walletUpdated', this.resetSdk.bind(this));

    if (Wallet.isConnected()) {
      this._sdk = await this.initalizeSdk();
    }
  },

  isSdkInitalized: function() {
    return !!this._sdk;
  },

  initalizeSdk: async function() {
    const signer = Wallet.getProvider().getSigner();

    var sdk = this._sdk = (new Hop('mainnet')).connect(signer);

    sdk.setChainProviders({
      ethereum: new providers.StaticJsonRpcProvider('https://mainnet.infura.io/v3/84842078b09946638c03157f83405213'),
      polygon: new providers.StaticJsonRpcProvider('https://polygon-rpc.com'),
      xdai: new providers.StaticJsonRpcProvider('https://rpc.xdaichain.com'),
      optimism: new providers.StaticJsonRpcProvider('https://mainnet.optimism.io'),
      arbitrum: new providers.StaticJsonRpcProvider('https://arb1.arbitrum.io/rpc'),
    });

    this._attachSdkListeners(sdk);
    return sdk;
  },

  resetSdk: function() {
    console.log("Nxtp SDK reset");

    if (this._sdk) {
      //detach all listeners
      // TODO
      // this._sdk.removeAllListeners();
      // this._sdk.detach();
    }

    this._sdk = false;
    this._activeTxs = [];
    this._historicalTxs = [];
  },

  _attachSdkListeners: function(_sdk) {
    if (!_sdk) {
      return;
    }
  },

  isSupportedAsset: function(sendingAssetId) {
    return true;
  },

  isSupportedNetwork: async function(network) {
    if (!this._sdk) {
      this._sdk = await this.initalizeSdk();
    }

    return _.contains(this._sdk.supportedChains, network.name.toLowerCase());
  },

  getEstimate: async function (
    transactionId,
    sendingChainId,
    sendingAssetId,
    receivingChainId,
    receivingAssetId,
    amountBN,
    receivingAddress
  ) {
    if (!Wallet.isConnected()) {
      console.error("Hop: Wallet not connected");
      return false;
    }

    if (!this._sdk) {
      this._sdk = await this.initalizeSdk();
    }

    const sendingChain = TokenListManager.getNetworkById(sendingChainId);
    const receivingChain = TokenListManager.getNetworkById(receivingChainId);
    const receivingAsset = TokenListManager.findTokenById(receivingAssetId, receivingChain);
    const sendingAsset = TokenListManager.findTokenById(sendingAssetId);
    const bridgeAsset = TokenListManager.findTokenById(sendingAsset.symbol, receivingChain);

    const hopSendingChain = new Chain(
      sendingChain.name,
      sendingChain.chainId,
      sendingChain.nodeProviders[0]
    );
    const hopReceivingChain = new Chain(
      receivingChain.name,
      receivingChain.chainId,
      receivingChain.nodeProviders[0]
    );
    const hopBridge = this._sdk.bridge(sendingAsset.symbol);

    const amountOut = await hopBridge.getAmountOut(
      amountBN.toString(),
      hopSendingChain,
      hopReceivingChain
    );
    const bonderFee = await hopBridge.getTotalFee(
      amountBN.toString(),
      hopSendingChain,
      hopReceivingChain
    );

    console.log(amountOut, bonderFee);

    return {
      id: transactionId,
      transactionFee: bonderFee,
      returnAmount: amountOut
    };
  },

  transferStepOne: async function(
    transactionId,
    sendingChainId,
    sendingAssetId,
    receivingChainId,
    receivingAssetId,
    amountBN,
    receivingAddress
  ) {
    if (!Wallet.isConnected()) {
      console.error("Hop: Wallet not connected");
      return false;
    }

    if (!this._sdk) {
      this._sdk = await this.initalizeSdk();
    }

    const sendingChain = TokenListManager.getNetworkById(sendingChainId);
    const receivingChain = TokenListManager.getNetworkById(receivingChainId);
    const receivingAsset = TokenListManager.findTokenById(receivingAssetId, receivingChain);
    const sendingAsset = TokenListManager.findTokenById(sendingAssetId);
    const bridgeAsset = TokenListManager.findTokenById(sendingAsset.symbol, receivingChain);

    const hopSendingChain = new Chain(
      sendingChain.name,
      sendingChain.chainId,
      sendingChain.nodeProviders[0]
    );
    const hopReceivingChain = new Chain(
      receivingChain.name,
      receivingChain.chainId,
      receivingChain.nodeProviders[0]
    );

    const hopBridge = this._sdk.bridge(sendingAsset.symbol);

    const approvalAddress = await hopBridge.getSendApprovalAddress(hopSendingChain, hopReceivingChain);
    const token = hopBridge.getCanonicalToken(hopSendingChain);
    const amountToApprove = constants.MaxUint256;
    const approveTx = await token.approve(approvalAddress, amountToApprove);

    console.log('Hop Approved TX: ', approveTx);

    const tx = await hopBridge.send(
      amountBN.toString(),
      hopSendingChain,
      hopReceivingChain
    );

    console.log('Started Hop TX: ', tx.hash);

    this._sdk
      .watch(tx.hash, sendingAsset.symbol, hopSendingChain, hopReceivingChain)
      .on('receipt', data => {
        const { receipt, chain } = data
        console.log(receipt, chain)
      });

    return {
      transactionHash: tx.hash
    };
  },

  getAllActiveTxs: function() {
    return this._activeTxs.map((x) => x);
  },

  getAllHistoricalTxs: function() {
    return this._historicalTxs.map((x) => x);
  }
};

export default window.HopUtils;
