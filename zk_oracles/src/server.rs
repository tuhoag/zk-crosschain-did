use status_exchange::{status_exchange_service_server::{StatusExchangeService, StatusExchangeServiceServer}, HelloReply, HelloRequest};
use tonic::{transport::Server, Request, Response, Status};
use zkcdid_lib_rs::config::Config;

pub mod status_exchange {
    tonic::include_proto!("status_exchange");
}

#[derive(Debug, Default)]
pub struct MyStatusExchangeServer {}

#[tonic::async_trait]
impl StatusExchangeService for MyStatusExchangeServer {
    async fn say_hello(
        &self,
        request: Request<HelloRequest>,
    ) -> Result<Response<HelloReply>, Status> {

        println!("Got a request: {:?}", request);

        let reply = HelloReply {
            message: format!("Hello {}!", request.into_inner().name).into(),
        };

        Ok(Response::new(reply))
    }

    async fn fulfill_request(
        &self,
        request: Request<status_exchange::RequestFulfillment>,
    ) -> Result<Response<status_exchange::RequestFulfillmentResult>, Status> {
        println!("Got a request: {:?}", request);

        let reply = status_exchange::RequestFulfillmentResult {
            result: true
        };

        Ok(Response::new(reply))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = Config::load_oracle_config();
    let addr = format!("0.0.0.0:{}", config.get_server_port()).parse()?;
    let server = MyStatusExchangeServer::default();

    println!("zkOracle Server {} listening on {}", config.get_name(), addr);
    Server::builder()
        .add_service(StatusExchangeServiceServer::new(server))
        .serve(addr)
        .await?;

    Ok(())
}