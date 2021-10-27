FROM centos
MAINTAINER Wassim DHIF <wassimdhif@gmail.com>

WORKDIR /app

RUN \
    yum install -y epel-release git wget make gcc-c++ python3 && \
    yum install -y nodejs npm && \
    yum clean all

COPY . /app
RUN npm install

EXPOSE 3000
CMD ["npm", "start"]
