import _ from "underscore";
import store from "store";
import BN from 'bignumber.js';
import { BigNumber, constants, providers, Signer, utils } from "ethers";

import Wallet from "./wallet";
import swapFn from "./swapFn";
import HopUtils from "./hop";
import Nxtp from "./nxtp";
import Storage from "./storage";

import { getRandomBytes32 } from "@connext/nxtp-utils";

// hard-code for now. I could not find this easily as a function in HopSDK
const HOP_SUPPORTED_BRIDGE_TOKENS = [
  "USDC", "USDT", "DAI"
  // TODO This is list is longer and is dynamically available per network pair.
  // Let's keep it simple for now
  // ... "MATIC", "ETH", "WBTC"
];

// hard-code for now, the HopSDK has "supportedChains", but let's integrate later.
const HOP_SUPPORTED_CHAINS = [
  1, 137, 100, 10, 42161
];

const CONNEXT_SUPPORTED_BRIDGE_TOKENS = [
  "USDC", "USDT", "DAI"
  // TODO This is list is longer and is dynamically available per network pair.
  // Let's keep it simple for now
  // ... "MATIC", "ETH", "WBTC", "BNB"
];

const CONNEXT_SUPPORTED_CHAINS = [
  1, 56, 137, 100, 250, 42161, 43114
];

export default {
  _signerAddress: '',
  _queue: {},

  initialize: async function() {},

  getBridgeInterface: function(nonce) {
    var tx = this.getTx(nonce);
    var bridgeOption = Storage.swapSettings.bridgeOption;

    if (tx?.bridge) {
      bridgeOption = tx.bridge;
    }

    if ("hop" === bridgeOption) {
      return HopUtils;
    } else {
      return Nxtp;
    }
  },

  isSupported: function(to, toChain, from, fromChain) {
    var bridgeOption = Storage.swapSettings.bridgeOption;

    var targetChainIds = [+toChain.chainId, +fromChain.chainId];

    if ("hop" === bridgeOption) {
      if (!HOP_SUPPORTED_CHAINS.includes(+toChain.chainId)) {
        return [false, `${toChain.name} is not supported by Hop Bridge`];
      } else if (!HOP_SUPPORTED_CHAINS.includes(+fromChain.chainId)) {
        return [false, `${fromChain.name} is not supported by Hop Bridge`];
      } else {
        return [true, false];
      }
    }

    else {
      if (!CONNEXT_SUPPORTED_CHAINS.includes(+toChain.chainId)) {
        return [false, `${toChain.name} is not supported by Connext Bridge`];
      } else if (!CONNEXT_SUPPORTED_CHAINS.includes(+fromChain.chainId)) {
        return [false, `${fromChain.name} is not supported by Connext Bridge`];
      } else {
        return [true, false];
      }
    }
  },

  supportedBridges: function(to, toChain, from, fromChain) {
    var bridges = [];
    var targetChainIds = [+toChain.chainId, +fromChain.chainId];

    if (_.includes(CONNEXT_SUPPORTED_CHAINS, targetChainIds)) {
    }
  },

  getEstimate: function(
    sendingChainId,
    sendingAssetId,
    receivingChainId,
    receivingAssetId,
    amountBN,
    receivingAddress
  ) {
    const transactionId = getRandomBytes32();
    const bridgeInterface = this.getBridgeInterface();

    this._queue[transactionId] = {
      bridge: Storage.swapSettings.bridgeOption,
      sendingChainId,
      sendingAssetId,
      receivingChainId,
      receivingAssetId,
      amountBN,
      receivingAddress
    };

    return this.getBridgeInterface().getEstimate(
      transactionId,
      sendingChainId,
      sendingAssetId,
      receivingChainId,
      receivingAssetId,
      amountBN,
      receivingAddress
    );
  },

  transferStepOne: function(
    transactionId
  ) {
    const bridgeInterface = this.getBridgeInterface(transactionId);
    var tx = this.getTx(transactionId);
    return bridgeInterface.transferStepOne(
      transactionId,
      tx.sendingChainId,
      tx.sendingAssetId,
      tx.receivingChainId,
      tx.receivingAssetId,
      tx.amountBN,
      tx.receivingAddress
    );
  },

  transferStepTwo: function(
    transactionId
  ) {
    const bridgeInterface = this.getBridgeInterface(transactionId);
    var tx = this.getTx(transactionId);
    return bridgeInterface.transferStepTwo(
      transactionId,
      tx.sendingChainId,
      tx.sendingAssetId,
      tx.receivingChainId,
      tx.receivingAssetId,
      tx.amountBN,
      tx.receivingAddress
    );
  },

  twoStepTransferRequired: function(nonce) {
    var tx = this.getTx(nonce);
    if (!tx) {
      return false;
    }

    return "connext" === tx.bridge
  },

  getTx: function(nonce) {
    return this._queue[nonce];
  },
};

