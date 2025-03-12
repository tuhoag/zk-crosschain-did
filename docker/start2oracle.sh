echo "Starting Oracle..."
docker run --name oracle1 -it -p 4001:8000 --network zkssi \
    -v $(pwd)/../zk_oracles:/app/zk_oracles \
    -v $(pwd)/../deployments:/app/deployments \
    -v $(pwd)/../zkcdid-lib-rs:/app/zkcdid-lib-rs \
    -e ID=1 \
    -e TYPE=oracle \
    -e PRIVATE_KEY=$PRIVATE_KEY \
    zkcrosschaindid/oracle:1.0 \
    /bin/bash