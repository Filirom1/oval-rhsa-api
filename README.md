# vulnerability-api

Vulnerability API that provides a list of threats for your server.

It detects vulnerabilities based on Redhat Security Announce (RHSA) definitions based on Open Vulnerability and Assessment Language (OVAL) format. [Get more information](https://access.redhat.com/articles/221883)

You just need to send the output of `rpm -qa` to the API to get instantly the list of threats for your server.

Currently only RHEL/Centos is supported

Online version available at: <https://vulnerability-youpihoura.rhcloud.com/>

## Install

```
$ npm i -g vulnerability-api
```

## Configure

```
$ wget http://www.redhat.com/security/data/oval/com.redhat.rhsa-all.xml
$ export RHSA_FILE=./com.redhat.rhsa-all.xml
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
## License

MIT

## Contribution welcomed :-)
