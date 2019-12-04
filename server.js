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

const JSZip = require("jszip");
const JSZipUtils = require("jszip-utils");

const REDHAT_URL = process.env.REDHAT_URL || 'https://vulners.com/api/v3/archive/collection/?type=redhat&apiKey=IFXDFQPAFF2Z1XLCGKXG7ARI5654PFG4XFWE5FXP8I332RH7SEZX3NRDVJ9P0YHP';
const CENTOS_URL = process.env.CENTOS_URL || 'https://vulners.com/api/v3/archive/collection/?type=centos&apiKey=IFXDFQPAFF2Z1XLCGKXG7ARI5654PFG4XFWE5FXP8I332RH7SEZX3NRDVJ9P0YHP';
const SCANNED_OS = [{name: "centos", url: CENTOS_URL}, {name: "redhat", url: REDHAT_URL}];
const VULNERABILITY_API_CRON = parseInt(process.env.VULNERABILITY_API_CRON) || 24;

const eventEmitter = module.exports = new EventEmitter();

let definitions = {};
let rhsa = {
    redhat: {
        6: {},
        7: {},
        8: {},
    },
    centos: {
        6: {},
        7: {},
        8: {},
    }
};

const app = express();
app.use(bodyParser.text({type: '*/*'}));
app.use(express.static('public'));
app.use(morgan('combined'));

function downloadFiles() {
    SCANNED_OS.forEach(os => {
        downloadFile(os);
    });

    setTimeout(downloadFile, moment.duration(VULNERABILITY_API_CRON, 'hours'));
}

function downloadFile(os) {
    let url = os.url;
    if (url.indexOf('http') === -1) {
        console.log(`Read ${os.name} file ${url}`);

        fs.readFile(os.url, function (err, data) {
            if (err) throw err;
            JSZip.loadAsync(data).then(function (zip) {
                zip.file(`${os.name}.json`).async("string").then(function (data) {
                    return parseData(data, os);
                });
            })
        });
    } else {
        let data = [], dataLen = 0;
        request
            .get(os.url)
            .on('data', (chunk) => {
                data.push(chunk);
                dataLen += chunk.length;
            })
            .on('end', () => {
                console.log('RHSA Downloaded');
                let buf = Buffer.concat(data);

                // here we go !
                JSZip.loadAsync(buf).then(function (zip) {
                    zip.file(`${os.name}.json`).async("string").then(function (data) {
                        return parseData(data, os);
                    });
                });
            });
    }
}

function parseData(data, os) {
    eventEmitter.emit('parse');

    JSON.parse(data).forEach(cve => {
        const id = cve._id;
        const title = cve._source.title;
        const severity = cve._source.cvss.score;
        let references = cve._source.cvelist;
        definitions[id] = {
            severity: severity,
            title: title,
            references: references,
        };

        analyseCriteria(cve._source.affectedPackage, id, os.name);
    });

    console.log(`${os.name} CVE definitions parsed`);
    eventEmitter.emit('parsed');
}

function analyseCriteria(affectedPackages, id, os) {
    affectedPackages.forEach((affectedPackage) => {
        let osVersion = parseInt(affectedPackage.OSVersion);
        if (osVersion > 5) {
            rhsa[os][osVersion][affectedPackage.packageName] = rhsa[os][osVersion][affectedPackage.packageName] || {};
            rhsa[os][osVersion][affectedPackage.packageName][affectedPackage.packageVersion] = id;
        }
    });
}

function compareVersion(a, b) {
    let [va, ra] = a.split('-');
    let [vb, rb] = b.split('-');
    // first compare version
    result = vercomp(va, vb);
    if (result === 0) {
        ra = ra || '';
        rb = rb || '';
        // then compare release
        result = vercomp(ra, rb)
    }
    return result
}

function startHttpServer() {
    const ip = process.env['IP'] || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';
    const port = process.env['PORT'] || process.env.OPENSHIFT_NODEJS_PORT || '3000';
    const server = app.listen(port, ip, () => {
        const host = server.address().address;
        const port = server.address().port;

        console.log('Listening at http://%s:%s', host, port);
        eventEmitter.emit('listening')
    });
}

let filesParsed = 0;
downloadFiles();
eventEmitter.on('parsed', () => {
    filesParsed++;
    if (filesParsed === SCANNED_OS.length) {
        startHttpServer();
        filesParsed = 0;
    }
});

const readme = marked(fs.readFileSync('README.md').toString());

app.get('/', (req, res) => {
    res.send('<link rel="stylesheet" href="markdown.css"><link rel="icon" href="favicon.ico" type="image/x-icon" />' + readme);
});

app.post('/:os/:os_version', (req, res) => {
    const os = req.params.os;
    const os_version = req.params.os_version;
    let cveFoundMap = {};

    const lines = req.body.split('\n');
    lines.forEach((line) => {

        // Split the RPM name from the version
        const [name, version] = line.split(' ');

        rhsa[os][os_version][name] = rhsa[os][os_version][name] || {};
        _(rhsa[os][os_version][name]).forEach((cveId, cveVersion) => {
            if (compareVersion(version, cveVersion) === -1) {
                let cve = cveFoundMap[cveId];
                if (!cve) {
                    cve = {
                        id: cveId,
                        packages: []
                    };
                    _.defaults(cve, definitions[cveId]);
                    cveFoundMap[cveId] = cve;
                }
                cve.packages.push({
                    rpm: line,
                    name: name,
                    version: version,
                    rule: `${name} < ${cveVersion}`,
                });
            }
        });
    });

    res.send(Object.values(cveFoundMap));
});
