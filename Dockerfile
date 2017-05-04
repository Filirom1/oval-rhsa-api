FROM centos
MAINTAINER Wassim DHIF <wassimdhif@gmail.com>

WORKDIR /app

COPY . /app

RUN \
    yum install -y epel-release git wget make gcc-c++ && \
    yum install -y nodejs npm

RUN npm install

EXPOSE 3000
CMD ["npm", "start"]
