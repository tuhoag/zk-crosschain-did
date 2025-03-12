echo "Initializing Data..."
echo "Resetting Data..."
curl -X GET "http://localhost:3000/app/reset"

echo "Adding credentials..."
sleep 1
curl -X POST "http://localhost:3000/credentials/bsl" \
    -H "Content-Type: application/json" \
    -d '{
            "subject": "Alice",
            "data": {
                "name": "Alice",
                "age": "20"
            }}'

sleep 1
curl -X POST "http://localhost:3000/credentials/bsl" \
    -H "Content-Type: application/json" \
    -d '{
            "subject": "Alice",
            "data": {
                "name": "Alice",
                "age": "30"
            }}'
sleep 1
curl -X POST "http://localhost:3000/credentials/bsl" \
    -H "Content-Type: application/json" \
    -d '{
            "subject": "Alice",
            "data": {
                "name": "Alice",
                "age": "50"
            }}'