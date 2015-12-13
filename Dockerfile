FROM node:4

MAINTAINER Dave Brotherstone <davegb@pobox.com>

RUN mkdir /app

EXPOSE 5001
VOLUME /content

COPY ./package.json /app/
RUN cd /app && \
    npm install

COPY ./*.js /app/
COPY ./lib/    /app/lib/

CMD ["node", "/app/index"]
