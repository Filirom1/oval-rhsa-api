FROM centos
MAINTAINER Wassim DHIF <wassimdhif@gmail.com>

WORKDIR /app

COPY . /app

RUN \
    yum install -y epel-release git wget make gcc-c++ && \
    yum install -y nodejs npm && \
    yum clean all && npm cache clear

RUN npm install

EXPOSE 3000
CMD ["npm", "start"]
