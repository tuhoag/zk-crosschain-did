echo "Initializing Data..."
echo "Resetting Data..."
curl -X GET "http://localhost:3000/app/reset"
sleep 1

echo "Adding credentials..."
NUMBER_OF_CREDENTIALS=1
for i in {1..$NUMBER_OF_CREDENTIALS}
do
    curl -X POST "http://localhost:3000/credentials/bsl" \
        -H "Content-Type: application/json" \
        -d '{
                "subject": "Alice",
                "data": {
                    "name": "Alice",
                    "age": "20"
                }}'

    sleep 1
done