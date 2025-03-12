echo "Starting Oracle..."
docker run --name oracle0l -p 4000:8000 --network zkssi \
    -v $(pwd)/../zk_oracles:/app/zk_oracles \
    -v $(pwd)/../deployments:/app/deployments \
    -v $(pwd)/../zkcdid-lib-rs:/app/zkcdid-lib-rs \
    -e ID=0 \
    -e TYPE=oracle \
    -e PRIVATE_KEY=$PRIVATE_KEY \
    -e MONGO_URL=mongodb://mongo0:27017 \
    zkcrosschaindid/oracle:1.0 \
    cargo watch -x 'run --bin listener' && cargo watch -x 'run --bin server'