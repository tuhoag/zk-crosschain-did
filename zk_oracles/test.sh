curl -X GET "http://host.docker.internal:3000/app/reset"

curl -X POST "http://host.docker.internal:3000/credentials/bsl" \
    -H "Content-Type: application/json" \
    -d '{
            "subject": "Alice",
            "data": {
                "name": "Alice",
                "age": "20"
            }}'

curl -i -X POST "http://host.docker.internal:8545" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

curl -i -X POST "http://localhost:8545" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'