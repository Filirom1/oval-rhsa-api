#!/usr/bin/env node

var xml = require('coffee-script/register')
var xml = require('xml-object-stream')
var fs = require('fs')
var path = require('path')
var express = require('express');
var bodyParser = require('body-parser');
var vercomp = require('smart-vercomp')
var _ = require('underscore')
var app = express();
app.use(bodyParser.text({type: '*/*'}))

var rhsa_file = process.env["RHSA_FILE"] || process.env["OPENSHIFT_DATA_DIR"] + 'com.redhat.rhsa-all.xml'
var stream = fs.createReadStream(rhsa_file);
var parser = xml.parse(stream)

var definitions = {}
var rhsa = {
  rhel: {
    3: {},
    4: {},
    5: {},
    6: {},
    7: {},
    8: {}
  }
}

console.log("Parse RHS definitions: " + rhsa_file)
parser.each('definition', function(definition){
  var id = 'rhsa-' + definition.$.id.replace('oval:com.redhat.rhsa:def:', '')
  var title = definition.metadata.title.$text;
  var severity = definition.metadata.advisory.severity.$text;
  var os_version = /\d+/.exec(definition.metadata.affected.platform.$text)

  var references = []
  definition.metadata.$children.filter(function(reference){
    if(reference.$name !== 'reference') return
    references.push(reference.$.ref_id)
  });

  definitions[id] = {
    severity: severity,
    title: title,
    references: references
  }

  analyseCriteria(definition)
  function analyseCriteria(definition){
    if(definition.criteria){
      definition.criteria.$children.filter(function(criterion){
        analyseCriteria(criterion);
        if(criterion.$name !== 'criterion') return

        var comment = criterion.$.comment
        if(! comment.match(/is earlier than/)) return
        var arr = comment.split(" is earlier than ")
        var name = arr[0]
        var version = arr[1].replace(/.*:/, '');
        rhsa['rhel'][os_version][name] = rhsa['rhel'][os_version][name] || {}
        rhsa['rhel'][os_version][name][version] = id;
      });
    }
  }
})

parser.on('end', startHttpServer);

function startHttpServer(){
  var ip = process.env['IP'] || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';
  var port = process.env['PORT'] || process.env.OPENSHIFT_NODEJS_PORT || '3000';
  var server = app.listen(port, ip, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Listening at http://%s:%s', host, port);
  });
}

app.get('/', function (req, res) {
  var url = req.protocol + '://' + req.get('host')
  var text = "Usage: rpm -qa | curl -data-binary @- " + url + "/rhel/YOUR_RHEL_VERSION_HERE"
  res.send(text)
});

app.post('/:os/:os_version', function (req, res) {
  var os = req.params.os
  var os_version = req.params.os_version
  var rhsa_found = []

  var lines = req.body.split("\n");
  lines.forEach(function(line){
    var name = line.replace(/-[0-9].*\.(x86|x86_64|noarch|i?86)$/, '');
    var version = line.replace(name, '').replace(/-/, '').replace(/\.(x86|x86_64|noarch|i?86)$/, '')

    rhsa[os][os_version][name] = rhsa[os][os_version][name] || {};
    _(rhsa[os][os_version][name]).forEach(function(rhsa_id, rhsa_version){
      if(vercomp(version, rhsa_version) === -1){
        rhsa_found.push({id: rhsa_id, rpm : name })
      }
    })
  });

  res.send(rhsa_found.map(function(rhsa){
    return _.defaults(rhsa,definitions[rhsa.id])
  }));
});
