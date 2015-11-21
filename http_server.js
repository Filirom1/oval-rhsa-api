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

var stream = fs.createReadStream(path.join(__dirname, 'com.redhat.rhsa-RHEL7.xml'));
var parser = xml.parse(stream)

var definitions = {}
var rhsa = {}

parser.each('definition', function(definition){
  var id = 'rhsa-' + definition.$.id.replace('oval:com.redhat.rhsa:def:', '')
  var title = definition.metadata.title.$text;
  var severity = definition.metadata.advisory.severity.$text;

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
        rhsa[name] = rhsa[name] || {}
        rhsa[name][version] = id;
      });
    }
  }
})

parser.on('end', function(){
  var server = app.listen(3000, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Example app listening at http://%s:%s', host, port);
  });
});

app.post('/', function (req, res) {
  var rhsa_found = []

  var lines = req.body.split("\n");
  lines.forEach(function(line){
    var name = line.replace(/-[0-9].*\.(x86|x86_64|noarch|i?86)$/, '');
    var version = line.replace(name, '').replace(/-/, '').replace(/\.(x86|x86_64|noarch|i?86)$/, '')

    rhsa[name] = rhsa[name] || {};
    _(rhsa[name]).forEach(function(rhsa_id, rhsa_version){
      if(vercomp(version, rhsa_version) === -1){
        rhsa_found.push({id: rhsa_id, rpm : name })
      }
    })
  });

  res.send(rhsa_found.map(function(rhsa){
    return _.defaults(rhsa,definitions[rhsa.id])
  }));
});
