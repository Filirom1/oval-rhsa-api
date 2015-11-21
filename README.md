# vulnerability-api

Vulnerability API that provides a list of threats for your server.

It detects vulnerabilities based on Redhat Security Announce (RHSA) definitions.

You just need to send the output of `rpm -qa` to the API to getin instantly the list of threats for your server.

Currently only RHEL/Centos is supported

## Install

```
$ npm i -g vulnerability-api
```

## Configure

```
$ wget -p /tmp http://www.redhat.com/security/data/oval/com.redhat.rhsa-all.xml
$ export RHSA_FILE=/tmp/com.redhat.rhsa-all.xml
$ export IP=0.0.0.0
$ export PORT=3000
```

## Start the API Server

```
$ vulnerability-api
```

## Check your servers vulnerabilities

Exemple for CentOS 7

```
$ rpm -qa | curl --data-binary @- localhost:3000/rhel/7
```
