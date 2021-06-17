import React, { Component } from 'react';
import _ from "underscore";
import classnames from 'classnames';

import Wallet from '../../utils/wallet';
import Metrics from '../../utils/metrics';
import EventManager from '../../utils/events';
import TxQueue from '../../utils/txQueue';

export default class NotificationButton extends Component {
  constructor(props) {
    super(props);
    this.state = { refresh: Date.now() };
    this.handleUpdate = this.handleUpdate.bind(this);
  }

  componentDidMount() {
    this.subUpdates = EventManager.listenFor(
      'walletUpdated', this.handleUpdate
    );
    this.subUpdates = EventManager.listenFor(
      'txQueueUpdated', this.handleUpdate
    );
  }

  componentDidUnmount() {
    this.subUpdates.unsubscribe();
  }

  handleClick(e) {
    EventManager.emitEvent('promptTxHistory', 1);
  }

  handleUpdate() {
    this.setState({ refresh: Date.now() });
  }

  render() {
    var isConnected = Wallet.isConnectedToAnyNetwork();

    return (
      <div className="notification-button">
        <div className={classnames("bubble tag is-danger", {
          "is-hidden": (TxQueue.numOfPending() < 1)
        })}>
        {TxQueue.numOfPending()}
        </div>
        <button
          className={classnames("button", {
            "is-white is-medium connected": isConnected,
            "is-hidden": !isConnected
          })}
          onClick={this.handleClick.bind(this)}>

          <span className="icon">
            <ion-icon name="notifications-outline"></ion-icon>
          </span>
        </button>
      </div>
    );
  }
}
