## Run APIs
### With Docker
- Build API Images

`docker build -f Dockerfile.api -t zkcrosschaindid/api:1.0 .`
`docker build -f Dockerfile.rust -t zkcrosschaindid/api1:1.0 .`

- Start a API
`docker run --name issuer1 -i -t \
    -e NAME=issuer1 \
    -e API_URL=http://localhost:3000 \
    -p 3000:8000 \
    -v "$(pwd)":/app \
    zkcrosschaindid/api1:1.0`

### Without Docker
Use `cargo-watch` crate to watch the changes of the code and automatically refresh the api.
`cargo watch -x 'run'`
