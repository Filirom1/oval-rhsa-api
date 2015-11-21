# Vulnerability API

Vulnerability API that provides a list of threats for your server.

It detects Common Vulnerabilities and Exposures (CVE) based on Redhat Security Announce (RHSA).
[More information](https://access.redhat.com/articles/221883)

You just need to send the output of `rpm -qa` to the API to get instantly the list of threats for your server.

Currently only RHEL/Centos is supported

## Online demo

Online version available at: <https://vulnerability-youpihoura.rhcloud.com/>

Exemple for CentOS 7

```bash
$ rpm -qa | curl --data-binary @- https://vulnerability-youpihoura.rhcloud.com/rhel/7
```

## Install

```bash
$ npm i -g vulnerability-api
```

## Configure

```bash
$ wget http://www.redhat.com/security/data/oval/com.redhat.rhsa-all.xml
$ export RHSA_FILE=./com.redhat.rhsa-all.xml
$ export IP=0.0.0.0
$ export PORT=3000
```

## Start the API Server

```bash
$ vulnerability-api
Parse RHS definitions: com.redhat.rhsa-all.xml
Listening at http://0.0.0.0:3000
```
## License

MIT

## Contribution welcomed :-)

<https://github.com/Filirom1/vulnerability-api>
