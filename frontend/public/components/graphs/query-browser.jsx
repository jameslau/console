import * as React from 'react';
import * as _ from 'lodash-es';
import * as classNames from 'classnames';
import { addTraces, relayout, restyle } from 'plotly.js/lib/core';

import { connectToURLs, MonitoringRoutes } from '../../monitoring';
import { Dropdown, ExternalLink, LoadingInline } from '../utils';
import { formatPrometheusDuration, parsePrometheusDuration } from '../utils/datetime';
import { Line_ } from './line';

const spans = ['5m', '15m', '30m', '1h', '2h', '6h', '12h', '1d', '2d', '1w', '2w'];
const dropdownItems = _.zipObject(spans, spans);

class QueryBrowser_ extends Line_ {
  constructor(props) {
    super(props);

    _.assign(this.state, {
      isSpanValid: true,
      spanText: formatPrometheusDuration(props.timeSpan),
      span: props.timeSpan,
      updating: true,
    });

    this.data = [{}];
    this.traces = [0];

    _.merge(this.layout, {
      dragmode: 'zoom',
      height: 200,
      hoverlabel: {
        namelength: 80,
      },
      showlegend: false,
      xaxis: {
        fixedrange: false,
        tickformat: null, // Use Plotly's default datetime labels
        type: 'date',
      },
    });

    this.onPlotlyRelayout = e => {
      if (e['xaxis.autorange']) {
        this.showLatest(this.state.span);
      } else {
        const start = e['xaxis.range[0]'];
        const end = e['xaxis.range[1]'];
        if (start && end) {
          // Zoom to a specific graph time range
          this.start = new Date(start).getTime();
          this.end = new Date(end).getTime();
          const span = this.end - this.start;
          this.timeSpan = span;
          this.setState({isSpanValid: true, span, spanText: formatPrometheusDuration(span), updating: true}, () => {
            clearInterval(this.interval);

            // Refresh the graph data, but stop polling, since we are no longer displaying the latest data
            this.fetch(false);
          });
        }
      }
    };

    this.relayout = () => {
      const now = new Date();
      const end = this.end || now;
      const start = this.start || new Date(end - this.state.span);
      // eslint-disable-next-line no-console
      relayout(this.node, {'xaxis.range': [start, end]}).catch(e => console.error(e));
    };

    this.showLatest = span => {
      this.start = null;
      this.end = null;
      this.timeSpan = span;
      this.setState({isSpanValid: true, span, spanText: formatPrometheusDuration(span), updating: true}, () => {
        clearInterval(this.interval);
        this.fetch();
        this.relayout();
      });
    };

    this.onSpanTextChange = e => {
      const spanText = e.target.value;
      const span = parsePrometheusDuration(spanText);
      const isSpanValid = (span > 0);
      if (isSpanValid) {
        this.showLatest(span);
      }
      this.setState({isSpanValid, spanText});
    };
  }

  updateGraph(data) {
    const newData = _.get(data, '[0].data.result');
    if (!_.isEmpty(newData)) {
      this.data = newData;
      let traceIndex = 0;
      _.each(newData, ({metric, values}) => {
        // If props.metric is specified, ignore all other metrics
        const labels = _.omit(metric, '__name__');
        if (this.props.metric && _.some(labels, (v, k) => _.get(this.props.metric, k) !== v)) {
          return;
        }

        // The data may have missing values, so we fill those gaps with nulls so that the graph correctly shows the
        // missing values as gaps in the line
        const start = values[0][0];
        const end = _.last(values)[0];
        const step = this.state.span / this.props.numSamples / 1000;
        _.range(start, end, step).map((t, i) => {
          if (_.get(values, [i, 0]) > t) {
            values.splice(i, 0, [t, null]);
          }
        });

        const update = {
          line: {
            width: 1,
          },
          name: _.map(labels, (v, k) => `${k}=${v}`).join(','),
          x: [values.map(v => new Date(v[0] * 1000))],
          y: [values.map(v => v[1])],
        };

        if (!this.traces.includes(traceIndex)) {
          // eslint-disable-next-line no-console
          addTraces(this.node, update, traceIndex).catch(e => console.error(e));
          this.traces.push(traceIndex);
        }
        // eslint-disable-next-line no-console
        restyle(this.node, update, [traceIndex]).catch(e => console.error(e));
        traceIndex += 1;
      });

      this.relayout();
    }
    this.setState({updating: false});
  }

  render() {
    const {query, timeSpan, urls} = this.props;
    const {spanText, isSpanValid, updating} = this.state;
    const baseUrl = urls[MonitoringRoutes.Prometheus];

    return <div className="query-browser__wrapper">
      <div className="query-browser__header">
        <div className="query-browser__controls">
          <input
            className={classNames('form-control query-browser__span-text', {'query-browser__span-text--error': !isSpanValid})}
            onChange={this.onSpanTextChange}
            type="text"
            value={spanText}
          />
          <Dropdown
            buttonClassName="btn-default form-control query-browser__span-dropdown"
            items={dropdownItems}
            noSelection={true}
            onChange={v => this.showLatest(parsePrometheusDuration(v))}
          />
          <button
            className="btn btn-default query-browser__span-reset"
            onClick={() => this.showLatest(timeSpan)}
            type="button"
          >Reset Zoom</button>
          {updating && <LoadingInline />}
        </div>
        {baseUrl && query && <ExternalLink href={`${baseUrl}/graph?g0.expr=${encodeURIComponent(query)}&g0.tab=0`} text="View in Prometheus UI" />}
      </div>
      <div ref={this.setNode} style={{width: '100%'}} />
    </div>;
  }
}
export const QueryBrowser = connectToURLs(MonitoringRoutes.Prometheus)(QueryBrowser_);
