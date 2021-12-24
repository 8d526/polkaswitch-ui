import _ from "underscore";
import * as ethers from 'ethers';
import BN from 'bignumber.js'
import numeral from 'numeral';
import store from 'store';

import EventManager from './events';

const BigNumber = ethers.BigNumber;
const Utils = ethers.utils;
const Contract = ethers.Contract;

const DEFAULT_SWAP_SETTINGS = Object.freeze({
  gasSpeedSetting: 'safeLow',
  customGasPrice: 0,
  isCustomGasPrice: false,
  slippage: 0.5,
  bridgeOption: 'connext' // 'hop', 'connext'
});

window.Storage = {
  swapSettings: _.extend({}, DEFAULT_SWAP_SETTINGS),
  selectedNetwork: false,
  crossChainEnabled: false,
  cachedTokenLogoUrls: {},

  initialize: function() {
    let cachedSettings = store.get('settings');
    if (_.has(cachedSettings, 'gasSpeedSetting')) {
      this.swapSettings = _.extend(
        this.swapSettings,
        _.pick(cachedSettings, _.keys(DEFAULT_SWAP_SETTINGS))
      );
    }

    // initialize the Network
    var defaultNetwork = _.findWhere(window.NETWORK_CONFIGS, { enabled: true, singleChainSupported: true }).name;
    var storedNetwork = _.findWhere(window.NETWORK_CONFIGS, {
      name: store.get('selectedNetwork'),
      enabled: true
    });
    this.selectedNetwork = (storedNetwork && storedNetwork.name) || defaultNetwork;
    this.crossChainEnabled = store.get('crossChainEnabled', false);
    this.cachedTokenLogoUrls = store.get('tokenLogoUrls') || {};
  },

  updateNetwork: function(network) {
    this.selectedNetwork = network.name;
    store.set('selectedNetwork', this.selectedNetwork);
  },

  toggleCrossChain: function(enabled) {
    this.crossChainEnabled = enabled;
    store.set('crossChainEnabled', this.crossChainEnabled);
  },

  isCrossChainEnabled: function() {
    return this.crossChainEnabled;
  },

  getNetwork: function() {
    return this.selectedNetwork;
  },

  resetNetworkSensitiveSettings: function() {
    this.swapSettings = _.extend(
      this.swapSettings,
      _.pick(
        DEFAULT_SWAP_SETTINGS,
        'gasSpeedSetting',
        'customGasPrice',
        'isCustomGasPrice'
      )
    );
    store.set('settings', this.swapSettings);
    EventManager.emitEvent('swapSettingsUpdated', 1);
  },

  resetSettings: function(keys) {
    this.swapSettings = _.extend({}, DEFAULT_SWAP_SETTINGS);
    store.set('settings', this.swapSettings);
    EventManager.emitEvent('swapSettingsUpdated', 1);
  },

  updateSettings: function(settings) {
    this.swapSettings = _.extend(this.swapSettings, settings);
    store.set('settings', this.swapSettings)
    EventManager.emitEvent('swapSettingsUpdated', 1);
  },

  updateCachedTokenLogoUrl: function (contractAddress, imgSrc) {
    this.cachedTokenLogoUrls[contractAddress] = imgSrc;
    store.set('tokenLogoUrls', this.cachedTokenLogoUrls);
  },

  getCachedTokenLogoUrl: function(contractAddress) {
    const logoUrl = this.cachedTokenLogoUrls[contractAddress];
    if (logoUrl) {
      return logoUrl;
    } else {
      return null;
    }
  }
}

export default window.Storage;
