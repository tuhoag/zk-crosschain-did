#!/bin/zsh

docker build -f Dockerfile.api -t zkcrosschaindid/api:1.0 .
docker build -f Dockerfile.oracle -t zkcrosschaindid/oracle:1.0 .