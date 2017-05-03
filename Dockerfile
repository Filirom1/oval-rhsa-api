FROM centos7
MAINTAINER Wassim DHIF <wassimdhif@gmail.com>

WORKDIR /app

ENV RHSA_FILE ./com.redhat.rhsa-all.xml
ENV IP 0.0.0.0
ENV PORT 3000

COPY . /app

RUN wget http://www.redhat.com/security/data/oval/com.redhat.rhsa-all.xml
RUN yum install -y nodejs git make gcc-c++
RUN npm install

EXPOSE 3000
CMD ["npm", "start"]
