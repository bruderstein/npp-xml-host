FROM node:6

MAINTAINER Dave Brotherstone <davegb@pobox.com>

RUN mkdir /app

EXPOSE 5000
EXPOSE 5001
VOLUME /content

COPY ./dockerAssets/start.sh /app/

COPY ./package.json /app/
RUN cd /app && \
npm install --production

COPY . /app/

CMD ["/app/start.sh"]
