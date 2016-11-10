import React from 'react';

import {angulars, register} from './react-wrapper';
import {ReactiveDetails} from './factory';
import {Overflow, MsgBox, NavTitle, Timestamp, VertNav} from './utils';


const getResourceLimitValue = container => {
  const limits = _.get(container, 'resources.limits');
  return limits && _.map(limits, (v, k) => `${k}: ${v}`).join(', ');
};

const Lifecycle = ({lifecycle}) => {
  const fields = lifecycle && angulars.k8s.probe.mapLifecycleConfigToFields(lifecycle);
  const postStart = _.get(fields, 'postStart.cmd');
  const preStop = _.get(fields, 'preStop.cmd');

  const label = stage => lifecycle && angulars.k8s.probe.getLifecycleHookLabel(lifecycle, stage);
  return <div>
    {postStart && <div><span>PostStart: {label('postStart')}</span> <code>{postStart}</code></div>}
    {preStop && <div><span>PreStop: {label('preStop')}</span> <code>{preStop}</code></div>}
    {!postStart && !preStop && <span>-</span>}
  </div>;
};

const Liveness = ({liveness}) => {
  const label = liveness && angulars.k8s.probe.getActionLabelFromObject(liveness);
  const value = liveness && _.get(angulars.k8s.probe.mapLivenessProbeToFields(liveness), 'cmd');
  return value ? <span>{label} <code>{value}</code></span> : <span>-</span>;
};

const Ports = ({ports}) => {
  if (!ports || !ports.length) {
    return <MsgBox title="No ports have been exposed" detail="Ports allow for traffic to enter this container" />;
  }

  return <table className="table">
    <thead>
      <tr>
        <th>Name</th>
        <th>Container</th>
      </tr>
    </thead>
    <tbody>
      {ports.map((p, i) => <tr key={i}>
        <td>{p.name}</td>
        <td>{p.containerPort}</td>
      </tr>)}
    </tbody>
  </table>;
};

const Volumes = ({volumes}) => {
  if (!volumes || !volumes.length) {
    return <MsgBox title="No volumes have been mounted" detail="Volumes allow data to be shared as files with the pod" />;
  }

  return <table className="table">
    <thead>
      <tr>
        <th>Access</th>
        <th>Location</th>
        <th>Mount Path</th>
      </tr>
    </thead>
    <tbody>
      {volumes.map((v, i) => <tr key={i}>
        <td>{v.readOnly === true ? 'Read Only' : 'Read / Write'}</td>
        <td>{v.name}</td>
        <td><Overflow value={v.mountPath} /></td>
      </tr>)}
    </tbody>
  </table>;
};

const Env = ({env}) => {
  if (!env || !env.length) {
    return <MsgBox title="No variables have been set" detail="An easy way to pass configuration values" />;
  }

  const value = (e) => {
    let v = e.valueFrom;
    if (_.has(v, 'fieldRef')) {
      return `field: ${v.fieldRef.fieldPath}`;
    } else if (_.has(v, 'resourceFieldRef')) {
      return `resource: ${v.resourceFieldRef.resource}`;
    } else if (_.has(v, 'configMapKeyRef')) {
      return `config-map: ${v.configMapKeyRef.name}/${v.configMapKeyRef.key}`;
    } else if (_.has(v, 'secretKeyRef')) {
      return `secret: ${v.secretKeyRef.name}/${v.secretKeyRef.key}`;
    }
    return e.value;
  };

  return <table className="table">
    <thead>
      <tr>
        <th>Name</th>
        <th>Value</th>
      </tr>
    </thead>
    <tbody>
      {env.map((e, i) => <tr key={i}>
        <td>{e.name}</td>
        <td>{value(e)}</td>
      </tr>)}
    </tbody>
  </table>;
};

