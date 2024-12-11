#!/bin/zsh
echo "Removing old containers..."
docker container rm -f $(docker ps -aq)

source .env


echo "Starting containers..."
echo "Starting MongoDBs..."
docker run --name mongo0 -d -p 27017:27017 --network zkssi --rm mongo:latest

echo "Starting APIs..."
docker run --name api0 -dit -p 3000:8000 --network zkssi \
    -v $(pwd)/../data_apis:/app/data_apis \
    -v $(pwd)/../zkcdid-lib-rs:/app/zkcdid-lib-rs \
    -e ID=0 \
    -e TYPE=api \
    -e API_URL=http://localhost:3000 \
    -e MONGO_URL=mongodb://mongo0:27017 \
    zkcrosschaindid/api:1.0
    # /bin/bash
# docker run --name api1 -dit -p 3000:8000 -v $(pwd):/app --network zkssi \
#     -e NAME=api1 \
#     -e API_URL=http://localhost:3000 \
#     -e MONGO_URL=mongodb://mongo1:27017 \
#     zkcrosschaindid/api:1.0

echo "Starting Oracle..."
docker run --name oracle0 -it -p 4000:8000 --network zkssi \
    -v $(pwd)/../zk_oracles:/app/zk_oracles \
    -v $(pwd)/../deployments:/app/deployments \
    -v $(pwd)/../zkcdid-lib-rs:/app/zkcdid-lib-rs \
    -e ID=0 \
    -e TYPE=oracle \
    -e PRIVATE_KEY=$PRIVATE_KEY \
    zkcrosschaindid/oracle:1.0 \
    /bin/bash