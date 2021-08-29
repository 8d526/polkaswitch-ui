import React, {useCallback, useEffect, useRef, useState} from 'react';
import { createChart, CrosshairMode } from "lightweight-charts";
import TokenPairSelector from "./TokenPairSelector";
import ChartPriceDetails from "./ChartPriceDetails";
import ChartViewOption from "./ChartViewOption";
import ChartRangeSelector from "./ChartRangeSelector";
import EventManager from "../../../utils/events";
import BN from 'bignumber.js';

export default function TradingViewChart(){

  const timeRangeList = {
    candlestick: [
      {name: "1D", value: 1, from: 'Past 1 day'},
      {name: "1W", value: 7, from: 'Past week'},
      {name: "2W", value: 14, from: 'Past 2 weeks'},
      {name: "1M", value: 30, from: 'Past month'}
    ],
    line: [
      {name: "1D", from: 'Past 1 day'},
      {name: "3D", from: 'Past 3 days'},
      {name: "1W", from: 'Past week'},
      {name: "1M", from: 'Past month'},
      {name: "1Y", from: 'Past year'}
    ]
  };

  const wrapTokens = {
    "BNB": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    "AVAX": "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"
  }

  const viewModes = ["candlestick", "line"];
  const chartContainerRef = useRef();
  const chart = useRef();
  const resizeObserver = useRef();
  const createTokenPairList = () => {
    const swapConfig = TokenListManager.getSwapConfig();
    const list = []
    const fromSymbol = swapConfig.from.symbol;
    const fromAddress = swapConfig.from.address;
    const fromTokenLogo = swapConfig.from.logoURI;
    const toSymbol = swapConfig.to.symbol;
    const toAddress = swapConfig.to.address;
    const toTokenLogo = swapConfig.to.logoURI;

    list.push({name: fromSymbol + '/' + toSymbol, fromSymbol, fromAddress, fromTokenLogo, toSymbol, toAddress, toTokenLogo});
    list.push({name: toSymbol + '/' + fromSymbol, fromSymbol: toSymbol, fromAddress:toAddress, fromTokenLogo:toTokenLogo,  toSymbol: fromSymbol, toAddress: fromAddress, toTokenLogo: fromTokenLogo});
    list.push({name: fromSymbol, fromSymbol, fromAddress: fromAddress, fromTokenLogo});
    list.push({name: toSymbol, fromSymbol: toSymbol, fromAddress: toAddress, fromTokenLogo: toTokenLogo});
    return list;
  }
  let candleSeries = useRef(null);
  let lineSeries = useRef(null);

  // init states
  const initTokenPair = createTokenPairList();
  const [tokenPairs, setTokenPairs] = useState(initTokenPair);
  const [selectedPair, setSelectedPair] = useState(initTokenPair[0]);
  const [selectedViewMode, setSelectedViewMode] = useState(viewModes[1]);
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRangeList['line'][0]);
  const [isPair, setIsPair] = useState(true);
  const [priceDetails, setPriceDetails] = useState({ price:0, percent: 0, from: timeRangeList['line'][0].from })
  const [linePriceData, setLinePriceData] = useState([]);
  const [candlePriceData, setCandlePriceData] = useState([]);

  useEffect(()=>{
    let subSwapConfigChange = EventManager.listenFor(
        'swapConfigUpdated', handleSwapConfigChange
    );

    return () => {
      subSwapConfigChange.unsubscribe();
      chart.current.remove();
    }
  }, []);

  // Resize chart on container resizes.
  useEffect(() => {
    resizeObserver.current = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      chart.current.applyOptions({ width, height });
      setTimeout(() => {
        chart.current.timeScale().fitContent();
      }, 0);
    });

    resizeObserver.current.observe(chartContainerRef.current);

    return () => resizeObserver.current.disconnect();
  }, []);

  // Fetch Data
  useEffect(() =>{
    fetchData(selectedPair, selectedTimeRange, selectedViewMode);
  }, [selectedPair, selectedTimeRange, selectedViewMode])

  useEffect(() => {
    if (!chart.current) {
      chart.current = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
        layout: {
          backgroundColor: '#253248',
          textColor: 'rgba(255, 255, 255, 0.9)',
        },
        grid: {
          vertLines: {
            color: '#334158',
          },
          horzLines: {
            color: '#334158',
          },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
        },
        priceScale: {
          borderColor: '#485c7b',
        },
        timeScale: {
          borderColor: '#485c7b',
          timeVisible: true,
          secondsVisible: true,
        },
      });
    }

    if (candleSeries.current) {
      chart.current.removeSeries(candleSeries.current);
      candleSeries.current = null;
    }
    if (lineSeries.current) {
      chart.current.removeSeries(lineSeries.current);
      lineSeries.current = null;
    }

    if (selectedViewMode === viewModes[0]) {
      candleSeries.current = chart.current.addCandlestickSeries({
        upColor: '#4bffb5',
        downColor: '#ff4976',
        borderDownColor: '#ff4976',
        borderUpColor: '#4bffb5',
        wickDownColor: '#838ca1',
        wickUpColor: '#838ca1',
      });

      candleSeries.current.setData(candlePriceData);
      chart.current.timeScale().fitContent();
    } else {
      lineSeries.current = chart.current.addAreaSeries({
        topColor: "rgba(38,198,218, 0.56)",
        bottomColor: "rgba(38,198,218, 0.04)",
        lineColor: "rgba(38,198,218, 1)",
        lineWidth: 2
      });

      lineSeries.current.setData(linePriceData);
      chart.current.timeScale().fitContent();
    }

  }, [linePriceData, candlePriceData]);

  const fetchData = async (selectedPair, timeRange, viewMode) => {
    const config = TokenListManager.getCurrentNetworkConfig();
    let fromTokenPrices = [];
    let toTokenPrices = [];
    let tokenPrices = [];
    if (viewMode === 'line') {
      const { fromTimestamp, toTimestamp } = getTimestamps(timeRange);
      const url = config.tradeView.lineUrl;
      const platform = config.tradeView.platform;

      if (selectedPair.fromSymbol && selectedPair.toSymbol) {
        const fromAddress = getContractAddress( selectedPair.fromAddress, selectedPair.fromSymbol, platform);
        const toAddress = getContractAddress( selectedPair.toAddress, selectedPair.toSymbol, platform);

        fromTokenPrices = await fetchLinePrices(url, fromAddress, 'usd', fromTimestamp, toTimestamp);
        toTokenPrices = await fetchLinePrices(url, toAddress, 'usd', fromTimestamp, toTimestamp) || [];
        tokenPrices = mergeLinePrices(fromTokenPrices, toTokenPrices);
      } else {
        const fromAddress = getContractAddress( selectedPair.fromAddress, selectedPair.fromSymbol, platform);

        fromTokenPrices = await fetchLinePrices(url, fromAddress, 'usd', fromTimestamp, toTimestamp);
        tokenPrices = mergeLinePrices(fromTokenPrices, null);
      }

      setLinePriceData(tokenPrices);
    } else {
      const url = config.tradeView.candleStickUrl;

      if (selectedPair.fromSymbol && selectedPair.toSymbol) {
        const fromCoin = TokenListManager.findTokenBySymbolFromCoinGecko(selectedPair.fromSymbol.toLowerCase());
        const toCoin = TokenListManager.findTokenBySymbolFromCoinGecko(selectedPair.toSymbol.toLowerCase());

        if (fromCoin && toCoin) {
          fromTokenPrices = await fetchCandleStickPrices(url, fromCoin.id, 'usd', timeRange.value) || [];
          toTokenPrices = await fetchCandleStickPrices(url, toCoin.id, 'usd', timeRange.value) || [];
        }

        tokenPrices = mergeCandleStickPrices(fromTokenPrices, toTokenPrices);
      } else {
        const coinId = TokenListManager.findTokenBySymbolFromCoinGecko(selectedPair.fromSymbol.toLowerCase());

        if (coinId) {
          fromTokenPrices = await fetchCandleStickPrices(url, coinId.id, 'usd', timeRange.value);
        }

        tokenPrices = mergeCandleStickPrices(fromTokenPrices, null);
      }

      setCandlePriceData(tokenPrices)
    }

    if (tokenPrices.length >  0) {
      const { price, percent } = getPriceDetails(tokenPrices, selectedViewMode)
      setPriceDetails({ price, percent, from: selectedTimeRange.from })
    } else {
      setPriceDetails({ price: 0, percent: 0, from: selectedTimeRange.from })
    }
  };

  const getPriceDetails = (prices, viewMode) => {
    let length = prices.length
    let price =  0;
    let percent = 0;
    const firstItem = prices[0]
    const lastItem = prices[length - 1]

    if (viewMode === 'line') {
      percent = new BN(lastItem.value).div(new BN(firstItem.value)).times(100).minus(100).toFixed(2) ;
      price = lastItem.value;
    } else {
      percent = new BN(lastItem.open).div(new BN(firstItem.open)).times(100).minus(100).toFixed(2);
      console.log(percent)
      price = lastItem.open;
    }

    return { price,  percent }
  }

  const getContractAddress = (contract, symbol, platform) => {
    if (wrapTokens.hasOwnProperty(symbol)) {
      return wrapTokens[symbol];
    } else {
      const coin = TokenListManager.findTokenBySymbolFromCoinGecko(symbol.toLowerCase());
      if (coin && coin['platforms'].hasOwnProperty(platform)) {
        return coin['platforms'][platform];
      }
      return contract;
    }
  }

  const fetchLinePrices = async(baseUrl, contract, currency, fromTimestamp, toTimestamp, attempt) => {
    let result = [];
    if (!attempt) {
      attempt = 0;
    } else if (attempt > 1) {
      return result;
    }
    try {
      const response = await fetch(`${baseUrl}/contract/${contract.toLowerCase()}/market_chart/range?vs_currency=${currency}&from=${fromTimestamp}&to=${toTimestamp}`)
      if (!response.ok) {
        throw new Error()
      }
      const data = await response.json();
      if (data) {
        result = data.prices
      }
      return result;
    } catch (err) {
      console.error("Failed to fetch price data", err);
      await fetchLinePrices(baseUrl, contract, currency, fromTimestamp, toTimestamp, attempt + 1);
    }
  }

  const fetchCandleStickPrices = async(baseUrl, coinId, currency, days, attempt) => {
    let result = [];
    if (!attempt) {
      attempt = 0;
    } else if (attempt > 1) {
      return result;
    }
    try {
      const response = await fetch(`${baseUrl}/${coinId}/ohlc?vs_currency=${currency}&days=${days}`);

      if (!response.ok) {
        throw new Error()
      }
      const data = await response.json();
      if (data) {
        result = data
      }

      return result;
    } catch (err) {
      console.error("Failed to fetch price data", err);
      await fetchCandleStickPrices(baseUrl, coinId, currency, days, attempt + 1);
    }
  }

  const mergeLinePrices = (fromTokenPrices, toTokenPrices) => {
    const prices = [];
    if (fromTokenPrices && toTokenPrices && (fromTokenPrices.length > 0) && (toTokenPrices.length > 0)) {
      if (fromTokenPrices.length === toTokenPrices.length) {
        for (let i = 0; i < fromTokenPrices.length; i++) {
          prices.push({
            time: getFilteredTimestamp(fromTokenPrices[i][0]),
            value: BN(fromTokenPrices[i][1]).div(toTokenPrices[i][1]).toNumber()
          })
        }
      } else {
        const tempObj = {}
        for (let i = 0; i < fromTokenPrices.length; i++) {
          tempObj[getFilteredTimestamp(fromTokenPrices[i][0])] = fromTokenPrices[i]
        }

        for (let j = 0; j < toTokenPrices.length; j++) {
          const timeStampOfTotoken = getFilteredTimestamp(toTokenPrices[j][0]);
          if (tempObj.hasOwnProperty(timeStampOfTotoken)) {
            const fromTokenItem = tempObj[timeStampOfTotoken];
            const mergedValue = {
              time: timeStampOfTotoken,
              value: BN(fromTokenItem[1]).div(toTokenPrices[j][1]).toNumber()
            }
            tempObj[timeStampOfTotoken] = mergedValue
          }
        }

        for (const property in tempObj) {
          if (!Array.isArray(tempObj[property])) {
            prices.push(tempObj[property])
          }
        }
     }
    } else if ((fromTokenPrices && fromTokenPrices.length > 0) && (toTokenPrices === null)) {
      for (let i = 0; i < fromTokenPrices.length; i++) {
        prices.push({time: getFilteredTimestamp(fromTokenPrices[i][0]), value: BN(fromTokenPrices[i][1]).toNumber()})
      }
    }
    return prices;
  }

  const mergeCandleStickPrices = (fromTokenPrices, toTokenPrices) => {
    const prices = [];
    if (fromTokenPrices && toTokenPrices && (fromTokenPrices.length > 0) && (toTokenPrices.length > 0)) {
      const tempObj = {}
      for (let i = 0; i < fromTokenPrices.length; i++) {
        tempObj[getFilteredTimestamp(fromTokenPrices[i][0])] = fromTokenPrices[i]
      }

      for (let j = 0; j < toTokenPrices.length; j++) {
        const timeStampOfTotoken = getFilteredTimestamp(toTokenPrices[j][0]);
        if (tempObj.hasOwnProperty(timeStampOfTotoken)) {
          const fromTokenItem = tempObj[timeStampOfTotoken];
          const mergedValue = {
            time : timeStampOfTotoken,
            open: BN(fromTokenItem[1]).div(toTokenPrices[j][1]).toNumber(),
            high: BN(fromTokenItem[2]).div(toTokenPrices[j][2]).toNumber(),
            low: BN(fromTokenItem[3]).div(toTokenPrices[j][3]).toNumber(),
            close: BN(fromTokenItem[4]).div(toTokenPrices[j][4]).toNumber(),
          }
          tempObj[timeStampOfTotoken] = mergedValue
        }
      }

      for (const property in tempObj) {
        if (!Array.isArray(tempObj[property])) {
          prices.push(tempObj[property])
        }
      }

    } else if ((fromTokenPrices.length > 0) && (toTokenPrices === null)) {
      for (let i = 0; i < fromTokenPrices.length; i++) {
        prices.push({
          time: getFilteredTimestamp(fromTokenPrices[i][0]),
          open: BN(fromTokenPrices[i][1]).toNumber(),
          high: BN(fromTokenPrices[i][2]).toNumber(),
          low: BN(fromTokenPrices[i][3]).toNumber(),
          close: BN(fromTokenPrices[i][4]).toNumber(),
        })
      }
    }
    return prices;
  }

  const getFilteredTimestamp = (timestampMillisec) => {
    const timestampSec = (timestampMillisec - (timestampMillisec % 1000)) / 1000;
    const timestampMin = timestampSec - (timestampSec % 60);
    return timestampMin;
  }

  const getTimestamps = (timeRange) => {
    let fromTimestamp = Date.now();
    const toTimestamp = Math.ceil(Date.now() / 1000);
    let currentDate = new Date();
    switch (timeRange.name) {
      case "1D":
        currentDate.setDate(currentDate.getDate() - 1);
        break;
      case "3D":
        currentDate.setDate(currentDate.getDate() - 3);
        break;
      case "1W":
        currentDate.setDate(currentDate.getDate() - 7);
        break;
      case "1M":
        currentDate.setMonth(currentDate.getMonth()-1);
        break;
      case "1Y":
        currentDate.setFullYear(currentDate.getFullYear() - 1);
        break;
    }

    fromTimestamp = Math.ceil(currentDate.getTime() / 1000);
    return {fromTimestamp, toTimestamp}
  }

  const handleSwapConfigChange = () => {
    const updatedTokenPairList = createTokenPairList();
    setTokenPairs(updatedTokenPairList);
    setSelectedPair(updatedTokenPairList[0]);
    setIsPair(true);
  }

  const handleTokenPairChange = (pair) => {
    if (pair && pair.fromSymbol && pair.toSymbol) {
      setIsPair(true);
    } else {
      setIsPair(false);
    }
    setSelectedPair(pair);
  }

  const handleViewModeChange = (mode) => {
    setSelectedTimeRange(timeRangeList[mode][0]);
    setSelectedViewMode(mode);
  }

  const handleRangeChange = (timeRange) => {
    setSelectedTimeRange(timeRange);
  }

  return (
      <div className="trading-view-wrapper">
        <div className="trading-view-header">
          <TokenPairSelector
              tokenPairs={tokenPairs}
              selectedPair={selectedPair}
              handleTokenPairChange={handleTokenPairChange}
          />
          <ChartPriceDetails priceDetails={priceDetails} isPair={isPair}/>
        </div>
        <div className="trading-view-body">
          <ChartViewOption
              selectedViewMode={selectedViewMode}
              handleViewModeChange={handleViewModeChange}
          />
          <div className="chart"  ref={chartContainerRef}/>
          <ChartRangeSelector
              timeRangeList={timeRangeList}
              selectedTimeRange={selectedTimeRange}
              selectedViewMode={selectedViewMode}
              handleTimeRangeChange={handleRangeChange}/>
        </div>
      </div>
    );
}
