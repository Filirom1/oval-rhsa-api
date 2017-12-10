#!/usr/bin/env node
require('node-expat');

const EventEmitter = require('events');
const _ = require('underscore');
const bodyParser = require('body-parser');
const exec = require('child_process').exec;
const express = require('express');
const fs = require('fs');
const http = require('http');
const marked = require('marked');
const moment = require('moment');
const morgan = require('morgan');
const request = require('request');
const vercomp = require('smart-vercomp');
const xml = require('xml-object-stream-wdhif');

const RHSA_URL = process.env.RHSA_URL || 'https://www.redhat.com/security/data/oval/com.redhat.rhsa-all.xml';
const VULNERABILITY_API_CRON = parseInt(process.env.VULNERABILITY_API_CRON) || 24;

const eventEmitter = module.exports = new EventEmitter()

let definitions = {};
let rhsa = {
  rhel: {
    3: {},
    4: {},
    5: {},
    6: {},
    7: {},
    8: {},
  },
};

const app = express();
app.use(bodyParser.text({type: '*/*'}));
app.use(express.static('public'));
app.use(morgan('combined'));

function downloadFile() {
  if(RHSA_URL.indexOf('http') === -1 ){
    console.log(`Read RHSA file ${RHSA_URL}`);
    return parseXML(fs.createReadStream(RHSA_URL))
  }

  console.log(`Downloading RHSA ${RHSA_URL}`);
  eventEmitter.emit('download')
  request
    .get(RHSA_URL)
    .on('response', (response) => {
      parseXML(response);
    })
    .on('end', () => {
      console.log('RHSA Downloaded');
      eventEmitter.emit('downloaded')
    });

  setTimeout(downloadFile, moment.duration(VULNERABILITY_API_CRON, 'hours'));
};

function startHttpServer() {
  const ip = process.env['IP'] || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';
  const port = process.env['PORT'] || process.env.OPENSHIFT_NODEJS_PORT || '3000';
  const server = app.listen(port, ip, () => {
    const host = server.address().address;
    const port = server.address().port;

    console.log('Listening at http://%s:%s', host, port);
    eventEmitter.emit('listening')
  });
};

function parseXML(response) {
  eventEmitter.emit('parse')
  const parser = xml.parse(response);

  console.log('Parsing RHS definitions');

  parser.each('definition', (definition) => {
    const id = 'rhsa-' + definition.$.id.replace('oval:com.redhat.rhsa:def:', '');
    const title = definition.metadata.title.$text;
    const severity = definition.metadata.advisory.severity.$text;
    definition.metadata.affected.$children.forEach((platform) => {
      if (platform.$name !== 'platform') return;
      const os_version = /\d+/.exec(platform.$text);

      let references = [];
      definition.metadata.$children.forEach ((reference) => {
        if (reference.$name !== 'reference') return;
        references.push(reference.$.ref_id);
      });

      definitions[id] = {
        severity: severity,
        title: title,
        references: references,
      };

      analyseCriteria(definition);
      function analyseCriteria(definition) {
        definition.$children.forEach((criteria) => {
          if (criteria.$name !== 'criteria') return;
          analyseCriteria(criteria);
        });
        definition.$children.forEach((criterion) => {
          if (criterion.$name !== 'criterion') return;

          const comment = criterion.$.comment;
          if (!comment.match(/is earlier than/)) return;

          const arr = comment.split(' is earlier than ');
          const name = arr[0];
          const version = arr[1].replace(/.*:/, '');
          if(version.match(/el[0-9]/) && version.indexOf(`el${os_version}`) == -1){
            // skip RPM tagged elX when not matching the right os_version
            return;
          }
          rhsa['rhel'][os_version][name] = rhsa['rhel'][os_version][name] || {};
          rhsa['rhel'][os_version][name][version] = id;
        });
      };
    });
  });

  parser.on('end', () => {
    console.log('RHS definitions parsed');
    eventEmitter.emit('parsed')
  });
};

function compareVersion(a,b){
  let [va, ra] = a.split('-')
  let [vb, rb] = b.split('-')
  // first compare version
  result = vercomp(va, vb)
  if(result == 0){
    ra = ra || ''
    rb = rb || ''
    // then compare release
    result = vercomp(ra, rb)
  }
  return result
}

downloadFile();
startHttpServer();

const readme = marked(fs.readFileSync('README.md').toString());

app.get('/', (req, res) => {
  res.send('<link rel="stylesheet" href="markdown.css"><link rel="icon" href="favicon.ico" type="image/x-icon" />' + readme);
});

app.post('/:os/:os_version', (req, res) => {
  const os = req.params.os;
  const os_version = req.params.os_version;
  let rhsa_found = [];

  const lines = req.body.split('\n');
  lines.forEach((line) => {

    // Split the RPM name from the version
    const [name, version] = line.split(' ')

    rhsa[os][os_version][name] = rhsa[os][os_version][name] || {};
    _(rhsa[os][os_version][name]).forEach((rhsa_id, rhsa_version) => {
      if(compareVersion(version, rhsa_version) === -1) {
        rhsa_found.push({
          id: rhsa_id,
          rpm: line,
          name: name,
          version: version,
          rule: `${name} < ${rhsa_version}`,
        });
      };
    });
  });

  res.send(rhsa_found.map((rhsa) => {
    return _.defaults(rhsa,definitions[rhsa.id]);
  }));
});
