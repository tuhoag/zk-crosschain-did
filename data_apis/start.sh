docker run --name mongo1 -d -p 27017:27017 --network zkssi --rm mongo:latest
docker run --name api1 -p 3000:8000 -v $(pwd):/app --network zkssi \
    -e NAME=api1 \
    -e API_URL=http://localhost:3000 \
    -e MONGO_URL=mongodb://mongo1:27017 \
    zkcrosschaindid/api1:1.0
