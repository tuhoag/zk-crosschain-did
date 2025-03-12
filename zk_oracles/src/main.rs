use tonic::{transport::Server, Request, Response, Status};

use zk_oracles::errors::OracleResult;

use crate::helloworld::{greeter_server::{Greeter, GreeterServer}, HelloRequest, HelloReply};


pub mod helloworld {
    tonic::include_proto!("helloworld");
}

#[derive(Debug, Default)]
pub struct MyGreeter {}

#[tonic::async_trait]
impl Greeter for MyGreeter {
    async fn say_hello(
        &self,
        request: Request<HelloRequest>,
    ) -> Result<Response<HelloReply>, Status> {
        println!("Got a request: {:?}", request);

        let reply = helloworld::HelloReply {
            message: format!("Hello {}!", request.into_inner().name).into(),
        };

        Ok(Response::new(reply))
    }
}

async fn start_server() -> OracleResult<()> {
    let addr = "[::1]:50051".parse()?;
    let greeter = MyGreeter::default();

    println!("GreeterServer listening on {}", addr);
    Server::builder()
        .add_service(GreeterServer::new(greeter))
        .serve(addr)
        .await?;

    Ok(())
}

#[tokio::main]
async fn main() -> OracleResult<()> {
    start_server().await?;
    Ok(())
}