const Details = (props) => {
  const container = _.find(props.spec.containers, {name: angulars.routeParams.name});
  const status = angulars.k8s.docker.getStatus(props, container.name);
  const state = angulars.k8s.docker.getState(status);

  // Split image string into the Docker image string and tag (aka version) portions. The tag defaults to 'latest'.
  const [containerImage, containerTag] = container.image ? container.image.split(':') : [null, 'latest'];

  return <div className="co-m-pane__body">
    <div className="co-m-pane__body-section--bordered">
      <div className="row">
        <div className="col-sm-4">
          <h1 className="co-section-title">Container Overview</h1>
          <dl>
            <dt>State</dt>
            <dd>{state.label}</dd>
            <dt>ID</dt>
            <dd><Overflow value={status.containerID} /></dd>
            <dt>Restart Count</dt>
            <dd>{status.restartCount}</dd>
            <dt>Resource Limits</dt>
            <dd>{getResourceLimitValue(container) || '-'}</dd>
            <dt>Lifecycle Hooks</dt>
            <dd><Lifecycle lifecycle={container.lifecycle} /></dd>
            <dt>Liveness Probe</dt>
            <dd><Liveness liveness={container.livenessProbe} /></dd>
            <dt>Started</dt>
            <dd><Timestamp timestamp={state.startedAt} /></dd>
            <dt>Finished</dt>
            <dd><Timestamp timestamp={state.finishedAt} /></dd>
          </dl>
        </div>

        <div className="col-sm-4">
          <h1 className="co-section-title">Image Details</h1>
          <dl>
            <dt>Image</dt>
            <dd><Overflow value={containerImage || '-'} /></dd>
            <dt>Image Version/Tag</dt>
            <dd>{containerTag || '-'}</dd>
            <dt>Command</dt>
            <dd>{container.command ? <pre><code>{container.command.join(' ')}</code></pre> : <span>-</span>}</dd>
            <dt>Args</dt>
            <dd>{container.args ? <pre><code>{container.args.join(' ')}</code></pre> : <span>-</span>}</dd>
            <dt>Pull Policy</dt>
            <dd>{angulars.k8s.docker.getPullPolicyLabel(container)}</dd>
          </dl>
        </div>

        <div className="col-sm-4">
          <h1 className="co-section-title">Network</h1>
          <dl>
            <dt>Node</dt>
            <dd><a href={`nodes/${props.spec.nodeName}`}>{props.spec.nodeName}</a></dd>
            <dt>Pod IP</dt>
            <dd>{props.status.podIP || '-'}</dd>
          </dl>
        </div>
      </div>

      <hr />

      <div className="row">
        <div className="col-sm-4">
          <h1 className="co-section-title">Ports</h1>
          <div className="co-table-container">
            <Ports ports={container.ports} />
          </div>
        </div>

        <div className="col-sm-4">
          <h1 className="co-section-title">Mounted Volumes</h1>
          <div className="co-table-container">
            <Volumes volumes={container.volumeMounts} />
          </div>
        </div>

        <div className="col-sm-4">
          <h1 className="co-section-title">Environment Variables</h1>
          <div className="co-table-container">
            <Env env={container.env} />
          </div>
        </div>
      </div>
    </div>
  </div>;
};

const ContainerPage = (props) => {
  const containers = _.get(props, 'data.spec.containers');
  const data = containers ? _.find(containers, {name: angulars.routeParams.name}) : props.data;
  return <div>
    <NavTitle {...props} detail={true} title={props.name} data={data} />
    <VertNav {...props} hideNav={true} pages={[{href: 'details', component: Details}]} className="co-m-pod" />
  </div>;
};

export const ContainersDetailsPage = (props) => {
  const {kinds, k8s, store} = angulars;
  const kind = kinds['POD'];
  const k8sResource = k8s[kind.plural];
  return <ReactiveDetails {...props} store={store} k8sResource={k8sResource} name={angulars.routeParams.podName}>
    <ContainerPage {...props} />
  </ReactiveDetails>;
};

register('ContainersDetailsPage', ContainersDetailsPage);
