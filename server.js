require('coffee-script/register');
require('node-expat');

const _ = require('underscore');
const bodyParser = require('body-parser');
const exec = require('child_process').exec;
const express = require('express');
const fs = require('fs');
const http = require('http');
const marked = require('marked');
const morgan = require('morgan');
const request = require('request');
const vercomp = require('smart-vercomp');
const xml = require('xml-object-stream');

const RHS_URL = 'http://www.redhat.com/security/data/oval/com.redhat.rhsa-all.xml';

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
  console.log('Downloading RHS');
  request
    .get(RHS_URL)
    .on('response', (response) => {
      parseXML(response);
    })
    .on('end', () => {
      console.log('RHS Downloaded');
    });

  setTimeout(downloadFile, 1000 * 60 * 60 * 24);
};

function startHttpServer() {
  const ip = process.env['IP'] || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';
  const port = process.env['PORT'] || process.env.OPENSHIFT_NODEJS_PORT || '3000';
  const server = app.listen(port, ip, () => {
    const host = server.address().address;
    const port = server.address().port;

    console.log('Listening at http://%s:%s', host, port);
  });
};

function parseXML(response) {
  const parser = xml.parse(response);

  console.log('Parsing RHS definitions');

  parser.each('definition', (definition) => {
    const id = 'rhsa-' + definition.$.id.replace('oval:com.redhat.rhsa:def:', '');
    const title = definition.metadata.title.$text;
    const severity = definition.metadata.advisory.severity.$text;
    const os_version = /\d+/.exec(definition.metadata.affected.platform.$text);

    let references = [];
    definition.metadata.$children.filter ((reference) => {
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
      if (definition.criteria) {
        definition.criteria.$children.filter((criterion) => {
          analyseCriteria(criterion);
          if (criterion.$name !== 'criterion') return;

          const comment = criterion.$.comment;
          if (!comment.match(/is earlier than/)) return;

          const arr = comment.split(' is earlier than ');
          const name = arr[0];
          const version = arr[1].replace(/.*:/, '');
          rhsa['rhel'][os_version][name] = rhsa['rhel'][os_version][name] || {};
          rhsa['rhel'][os_version][name][version] = id;
        });
      };
    };
  });

  parser.on('end', () => {
    console.log('RHS definitions parsed');
  });
};

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
    const name = line.replace(/-[0-9].*\.(x86|x86_64|noarch|i?86)$/, '');
    const version = line.replace(name, '').replace(/-/, '').replace(/\.(x86|x86_64|noarch|i?86)$/, '');

    rhsa[os][os_version][name] = rhsa[os][os_version][name] || {};
    _(rhsa[os][os_version][name]).forEach((rhsa_id, rhsa_version) => {
      if(vercomp(version, rhsa_version) === -1) {
        rhsa_found.push({
          id: rhsa_id,
          rpm : name,
        });
      };
    });
  });

  res.send(rhsa_found.map((rhsa) => {
    return _.defaults(rhsa,definitions[rhsa.id]);
  }));
});
