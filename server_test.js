const request = require('request')
const mapLimit = require('async/mapLimit')

const execSync = require('child_process').execSync;

execSync("wget -N https://www.redhat.com/security/data/oval/com.redhat.rhsa-all.xml")
const grep = execSync(`grep "is earlier than" com.redhat.rhsa-all.xml|sed 's/.*comment="//g' |sed 's/".*//g'`).toString().split("\n")

process.env.RHSA_URL = './com.redhat.rhsa-all.xml'
process.env.PORT = 3000

var server = require('./server');
server.once('downloaded', ()=>{
  [5,6,7].forEach((os)=>{
    const grepFiltered = grep.filter((line)=>{return line.indexOf(`.el${os}`) !== -1})
      mapLimit(grepFiltered, 50, (line,cb)=>{
          const rpm = line.split(" ")[0]
          request({uri: `http://localhost:${process.env.PORT}/rhel/${os}`, body: `${rpm} 0.0.0-1`, method: 'post', headers: {'content-type': 'application/text'}}, (err, resp, body)=>{
              if(err) { throw err }
              const json = JSON.parse(body)
              if(json.lenSth === 0){throw new Error(`${rpm} on ${os} without CVE: ${line}`)}
              cb(null,line)
          })
      }, (err, lines)=>{
        if(err){
          throw err
        }
        console.log("RPM tested", JSON.stringify(lines, null, 2))
        process.exit(0)
      })
  })
})
