#!/bin/zsh
echo "Removing old containers..."
docker rm -f $(docker ps -aq)

source .env


echo "Starting containers..."
echo "Starting MongoDBs..."
docker run --name mongo0 -d -p 27017:27017 --network zkssi --rm mongo:latest

echo "Starting APIs..."
docker run --name api0 -dit -p 3000:8000 --network zkssi \
    -v $(pwd)/../data_apis:/app/data_apis \
    -v $(pwd)/../deployments:/app/deployments \
    -v $(pwd)/../zkcdid-lib-rs:/app/zkcdid-lib-rs \
    -e ID=0 \
    -e TYPE=api \
    -e API_URL=http://localhost:3000 \
    -e MONGO_URL=mongodb://mongo0:27017 \
    zkcrosschaindid/api:1.0
    # /bin/bash


echo "Starting Listeners..."
docker run --name oracle0l -dit --network zkssi \
    -v $(pwd)/../zk_oracles:/app/zk_oracles \
    -v $(pwd)/../deployments:/app/deployments \
    -v $(pwd)/../zkcdid-lib-rs:/app/zkcdid-lib-rs \
    -e ID=0 \
    -e TYPE=oracle \
    -e PRIVATE_KEY=$PRIVATE_KEY \
    -e MONGO_URL=mongodb://mongo0:27017 \
    zkcrosschaindid/oracle:1.0 \
    cargo watch -x 'run --bin listener'

echo "Starting Servers..."
docker run --name oracle0 -dit -p 4000:8000 --network zkssi \
    -v $(pwd)/../zk_oracles:/app/zk_oracles \
    -v $(pwd)/../deployments:/app/deployments \
    -v $(pwd)/../zkcdid-lib-rs:/app/zkcdid-lib-rs \
    -e ID=0 \
    -e TYPE=oracle \
    -e PRIVATE_KEY=$PRIVATE_KEY \
    -e MONGO_URL=mongodb://mongo0:27017 \
    zkcrosschaindid/oracle:1.0 \
    cargo watch -x 'run --bin server'