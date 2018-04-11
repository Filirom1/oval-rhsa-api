# Vulnerability API

[![Build Status](https://travis-ci.org/Filirom1/vulnerability-api.svg?branch=master)](https://travis-ci.org/Filirom1/vulnerability-api) [![Greenkeeper badge](https://badges.greenkeeper.io/Filirom1/vulnerability-api.svg)](https://greenkeeper.io/)

Vulnerability API that provides a list of threats for your server.

It detects Common Vulnerabilities and Exposures (CVE) based on Redhat Security Announce (RHSA).
[More information](https://access.redhat.com/articles/221883)

You just need to send the output of `rpm -qa --qf '%{NAME} %{VERSION}-%{RELEASE}\n'` to the API to get instantly the list of threats for your server.

Currently only RHEL/Centos is supported

## Online demo

Online version available at: <https://vulnerability-api.herokuapp.com/>

Exemple for CentOS 7

```bash
$ rpm -qa --qf '%{NAME} %{VERSION}-%{RELEASE}\n' | curl --data-binary @- https://vulnerability-api.herokuapp.com/rhel/7
```

In development
```bash
$ curl -XPOST localhost:3000/rhel/7 -d wget-1.14-10.el7_0.1.x86_64
```

Result
```json
[
  {
    "id":"rhsa-20162587",
    "name":"wget",
    "version":"1.14-10.el7_0.1",
    "rpm":"wget-1.14-10.el7_0.1.x86_64",
    "severity":"Moderate",
    "title":"RHSA-2016:2587: wget security and bug fix update (Moderate)",
    "references":[
      "RHSA-2016:2587-02",
      "CVE-2016-4971"
    ]
  }
]
```

## Using Docker
```bash
$ docker run -d -p 3000:3000 vulnerability-api
$ rpm -qa --qf '%{NAME} %{VERSION}-%{RELEASE}\n' | curl --data-binary @- 127.0.0.1:3000/rhel/7
```

## Install
```bash
$ npm i -g vulnerability-api
```

## Configure

```bash
$ export IP=0.0.0.0
$ export PORT=3000
$ export VULNERABILITY_API_CRON=24 # CRON delay in days
```

## Start the API Server

```bash
$ vulnerability-api
Parse RHSA definitions: com.redhat.rhsa-all.xml
Listening at http://0.0.0.0:3000
```

## License

MIT

## Contribution welcomed :-)

<https://github.com/Filirom1/vulnerability-api>
